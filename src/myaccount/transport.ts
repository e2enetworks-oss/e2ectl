import { CliError, EXIT_CODES } from '../core/errors.js';
import { isNonEmptyString, isRecord } from '../core/guards.js';
import { sanitizeUrl } from '../core/url.js';

import type {
  ApiClientCredentials,
  ApiClientOptions,
  ApiEnvelope,
  ApiRequestOptions,
  ApiResponseParser,
  FetchLikeResponse,
  FetchLike
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const GET_RETRY_BACKOFF_MS = 250;
const RETRYABLE_GET_STATUS_CODES = new Set([500, 502, 503, 504]);

export interface MyAccountTransport {
  delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse>;
  get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse>;
  post<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse>;
  request<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse>
  ): Promise<TResponse>;
}

export class MyAccountApiTransport implements MyAccountTransport {
  private readonly baseUrl: string;
  private readonly credentials: ApiClientCredentials;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    credentials: ApiClientCredentials,
    options: ApiClientOptions = {}
  ) {
    this.credentials = credentials;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchFn = options.fetchFn ?? (fetch as FetchLike);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'GET',
      path
    });
  }

  async post<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'POST',
      path
    });
  }

  async delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'DELETE',
      path
    });
  }

  async request<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse>
  ): Promise<TResponse> {
    const method = options.method ?? 'GET';
    const maxAttempts = method === 'GET' ? 2 : 1;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        return await this.requestOnce<TResponse>({
          ...options,
          method
        });
      } catch (error: unknown) {
        if (
          error instanceof RetryableRequestError &&
          attempt < maxAttempts - 1
        ) {
          attempt += 1;
          await wait(GET_RETRY_BACKOFF_MS);
          continue;
        }

        if (error instanceof RetryableRequestError) {
          throw error.original;
        }

        throw error;
      }
    }

    throw new Error('Unreachable transport retry state.');
  }

  private async requestOnce<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse> & {
      method: 'DELETE' | 'GET' | 'POST' | 'PUT';
    }
  ): Promise<TResponse> {
    const controller = new AbortController();
    const method = options.method;
    let requestUrl: string | undefined;
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      requestUrl = this.buildUrl(options);
      const response = await this.fetchFn(requestUrl, {
        method,
        headers: this.buildHeaders(options.body),
        ...(options.body === undefined
          ? {}
          : {
              body: JSON.stringify(options.body)
            }),
        signal: controller.signal
      });

      const { parseError, payload, preview } =
        await parseResponseBody(response);
      const parsedResponse = {
        path: options.path,
        payload,
        response,
        ...(requestUrl === undefined
          ? {}
          : { request_url: sanitizeUrl(requestUrl) }),
        ...(parseError === undefined ? {} : { parseError }),
        ...(preview === undefined ? {} : { preview })
      };
      const fallbackApiError = buildFallbackApiError(parsedResponse);
      if (fallbackApiError !== undefined) {
        if (
          method === 'GET' &&
          RETRYABLE_GET_STATUS_CODES.has(response.status)
        ) {
          throw new RetryableRequestError(fallbackApiError);
        }

        throw fallbackApiError;
      }

      if (options.parseResponse !== undefined) {
        return parseCustomSuccessResponse(
          parsedResponse,
          options.parseResponse
        );
      }

      if (!isApiEnvelope(payload)) {
        throw new CliError(
          'The MyAccount API returned an unexpected response shape.',
          {
            code: 'INVALID_API_RESPONSE',
            details: buildInvalidResponseDetails(parsedResponse),
            exitCode: EXIT_CODES.network,
            suggestion:
              'Retry the command and inspect the API response if the issue persists.'
          }
        );
      }

      return payload as TResponse;
    } catch (error: unknown) {
      if (error instanceof RetryableRequestError) {
        throw error;
      }

      if (error instanceof CliError) {
        throw error;
      }

      if (isAbortError(error)) {
        const cliError = new CliError('The MyAccount API request timed out.', {
          code: 'API_TIMEOUT',
          details: [
            `Timed out after ${this.timeoutMs}ms`,
            requestUrl === undefined
              ? `Base URL: ${this.baseUrl}`
              : `Request URL: ${sanitizeUrl(requestUrl)}`
          ],
          exitCode: EXIT_CODES.network,
          suggestion:
            'Retry the command. If the timeout persists, check network connectivity or raise the timeout in a future revision.'
        });

        if (method === 'GET') {
          throw new RetryableRequestError(cliError);
        }

        throw cliError;
      }

      if (error instanceof Error) {
        const cliError = new CliError(
          'The MyAccount API request could not be completed.',
          {
            code: 'API_NETWORK_ERROR',
            cause: error,
            details: [
              `Reason: ${error.message}`,
              requestUrl === undefined
                ? `Base URL: ${this.baseUrl}`
                : `Request URL: ${sanitizeUrl(requestUrl)}`
            ],
            exitCode: EXIT_CODES.network,
            suggestion:
              'Check network access and API availability, then retry the command.'
          }
        );

        if (method === 'GET') {
          throw new RetryableRequestError(cliError);
        }

        throw cliError;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(body: unknown): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.auth_token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    };
  }

  private buildUrl<TResponse>(options: ApiRequestOptions<TResponse>): string {
    const url = new URL(normalizePath(options.path), this.baseUrl);
    url.searchParams.set('apikey', this.credentials.api_key);

    if (options.includeProjectContext ?? true) {
      if (
        this.credentials.project_id === undefined ||
        this.credentials.location === undefined
      ) {
        throw new CliError(
          'MyAccount project context is required for this request.',
          {
            code: 'MISSING_REQUEST_CONTEXT',
            details: [`Path: ${options.path}`],
            exitCode: EXIT_CODES.config,
            suggestion:
              'Pass --project-id and --location, set E2E_PROJECT_ID and E2E_LOCATION, or save default project/location values on the selected profile.'
          }
        );
      }

      url.searchParams.set('project_id', this.credentials.project_id);
      url.searchParams.set('location', this.credentials.location);
    }

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

class RetryableRequestError extends Error {
  readonly original: CliError;

  constructor(original: CliError) {
    super(original.message);
    this.original = original;
  }
}

interface ParsedResponseBody {
  parseError?: Error;
  payload?: unknown;
  preview?: string;
}

interface FallbackApiErrorInput extends ParsedResponseBody {
  path: string;
  request_url?: string;
  response: FetchLikeResponse;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    'data' in value &&
    isRecord(value.errors) &&
    typeof value.message === 'string'
  );
}

