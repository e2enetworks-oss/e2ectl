import type {
  AuthField,
  ConfigFile,
  ContextField,
  ProfileConfig,
  ResolvedCredentials
} from './types.js';
import {
  AUTH_ENV_VAR_BY_FIELD,
  CONTEXT_ENV_VAR_BY_FIELD,
  REQUIRED_AUTH_FIELDS,
  REQUIRED_CONTEXT_FIELDS,
  VALID_LOCATIONS
} from './types.js';
import { CliError, EXIT_CODES } from '../core/errors.js';

export interface ResolveCredentialsOptions {
  alias?: string;
  config: ConfigFile;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  location?: string;
  projectId?: string;
}

type PartialAuth = Partial<Record<AuthField, string>>;
type PartialContext = Partial<Record<ContextField, string>>;

export function readAuthFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PartialAuth {
  const credentials: PartialAuth = {};

  for (const field of REQUIRED_AUTH_FIELDS) {
    const value = env[AUTH_ENV_VAR_BY_FIELD[field]];
    if (isNonEmptyString(value)) {
      credentials[field] = value.trim();
    }
  }

  return credentials;
}

export function readContextFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PartialContext {
  const context: PartialContext = {};

  for (const field of REQUIRED_CONTEXT_FIELDS) {
    const value = env[CONTEXT_ENV_VAR_BY_FIELD[field]];
    if (isNonEmptyString(value)) {
      context[field] = value.trim();
    }
  }

  return context;
}

export function resolveCredentials(
  options: ResolveCredentialsOptions
): ResolvedCredentials {
  const envAuth = readAuthFromEnv(options.env);
  const envContext = readContextFromEnv(options.env);
  const flagContext = readContextFromFlags(options);
  if (options.alias !== undefined) {
    const profile = resolveProfile(
      options.config,
      options.alias,
      options.configPath,
      options.alias
    );

    return buildResolvedCredentials(
      options,
      options.alias,
      profile,
      envAuth,
      envContext,
      flagContext
    );
  }

  const defaultAlias = options.config.default;
  if (defaultAlias !== undefined) {
    const defaultProfile = options.config.profiles[defaultAlias];
    if (defaultProfile !== undefined) {
      return buildResolvedCredentials(
        options,
        defaultAlias,
        defaultProfile,
        envAuth,
        envContext,
        flagContext
      );
    }

    const missingAuthFields = getMissingFields(REQUIRED_AUTH_FIELDS, envAuth);
    const missingContextFields = getMissingFields(REQUIRED_CONTEXT_FIELDS, {
      ...envContext,
      ...flagContext
    });

    if (missingAuthFields.length > 0 || missingContextFields.length > 0) {
      throwInvalidDefaultProfileError(
        options,
        defaultAlias,
        missingAuthFields,
        missingContextFields
      );
    }
  }

  return buildResolvedCredentials(
    options,
    undefined,
    undefined,
    envAuth,
    envContext,
    flagContext
  );
}

function buildResolvedCredentials(
  options: ResolveCredentialsOptions,
  profileAlias: string | undefined,
  profile: ProfileConfig | undefined,
  envAuth: PartialAuth,
  envContext: PartialContext,
  flagContext: PartialContext
): ResolvedCredentials {
  const mergedAuth: PartialAuth = {
    ...(profile === undefined
      ? {}
      : {
          api_key: profile.api_key,
          auth_token: profile.auth_token
        }),
    ...envAuth
  };
  const mergedContext: PartialContext = {
    ...readContextFromProfile(profile),
    ...envContext,
    ...flagContext
  };

  const missingAuthFields = getMissingFields(REQUIRED_AUTH_FIELDS, mergedAuth);
  if (missingAuthFields.length > 0) {
    throwMissingAuthError(options, profileAlias, missingAuthFields);
  }

  const missingContextFields = getMissingFields(
    REQUIRED_CONTEXT_FIELDS,
    mergedContext
  );
  if (missingContextFields.length > 0) {
    throwMissingContextError(options, profileAlias, missingContextFields);
  }

  validateResolvedContext(
    mergedContext.project_id ?? '',
    mergedContext.location ?? ''
  );

  const resolvedCredentials = {
    api_key: mergedAuth.api_key ?? '',
    auth_token: mergedAuth.auth_token ?? '',
    project_id: mergedContext.project_id ?? '',
    location: mergedContext.location ?? '',
    source: inferCredentialSource(profile, envAuth)
  };

  return profileAlias === undefined
    ? resolvedCredentials
    : {
        ...resolvedCredentials,
        alias: profileAlias
      };
}

function getMissingFields<TField extends string>(
  requiredFields: readonly TField[],
  values: Partial<Record<TField, string>>
): TField[] {
  return requiredFields.filter((field) => {
    const value = values[field];
    return !isNonEmptyString(value);
  });
}

function readContextFromFlags(
  options: Pick<ResolveCredentialsOptions, 'projectId' | 'location'>
): PartialContext {
  const context: PartialContext = {};

  if (isNonEmptyString(options.projectId)) {
    context.project_id = options.projectId.trim();
  }

  if (isNonEmptyString(options.location)) {
    context.location = options.location.trim();
  }

  return context;
}

