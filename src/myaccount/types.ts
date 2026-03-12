export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
  statusText: string;
  text?(): Promise<string>;
}>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
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

export interface ApiRequestOptions {
  body?: unknown;
  includeProjectContext?: boolean;
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, string | undefined>;
}

export interface ApiClientCredentials {
  alias?: string;
  api_key: string;
  auth_token: string;
  location?: string;
  project_id?: string;
  source: 'env' | 'mixed' | 'profile';
}
