// The TIR account, project and location a profile works in. Saved now so
// old and new config files share one shape; TIR commands start using it in
// a later release.
export interface TirContext {
  account_id?: string;
  location?: string;
  project_id?: string;
}

export const TIR_CONTEXT_FIELDS = [
  'account_id',
  'location',
  'project_id'
] as const;

export interface ProfileConfig {
  api_key: string;
  auth_token: string;
  // MyAccount context. The names predate TIR and stay as they are so
  // existing config files keep working unchanged.
  default_project_id?: string;
  default_location?: string;
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
  source: 'env' | 'profile' | 'mixed';
}

export interface ResolvedAccountCredentials {
  api_key: string;
  auth_token: string;
  alias?: string;
  location?: string;
  project_id?: string;
  source: 'env' | 'profile' | 'mixed';
}

export interface ProfileSummary {
  alias: string;
  isDefault: boolean;
  api_key: string;
  auth_token: string;
  default_project_id: string;
  default_location: string;
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
