import type {
  AuthField,
  ConfigFile,
  ContextField,
  ProfileConfig,
  ResolvedAccountCredentials,
  ResolvedCredentials,
  ResolvedTirCredentials,
  TirContextField
} from './types.js';
import {
  AUTH_ENV_VAR_BY_FIELD,
  CONTEXT_ENV_VAR_BY_FIELD,
  REQUIRED_AUTH_FIELDS,
  REQUIRED_CONTEXT_FIELDS,
  TIR_CONTEXT_ENV_VAR_BY_FIELD
} from './types.js';
import { findLocation, normalizeLocation, parseNumericId } from './checks.js';
import { findProfile } from './store.js';
import { pickValue, type PickedValue } from './value-order.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';

export interface ResolveCredentialsOptions {
  alias?: string;
  config: ConfigFile;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  location?: string;
  projectId?: string;
}

export interface ResolveTirCredentialsOptions extends ResolveCredentialsOptions {
  accountId?: string;
}

// What a TIR command needs before it can call the API: only a key and token
// (account list), also an account (project list), or the full context.
export type TirRequirement = 'account' | 'auth' | 'project';

type PartialContext = Partial<Record<ContextField, string>>;

export interface CredentialResolutionStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

// The profile a command works with. `chosenByFlag` is true when --alias named
// it: the alias is a flag, so the profile's key and token then beat the key
// and token environment variables.
interface SelectedProfile {
  alias: string | undefined;
  chosenByFlag: boolean;
  profile: ProfileConfig | undefined;
  // A saved default alias whose profile no longer exists.
  staleDefault: string | undefined;
}

interface ResolvedAuth {
  missing: AuthField[];
  values: Partial<Record<AuthField, string>>;
}

export function resolveCredentials(
  options: ResolveCredentialsOptions
): ResolvedCredentials {
  const env = options.env ?? process.env;
  const selection = selectProfile(options);
  const auth = resolveAuth(selection, env);
  const context = resolveMyAccountContext(options, selection, env);
  const missingContext = getMissingFields(REQUIRED_CONTEXT_FIELDS, context);

  assertDefaultProfileUsable(options, selection, auth.missing, missingContext);
  assertAuthResolved(options, selection, auth, 'MyAccount');
  if (missingContext.length > 0) {
    throwMissingContextError(options, selection.alias, missingContext);
  }

  const projectId = context.project_id ?? '';
  const location = context.location ?? '';
  validateResolvedContext(projectId, location);

  return withAlias<ResolvedCredentials>(
    {
      api_key: auth.values.api_key ?? '',
      auth_token: auth.values.auth_token ?? '',
      project_id: projectId,
      location
    },
    selection.alias
  );
}

export function resolveAccountCredentials(
  options: ResolveCredentialsOptions
): ResolvedAccountCredentials {
  const env = options.env ?? process.env;
  const selection = selectProfile(options);
  const auth = resolveAuth(selection, env);
  const context = resolveMyAccountContext(options, selection, env);

  assertDefaultProfileUsable(options, selection, auth.missing, []);
  assertAuthResolved(options, selection, auth, 'MyAccount');
  if (context.project_id !== undefined && context.location !== undefined) {
    validateResolvedContext(context.project_id, context.location);
  }

  return withAlias<ResolvedAccountCredentials>(
    {
      api_key: auth.values.api_key ?? '',
      auth_token: auth.values.auth_token ?? '',
      ...context
    },
    selection.alias
  );
}

export function resolveTirCredentials(
  options: ResolveTirCredentialsOptions,
  requirement: TirRequirement
): ResolvedTirCredentials {
  const env = options.env ?? process.env;
  const selection = selectProfile(options);
  const auth = resolveAuth(selection, env);

  assertDefaultProfileUsable(options, selection, auth.missing, []);
  assertAuthResolved(options, selection, auth, 'TIR');

  const context = resolveTirContext(options, selection, env);
  assertTirContext(context, requirement);

  return withAlias<ResolvedTirCredentials>(
    {
      api_key: auth.values.api_key ?? '',
      auth_token: auth.values.auth_token ?? '',
      ...context
    },
    selection.alias
  );
}

