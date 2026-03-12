import { CliError, EXIT_CODES } from '../core/errors.js';

import type {
  ApiClientCredentials,
  ApiClientOptions,
  ApiEnvelope,
  ApiRequestOptions,
  FetchLike
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface MyAccountTransport {
  delete<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse>;
  get<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse>;
  post<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse>;
  request<TResponse extends ApiEnvelope<unknown>>(
    options: ApiRequestOptions
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

  async get<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'GET',
      path
    });
  }

  async post<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'POST',
      path
    });
  }

  async delete<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'DELETE',
      path
    });
  }

  async request<TResponse extends ApiEnvelope<unknown>>(
    options: ApiRequestOptions
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(this.buildUrl(options), {
        method: options.method ?? 'GET',
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
      if (!isApiEnvelope(payload)) {
        const fallbackApiError = buildFallbackApiError({
          path: options.path,
          payload,
          response,
          ...(parseError === undefined ? {} : { parseError }),
          ...(preview === undefined ? {} : { preview })
        });
        if (fallbackApiError !== undefined) {
          throw fallbackApiError;
        }

        throw new CliError(
          'The MyAccount API returned an unexpected response shape.',
          {
            code: 'INVALID_API_RESPONSE',
            details: buildInvalidResponseDetails({
              path: options.path,
              response,
              ...(parseError === undefined ? {} : { parseError }),
              ...(preview === undefined ? {} : { preview })
            }),
            exitCode: EXIT_CODES.network,
            suggestion:
              'Retry the command and inspect the API response if the issue persists.'
          }
        );
      }

      if (!response.ok || payload.code >= 400) {
        throw new CliError(`MyAccount API request failed: ${payload.message}`, {
          code: 'API_REQUEST_FAILED',
          details: [
            `HTTP status: ${response.status} ${response.statusText}`,
            `API code: ${payload.code}`,
            `Path: ${options.path}`,
            `Errors: ${JSON.stringify(payload.errors)}`
          ],
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

      return payload as TResponse;
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new CliError('The MyAccount API request timed out.', {
          code: 'API_TIMEOUT',
          details: [
            `Timed out after ${this.timeoutMs}ms`,
            `Base URL: ${this.baseUrl}`
          ],
          exitCode: EXIT_CODES.network,
          suggestion:
            'Retry the command. If the timeout persists, check network connectivity or raise the timeout in a future revision.'
        });
      }

      if (error instanceof Error) {
        throw new CliError(
          'The MyAccount API request could not be completed.',
          {
            code: 'API_NETWORK_ERROR',
            cause: error,
            details: [`Reason: ${error.message}`, `Base URL: ${this.baseUrl}`],
            exitCode: EXIT_CODES.network,
            suggestion:
              'Check network access and API availability, then retry the command.'
          }
        );
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

  private buildUrl(options: ApiRequestOptions): string {
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

interface ParsedResponseBody {
  parseError?: Error;
  payload?: unknown;
  preview?: string;
}

interface FallbackApiErrorInput extends ParsedResponseBody {
  path: string;
  response: Awaited<ReturnType<FetchLike>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  response: Awaited<ReturnType<FetchLike>>
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
    `Path: ${input.path}`
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
