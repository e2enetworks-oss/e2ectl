// The TIR account, project and location a profile works in, saved by
// `tir configure` and used by every later `tir` command.
export const TIR_CONTEXT_FIELDS = [
  'account_id',
  'location',
  'project_id'
] as const;

export type TirContextField = (typeof TIR_CONTEXT_FIELDS)[number];

export type TirContext = Partial<Record<TirContextField, string>>;

// The MyAccount project and location a profile works in, saved by
// `myaccount configure` and used by every later `myaccount` command.
export type MyAccountContext = Partial<Record<ContextField, string>>;

export interface ProfileConfig {
  api_key: string;
  auth_token: string;
  myaccount?: MyAccountContext;
  tir?: TirContext;
}

export const VALID_LOCATIONS = ['Delhi', 'Chennai'] as const;

export interface ConfigFile {
  profiles: Record<string, ProfileConfig>;
  default?: string;
}

export interface ResolvedCredentials {
  api_key: string;
  auth_token: string;
  alias?: string;
  location: string;
  project_id: string;
}

export interface ResolvedAccountCredentials {
  api_key: string;
  auth_token: string;
  alias?: string;
  location?: string;
  project_id?: string;
}

// TIR context only: the account, project and location chosen for TIR.
export interface ResolvedTirCredentials {
  api_key: string;
  auth_token: string;
  account_id?: string;
  alias?: string;
  location?: string;
  project_id?: string;
}

export interface ProfileSummary {
  alias: string;
  isDefault: boolean;
  api_key: string;
  auth_token: string;
  myaccount: MyAccountContext | null;
  tir: TirContext | null;
}

export const REQUIRED_AUTH_FIELDS = ['api_key', 'auth_token'] as const;

export const REQUIRED_CONTEXT_FIELDS = ['project_id', 'location'] as const;

export type AuthField = (typeof REQUIRED_AUTH_FIELDS)[number];
export type ContextField = (typeof REQUIRED_CONTEXT_FIELDS)[number];

export const AUTH_ENV_VAR_BY_FIELD: Record<AuthField, string> = {
  api_key: 'E2E_API_KEY',
  auth_token: 'E2E_AUTH_TOKEN'
};

export const CONTEXT_ENV_VAR_BY_FIELD: Record<ContextField, string> = {
  project_id: 'E2E_PROJECT_ID',
  location: 'E2E_LOCATION'
};

export const TIR_CONTEXT_ENV_VAR_BY_FIELD: Record<TirContextField, string> = {
  account_id: 'E2E_TIR_ACCOUNT_ID',
  location: 'E2E_TIR_LOCATION',
  project_id: 'E2E_TIR_PROJECT_ID'
};