async function parseResponseBody(
  response: FetchLikeResponse
): Promise<ParsedResponseBody> {
  if (typeof response.text === 'function') {
    const rawBody = await response.text();
    const preview = summarizeResponseBody(rawBody);
    if (rawBody.trim() === '') {
      return {
        ...(preview === undefined ? {} : { preview })
      };
    }

    try {
      return {
        payload: JSON.parse(rawBody) as unknown,
        ...(preview === undefined ? {} : { preview })
      };
    } catch (error: unknown) {
      return {
        ...(error instanceof Error ? { parseError: error } : {}),
        ...(preview === undefined ? {} : { preview })
      };
    }
  }

  try {
    return {
      payload: await response.json()
    };
  } catch (error: unknown) {
    return {
      ...(error instanceof Error ? { parseError: error } : {})
    };
  }
}

function parseCustomSuccessResponse<TResponse>(
  input: FallbackApiErrorInput,
  parseResponse: ApiResponseParser<TResponse>
): TResponse {
  try {
    return parseResponse(input.payload);
  } catch (error: unknown) {
    const details = buildInvalidResponseDetails(input);
    if (error instanceof Error) {
      details.push(`Reason: ${error.message}`);
    }

    throw new CliError(
      'The MyAccount API returned an unexpected response shape.',
      {
        code: 'INVALID_API_RESPONSE',
        details,
        exitCode: EXIT_CODES.network,
        suggestion:
          'Retry the command and inspect the API response if the issue persists.'
      }
    );
  }
}

function buildFallbackApiError(
  input: FallbackApiErrorInput
): CliError | undefined {
  const { path, payload, preview, response } = input;
  const shouldTreatAsApiFailure =
    !response.ok ||
    (isRecord(payload) &&
      (hasStatusCodeFailure(payload) ||
        hasCodeFailure(payload) ||
        hasDetailMessage(payload) ||
        payload.errors === true));

  if (!shouldTreatAsApiFailure) {
    return undefined;
  }

  const message = extractFallbackApiMessage(payload) ?? 'Unexpected API error';
  const details = [
    `HTTP status: ${response.status} ${response.statusText}`,
    `Path: ${path}`,
    ...(input.request_url === undefined
      ? []
      : [`Request URL: ${input.request_url}`]),
    ...extractFallbackApiDetails(payload),
    ...(preview === undefined || isRecord(payload)
      ? []
      : [`Response preview: ${preview}`])
  ];

  return new CliError(`MyAccount API request failed: ${message}`, {
    code: 'API_REQUEST_FAILED',
    details,
    exitCode:
      response.status === 401 || response.status === 403
        ? EXIT_CODES.auth
        : EXIT_CODES.network,
    suggestion:
      response.status === 401 || response.status === 403
        ? 'Verify the saved token and API key, then run the command again.'
        : 'Check the request inputs and try again.'
  });
}

function buildInvalidResponseDetails(input: FallbackApiErrorInput): string[] {
  const details = [
    `HTTP status: ${input.response.status} ${input.response.statusText}`,
    `Path: ${input.path}`,
    ...(input.request_url === undefined
      ? []
      : [`Request URL: ${input.request_url}`])
  ];

  if (input.parseError instanceof Error) {
    details.push(`Reason: ${input.parseError.message}`);
  }

  if (input.preview !== undefined) {
    details.push(`Response preview: ${input.preview}`);
  }

  return details;
}

function extractFallbackApiMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (isNonEmptyString(payload.message)) {
    return payload.message.trim();
  }

  if (isNonEmptyString(payload.detail)) {
    return payload.detail.trim();
  }

  if (isNonEmptyString(payload.errors)) {
    return payload.errors.trim();
  }

  return undefined;
}

function extractFallbackApiDetails(payload: unknown): string[] {
  if (!isRecord(payload)) {
    return [];
  }

  const details: string[] = [];

  if (typeof payload.status_code === 'number') {
    details.push(`API status_code: ${payload.status_code}`);
  }

  if (typeof payload.code === 'number') {
    details.push(`API code: ${payload.code}`);
  }

  if (isNonEmptyString(payload.detail)) {
    details.push(`Detail: ${payload.detail.trim()}`);
  }

  if ('errors' in payload && payload.errors !== undefined) {
    details.push(`Errors: ${JSON.stringify(payload.errors)}`);
  }

  return details;
}

function hasCodeFailure(payload: Record<string, unknown>): boolean {
  return typeof payload.code === 'number' && payload.code >= 400;
}

function hasDetailMessage(payload: Record<string, unknown>): boolean {
  return isNonEmptyString(payload.detail);
}

function hasStatusCodeFailure(payload: Record<string, unknown>): boolean {
  return typeof payload.status_code === 'number' && payload.status_code >= 400;
}

function summarizeResponseBody(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.length <= 160
    ? normalized
    : `${normalized.slice(0, 157)}...`;
}
