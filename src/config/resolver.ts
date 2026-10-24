import type {
  AuthField,
  ConfigFile,
  ContextField,
  CredentialSource,
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
  TIR_CONTEXT_ENV_VAR_BY_FIELD,
  VALID_LOCATIONS
} from './types.js';
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
  source: CredentialSource;
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
      location,
      source: auth.source
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
      source: auth.source,
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
      source: auth.source,
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
      : options.config.profiles[defaultAlias];
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
  const values: Partial<Record<AuthField, string>> = {};
  const origins: PickedValue['origin'][] = [];

  for (const field of REQUIRED_AUTH_FIELDS) {
    const saved = selection.profile?.[field];
    const picked = pickValue({
      flag: selection.chosenByFlag ? saved : undefined,
      env: env[AUTH_ENV_VAR_BY_FIELD[field]],
      profile: selection.chosenByFlag ? undefined : saved
    });

    if (picked !== undefined) {
      values[field] = picked.value;
      origins.push(picked.origin);
    }
  }

  return {
    missing: getMissingFields(REQUIRED_AUTH_FIELDS, values),
    source: describeAuthSource(origins),
    values
  };
}

// 'env' when every value came from the environment, 'profile' when every
// value came from the saved profile, 'mixed' otherwise.
function describeAuthSource(
  origins: PickedValue['origin'][]
): CredentialSource {
  if (origins.length > 0 && origins.every((origin) => origin === 'env')) {
    return 'env';
  }

  return origins.some((origin) => origin === 'env') ? 'mixed' : 'profile';
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

  return {
    ...(projectId === undefined ? {} : { project_id: projectId.value }),
    ...(location === undefined ? {} : { location: location.value })
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

  return context;
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
  assertNumericTirValue(context.account_id, 'account', '--account-id');

  if (requirement === 'account') {
    return;
  }

  if (context.project_id === undefined || context.location === undefined) {
    throw new CliError('No TIR project chosen.', {
      code: 'MISSING_TIR_PROJECT',
      exitCode: EXIT_CODES.config,
      suggestion: `Run \`${formatCliCommand('tir project list')}\`, then \`${formatCliCommand('tir configure --account-id <id> --project-id <id> --location <Delhi|Chennai>')}\`, or set ${TIR_CONTEXT_ENV_VAR_BY_FIELD.project_id} and ${TIR_CONTEXT_ENV_VAR_BY_FIELD.location}.`
    });
  }
  assertNumericTirValue(context.project_id, 'project', '--project-id');
  assertValidLocation(context.location);
}

function assertNumericTirValue(
  value: string,
  label: 'account' | 'project',
  flag: string
): void {
  if (/^\d+$/.test(value)) {
    return;
  }

  throw new CliError(`TIR ${label} ID must be numeric.`, {
    code: `INVALID_TIR_${label.toUpperCase()}_ID`,
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass the numeric id from \`${formatCliCommand(`tir ${label} list`)}\` with ${flag}.`
  });
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
  const profile = options.config.profiles[alias];
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
    suggestion:
      'Choose an existing profile alias or set E2E_API_KEY and E2E_AUTH_TOKEN.'
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
      suggestion:
        'Fix the saved default profile or provide E2E_API_KEY, E2E_AUTH_TOKEN, and either E2E_PROJECT_ID/E2E_LOCATION or --project-id/--location.'
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
    suggestion:
      'Set E2E_API_KEY and E2E_AUTH_TOKEN or add a saved profile before running API-backed commands.'
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

  throw new CliError('Unable to resolve MyAccount project context.', {
    code: 'MISSING_REQUEST_CONTEXT',
    details,
    exitCode: EXIT_CODES.config,
    suggestion:
      'Pass --project-id and --location, set E2E_PROJECT_ID and E2E_LOCATION, or save default project/location values on the selected profile.'
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
  if (!/^\d+$/.test(projectId)) {
    throw new CliError('Project ID must be numeric.', {
      code: 'INVALID_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass a numeric project id with --project-id or save a numeric default project id on the profile.'
    });
  }

  assertValidLocation(location);
}

function assertValidLocation(location: string): void {
  if (VALID_LOCATIONS.includes(location as (typeof VALID_LOCATIONS)[number])) {
    return;
  }

  throw new CliError(`Unsupported location "${location}".`, {
    code: 'INVALID_LOCATION',
    details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass a supported location with --location or save a supported default location on the profile.'
  });
}