export async function resolveStoredCredentials(
  store: CredentialResolutionStore,
  options: Omit<ResolveCredentialsOptions, 'config' | 'configPath'>
): Promise<ResolvedCredentials> {
  return resolveCredentials({
    ...options,
    config: await store.read(),
    configPath: store.configPath
  });
}

export async function resolveStoredAccountCredentials(
  store: CredentialResolutionStore,
  options: Omit<ResolveCredentialsOptions, 'config' | 'configPath'>
): Promise<ResolvedAccountCredentials> {
  return resolveAccountCredentials({
    ...options,
    config: await store.read(),
    configPath: store.configPath
  });
}

export async function resolveStoredTirCredentials(
  store: CredentialResolutionStore,
  options: Omit<ResolveTirCredentialsOptions, 'config' | 'configPath'>,
  requirement: TirRequirement
): Promise<ResolvedTirCredentials> {
  return resolveTirCredentials(
    {
      ...options,
      config: await store.read(),
      configPath: store.configPath
    },
    requirement
  );
}

function selectProfile(options: ResolveCredentialsOptions): SelectedProfile {
  if (options.alias !== undefined) {
    return {
      alias: options.alias,
      chosenByFlag: true,
      profile: requireProfile(options, options.alias),
      staleDefault: undefined
    };
  }

  const defaultAlias = options.config.default;
  const defaultProfile =
    defaultAlias === undefined
      ? undefined
      : findProfile(options.config, defaultAlias);
  if (defaultProfile === undefined) {
    return {
      alias: undefined,
      chosenByFlag: false,
      profile: undefined,
      staleDefault: defaultAlias
    };
  }

  return {
    alias: defaultAlias,
    chosenByFlag: false,
    profile: defaultProfile,
    staleDefault: undefined
  };
}

function resolveAuth(
  selection: SelectedProfile,
  env: NodeJS.ProcessEnv
): ResolvedAuth {
  const picked = pickKeyAndToken(
    selection.profile,
    selection.chosenByFlag,
    env
  );
  const values: Partial<Record<AuthField, string>> = {};
  for (const field of REQUIRED_AUTH_FIELDS) {
    const value = picked[field]?.value;
    if (value !== undefined) {
      values[field] = value;
    }
  }

  return { missing: getMissingFields(REQUIRED_AUTH_FIELDS, values), values };
}

// The key and token in the shared value order. A profile named with --alias
// counts as a flag, so it beats E2E_API_KEY and E2E_AUTH_TOKEN; the default
// profile comes after them. e2ectl configure uses this too.
export function pickKeyAndToken(
  profile: ProfileConfig | undefined,
  chosenByFlag: boolean,
  env: NodeJS.ProcessEnv
): Record<AuthField, PickedValue | undefined> {
  const pick = (field: AuthField): PickedValue | undefined =>
    pickValue({
      env: env[AUTH_ENV_VAR_BY_FIELD[field]],
      flag: chosenByFlag ? profile?.[field] : undefined,
      profile: chosenByFlag ? undefined : profile?.[field]
    });

  return { api_key: pick('api_key'), auth_token: pick('auth_token') };
}

function resolveMyAccountContext(
  options: ResolveCredentialsOptions,
  selection: SelectedProfile,
  env: NodeJS.ProcessEnv
): PartialContext {
  const projectId = pickValue({
    flag: options.projectId,
    env: env[CONTEXT_ENV_VAR_BY_FIELD.project_id],
    profile: selection.profile?.default_project_id
  });
  const location = pickValue({
    flag: options.location,
    env: env[CONTEXT_ENV_VAR_BY_FIELD.location],
    profile: selection.profile?.default_location
  });

  return withCanonicalLocation({
    ...(projectId === undefined ? {} : { project_id: projectId.value }),
    ...(location === undefined ? {} : { location: location.value })
  });
}

