import type { ApiEnvelope, ApiRequestOptions } from '../types/api.js';
import type { ResolvedCredentials } from '../types/config.js';
import type {
  NodeCatalogOsData,
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateRequest,
  NodeCreateResult,
  NodeDeleteResult,
  NodeDetails,
  NodeListEnvelope
} from '../types/node.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

const DEFAULT_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
  statusText: string;
}>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

export interface MyAccountClient {
  createNode(body: NodeCreateRequest): Promise<ApiEnvelope<NodeCreateResult>>;
  delete<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  deleteNode(nodeId: string): Promise<ApiEnvelope<NodeDeleteResult>>;
  get<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  listNodeCatalogOs(): Promise<ApiEnvelope<NodeCatalogOsData>>;
  listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<ApiEnvelope<NodeCatalogPlan[]>>;
  getNode(nodeId: string): Promise<ApiEnvelope<NodeDetails>>;
  listNodes(): Promise<NodeListEnvelope>;
  post<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  request<TData>(options: ApiRequestOptions): Promise<ApiEnvelope<TData>>;
  validateCredentials(): Promise<ApiEnvelope<unknown>>;
}

export class MyAccountApiClient implements MyAccountClient {
  private readonly baseUrl: string;
  private readonly credentials: ResolvedCredentials;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    credentials: ResolvedCredentials,
    options: ApiClientOptions = {}
  ) {
    this.credentials = credentials;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchFn = options.fetchFn ?? (fetch as FetchLike);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'GET',
      path
    });
  }

  async post<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'POST',
      path
    });
  }

  async delete<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'DELETE',
      path
    });
  }

  async createNode(
    body: NodeCreateRequest
  ): Promise<ApiEnvelope<NodeCreateResult>> {
    return this.post<NodeCreateResult>('/nodes/', {
      body
    });
  }

  async deleteNode(nodeId: string): Promise<ApiEnvelope<NodeDeleteResult>> {
    return this.delete<NodeDeleteResult>(`/nodes/${nodeId}/`);
  }

  async validateCredentials(): Promise<ApiEnvelope<unknown>> {
    return this.get('/iam/multi-crn/', {
      includeProjectContext: false
    });
  }

  async listNodeCatalogOs(): Promise<ApiEnvelope<NodeCatalogOsData>> {
    return this.get<NodeCatalogOsData>('/images/os-category/');
  }

  async listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<ApiEnvelope<NodeCatalogPlan[]>> {
    return this.get<NodeCatalogPlan[]>('/images/', {
      query
    });
  }

  async listNodes(): Promise<NodeListEnvelope> {
    return this.get<NodeListEnvelope['data']>(
      '/nodes/'
    ) as Promise<NodeListEnvelope>;
  }

  async getNode(nodeId: string): Promise<ApiEnvelope<NodeDetails>> {
    return this.get<NodeDetails>(`/nodes/${nodeId}/`);
  }

  async request<TData>(
    options: ApiRequestOptions
  ): Promise<ApiEnvelope<TData>> {
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

      const payload = await response.json();
      if (!isApiEnvelope<TData>(payload)) {
        throw new CliError(
          'The MyAccount API returned an unexpected response shape.',
          {
            code: 'INVALID_API_RESPONSE',
            details: [`Path: ${options.path}`],
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

      return payload;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiEnvelope<TData>(value: unknown): value is ApiEnvelope<TData> {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    'data' in value &&
    isRecord(value.errors) &&
    typeof value.message === 'string'
  );
}
