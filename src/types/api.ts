export interface ApiEnvelope<TData> {
  code: number;
  data: TData;
  errors: Record<string, ApiErrorValue>;
  message: string;
}

export type ApiErrorValue =
  | null
  | string
  | string[]
  | number
  | boolean
  | Record<string, unknown>;

export interface ApiRequestOptions {
  includeProjectContext?: boolean;
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}