// "chennai" works like "Chennai"; anything else is checked later.
function withCanonicalLocation<T extends { location?: string }>(context: T): T {
  return context.location === undefined
    ? context
    : {
        ...context,
        location: findLocation(context.location) ?? context.location
      };
}

function resolveTirContext(
  options: ResolveTirCredentialsOptions,
  selection: SelectedProfile,
  env: NodeJS.ProcessEnv
): Partial<Record<TirContextField, string>> {
  const flags: Record<TirContextField, string | undefined> = {
    account_id: options.accountId,
    location: options.location,
    project_id: options.projectId
  };
  const context: Partial<Record<TirContextField, string>> = {};

  for (const field of Object.keys(flags) as TirContextField[]) {
    const picked = pickValue({
      flag: flags[field],
      env: env[TIR_CONTEXT_ENV_VAR_BY_FIELD[field]],
      profile: selection.profile?.tir?.[field]
    });
    if (picked !== undefined) {
      context[field] = picked.value;
    }
  }

  return withCanonicalLocation(context);
}

function assertTirContext(
  context: Partial<Record<TirContextField, string>>,
  requirement: TirRequirement
): void {
  if (requirement === 'auth') {
    return;
  }

  if (context.account_id === undefined) {
    throw new CliError('No TIR account chosen.', {
      code: 'MISSING_TIR_ACCOUNT',
      exitCode: EXIT_CODES.config,
      suggestion: `Run \`${formatCliCommand('tir account list')}\`, then pass --account-id <id>, set ${TIR_CONTEXT_ENV_VAR_BY_FIELD.account_id}, or run \`${formatCliCommand('tir configure')}\`.`
    });
  }
  parseNumericId(context.account_id, 'TIR account ID', '--account-id');

  if (requirement === 'account') {
    return;
  }

  if (context.project_id === undefined || context.location === undefined) {
    throw new CliError('No TIR project and location chosen.', {
      code: 'MISSING_TIR_PROJECT',
      exitCode: EXIT_CODES.config,
      suggestion: `Run \`${formatCliCommand('tir project list')}\`, then \`${formatCliCommand('tir configure --account-id <id> --project-id <id> --location <Delhi|Chennai>')}\`, or set ${TIR_CONTEXT_ENV_VAR_BY_FIELD.project_id} and ${TIR_CONTEXT_ENV_VAR_BY_FIELD.location}.`
    });
  }
  parseNumericId(context.project_id, 'TIR project ID', '--project-id');
  normalizeLocation(context.location);
}

function getMissingFields<TField extends string>(
  requiredFields: readonly TField[],
  values: Partial<Record<TField, string>>
): TField[] {
  return requiredFields.filter((field) => values[field] === undefined);
}

function withAlias<TCredentials extends { alias?: string }>(
  credentials: TCredentials,
  alias: string | undefined
): TCredentials {
  return alias === undefined ? credentials : { ...credentials, alias };
}

function requireProfile(
  options: ResolveCredentialsOptions,
  alias: string
): ProfileConfig {
  const profile = findProfile(options.config, alias);
  if (profile !== undefined) {
    return profile;
  }

  const details = [`Unknown profile alias: ${alias}`];
  if (options.configPath !== undefined) {
    details.push(`Config path: ${options.configPath}`);
  }

  throw new CliError(`Profile "${alias}" was not found.`, {
    code: 'PROFILE_NOT_FOUND',
    details,
    exitCode: EXIT_CODES.config,
    suggestion: `Pick one from \`${formatCliCommand('config list')}\`, save it with \`${formatCliCommand(`configure --alias ${alias}`)}\`, or set E2E_API_KEY and E2E_AUTH_TOKEN.`
  });
}

