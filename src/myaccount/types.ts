export interface FetchLikeResponse {
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
  statusText: string;
  text?(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<FetchLikeResponse>;

export type ApiResponseParser<TResponse> = (payload: unknown) => TResponse;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

export interface ApiAuthCredentials {
  api_key: string;
  auth_token: string;
}

export interface ApiEnvelope<TData> {
  code: number;
  data: TData;
  errors: Record<string, ApiErrorValue>;
  message: string;
}

export type ApiResponse<
  TData,
  TExtra extends object = Record<string, never>
> = ApiEnvelope<TData> & TExtra;

export type ApiErrorValue =
  | null
  | string
  | string[]
  | number
  | boolean
  | Record<string, unknown>;

export interface ApiRequestOptions<TResponse = ApiEnvelope<unknown>> {
  body?: unknown;
  includeProjectContext?: boolean;
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
  parseResponse?: ApiResponseParser<TResponse>;
  path: string;
  query?: Record<string, string | undefined>;
}

export interface ApiClientCredentials extends ApiAuthCredentials {
  alias?: string;
  location?: string;
  project_id?: string;
  source: 'env' | 'mixed' | 'profile';
}