function readContextFromProfile(
  profile: ProfileConfig | undefined
): PartialContext {
  if (profile === undefined) {
    return {};
  }

  const context: PartialContext = {};

  if (isNonEmptyString(profile.default_project_id)) {
    context.project_id = profile.default_project_id.trim();
  }

  if (isNonEmptyString(profile.default_location)) {
    context.location = profile.default_location.trim();
  }

  return context;
}

function resolveProfile(
  config: ConfigFile,
  alias: string | undefined,
  configPath: string | undefined,
  explicitAlias: string | undefined
): ProfileConfig | undefined {
  if (alias === undefined) {
    return undefined;
  }

  const profile = config.profiles[alias];
  if (profile !== undefined) {
    return profile;
  }

  const details = [`Unknown profile alias: ${alias}`];
  if (configPath !== undefined) {
    details.push(`Config path: ${configPath}`);
  }

  throw new CliError(`Profile "${alias}" was not found.`, {
    code: 'PROFILE_NOT_FOUND',
    details,
    exitCode: EXIT_CODES.config,
    suggestion:
      explicitAlias === undefined
        ? 'Create a default profile or set E2E_API_KEY and E2E_AUTH_TOKEN.'
        : 'Choose an existing profile alias or set E2E_API_KEY and E2E_AUTH_TOKEN.'
  });
}

function throwInvalidDefaultProfileError(
  options: ResolveCredentialsOptions,
  alias: string,
  missingAuthFields: AuthField[],
  missingContextFields: ContextField[]
): never {
  const details = [`Unknown saved default alias: ${alias}`];

  if (missingAuthFields.length > 0) {
    details.push(
      `Missing required auth values without a valid default profile: ${missingAuthFields.join(', ')}`
    );
    details.push(
      `Expected environment variables: ${missingAuthFields
        .map((field) => AUTH_ENV_VAR_BY_FIELD[field])
        .join(', ')}`
    );
  }

  if (missingContextFields.length > 0) {
    details.push(
      `Missing required context values without a valid default profile: ${missingContextFields.join(', ')}`
    );
    details.push(
      `Expected environment variables: ${missingContextFields
        .map((field) => CONTEXT_ENV_VAR_BY_FIELD[field])
        .join(', ')}`
    );
  }

  if (options.projectId !== undefined || options.location !== undefined) {
    details.push(
      `Command flags: --project-id ${options.projectId ?? '<unset>'}, --location ${options.location ?? '<unset>'}`
    );
  }

  if (options.configPath !== undefined) {
    details.push(`Config path: ${options.configPath}`);
  }

  throw new CliError(`Default profile "${alias}" is invalid.`, {
    code: 'INVALID_DEFAULT_PROFILE',
    details,
    exitCode: EXIT_CODES.config,
    suggestion:
      'Fix the saved default profile or provide E2E_API_KEY, E2E_AUTH_TOKEN, and either E2E_PROJECT_ID/E2E_LOCATION or --project-id/--location.'
  });
}

function throwMissingAuthError(
  options: ResolveCredentialsOptions,
  profileAlias: string | undefined,
  missingFields: AuthField[]
): never {
  const missingEnvVars = missingFields.map(
    (field) => AUTH_ENV_VAR_BY_FIELD[field]
  );
  const details = [
    `Missing required auth values: ${missingFields.join(', ')}`,
    profileAlias === undefined
      ? 'No profile alias was provided and no default profile exists.'
      : `Resolved profile alias: ${profileAlias}`,
    `Expected environment variables: ${missingEnvVars.join(', ')}`
  ];

  if (options.configPath !== undefined) {
    details.push(`Config path: ${options.configPath}`);
  }

  throw new CliError('Unable to resolve MyAccount authentication.', {
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
  const missingEnvVars = missingFields.map(
    (field) => CONTEXT_ENV_VAR_BY_FIELD[field]
  );
  const details = [
    `Missing required context values: ${missingFields.join(', ')}`,
    profileAlias === undefined
      ? 'No profile alias was provided and no default profile exists.'
      : `Resolved profile alias: ${profileAlias}`,
    `Expected environment variables: ${missingEnvVars.join(', ')}`
  ];

  if (options.projectId !== undefined || options.location !== undefined) {
    details.push(
      `Command flags: --project-id ${options.projectId ?? '<unset>'}, --location ${options.location ?? '<unset>'}`
    );
  }

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

function validateResolvedContext(projectId: string, location: string): void {
  if (!/^\d+$/.test(projectId.trim())) {
    throw new CliError('Project ID must be numeric.', {
      code: 'INVALID_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass a numeric project id with --project-id or save a numeric default project id on the profile.'
    });
  }

  if (
    !VALID_LOCATIONS.includes(
      location.trim() as (typeof VALID_LOCATIONS)[number]
    )
  ) {
    throw new CliError(`Unsupported location "${location}".`, {
      code: 'INVALID_LOCATION',
      details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass a supported location with --location or save a supported default location on the profile.'
    });
  }
}

function inferCredentialSource(
  profile: ProfileConfig | undefined,
  envAuth: PartialAuth
): ResolvedCredentials['source'] {
  const hasEnvOverride = REQUIRED_AUTH_FIELDS.some(
    (field) => envAuth[field] !== undefined
  );

  if (profile !== undefined && hasEnvOverride) {
    return 'mixed';
  }

  if (profile !== undefined) {
    return 'profile';
  }

  return 'env';
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}