// A saved default alias that points at a missing profile is only an error
// when the environment and flags cannot fill in what the profile would have.
function assertDefaultProfileUsable(
  options: ResolveCredentialsOptions,
  selection: SelectedProfile,
  missingAuthFields: AuthField[],
  missingContextFields: ContextField[]
): void {
  if (
    selection.staleDefault === undefined ||
    (missingAuthFields.length === 0 && missingContextFields.length === 0)
  ) {
    return;
  }

  const details = [`Unknown saved default alias: ${selection.staleDefault}`];

  if (missingAuthFields.length > 0) {
    details.push(
      `Missing required auth values without a valid default profile: ${missingAuthFields.join(', ')}`,
      `Expected environment variables: ${missingAuthFields
        .map((field) => AUTH_ENV_VAR_BY_FIELD[field])
        .join(', ')}`
    );
  }

  if (missingContextFields.length > 0) {
    details.push(
      `Missing required context values without a valid default profile: ${missingContextFields.join(', ')}`,
      `Expected environment variables: ${missingContextFields
        .map((field) => CONTEXT_ENV_VAR_BY_FIELD[field])
        .join(', ')}`
    );
  }

  details.push(...describeContextFlags(options));
  if (options.configPath !== undefined) {
    details.push(`Config path: ${options.configPath}`);
  }

  throw new CliError(
    `Default profile "${selection.staleDefault}" is invalid.`,
    {
      code: 'INVALID_DEFAULT_PROFILE',
      details,
      exitCode: EXIT_CODES.config,
      suggestion: `Save it again with \`${formatCliCommand('configure')}\`, or pick another profile with --alias.`
    }
  );
}

function assertAuthResolved(
  options: ResolveCredentialsOptions,
  selection: SelectedProfile,
  auth: ResolvedAuth,
  platform: 'MyAccount' | 'TIR'
): void {
  if (auth.missing.length === 0) {
    return;
  }

  const details = [
    `Missing required auth values: ${auth.missing.join(', ')}`,
    selection.alias === undefined
      ? 'No profile alias was provided and no default profile exists.'
      : `Resolved profile alias: ${selection.alias}`,
    `Expected environment variables: ${auth.missing
      .map((field) => AUTH_ENV_VAR_BY_FIELD[field])
      .join(', ')}`
  ];
  if (options.configPath !== undefined) {
    details.push(`Config path: ${options.configPath}`);
  }

  throw new CliError(`Unable to resolve ${platform} authentication.`, {
    code: 'MISSING_AUTH_CREDENTIALS',
    details,
    exitCode: EXIT_CODES.auth,
    suggestion: `Run \`${formatCliCommand('configure')}\`, or set E2E_API_KEY and E2E_AUTH_TOKEN.`
  });
}

function throwMissingContextError(
  options: ResolveCredentialsOptions,
  profileAlias: string | undefined,
  missingFields: ContextField[]
): never {
  const details = [
    `Missing required context values: ${missingFields.join(', ')}`,
    profileAlias === undefined
      ? 'No profile alias was provided and no default profile exists.'
      : `Resolved profile alias: ${profileAlias}`,
    `Expected environment variables: ${missingFields
      .map((field) => CONTEXT_ENV_VAR_BY_FIELD[field])
      .join(', ')}`,
    ...describeContextFlags(options)
  ];
  if (options.configPath !== undefined) {
    details.push(`Config path: ${options.configPath}`);
  }

  throw new CliError('No MyAccount project and location chosen.', {
    code: 'MISSING_REQUEST_CONTEXT',
    details,
    exitCode: EXIT_CODES.config,
    suggestion: `Run \`${formatCliCommand('myaccount configure')}\`, pass --project-id and --location, or set E2E_PROJECT_ID and E2E_LOCATION.`
  });
}

function describeContextFlags(options: ResolveCredentialsOptions): string[] {
  if (options.projectId === undefined && options.location === undefined) {
    return [];
  }

  return [
    `Command flags: --project-id ${options.projectId ?? '<unset>'}, --location ${options.location ?? '<unset>'}`
  ];
}

function validateResolvedContext(projectId: string, location: string): void {
  parseNumericId(projectId, 'Project ID', '--project-id');
  normalizeLocation(location);
}
