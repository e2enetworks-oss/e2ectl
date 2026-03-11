import { CliError, EXIT_CODES } from '../core/errors.js';
import { readImportedProfiles } from './import-file.js';
import type { ConfigFile, ProfileConfig } from './types.js';
import { VALID_LOCATIONS } from './types.js';

export interface AddProfileInput {
  alias: string;
  apiKey: string;
  authToken: string;
  defaultLocation?: string;
  defaultProjectId?: string;
}

export interface ImportProfilesInput {
  default?: string;
  defaultLocation?: string;
  defaultProjectId?: string;
  file: string;
  force?: boolean;
  input?: boolean;
}

export interface RemoveProfileInput {
  alias: string;
}

export interface SetContextInput {
  alias: string;
  defaultLocation?: string;
  defaultProjectId?: string;
}

export interface SetDefaultInput {
  alias: string;
}

export interface ConfigListCommandResult {
  action: 'list';
  config: ConfigFile;
}

export interface ConfigSavedCommandResult {
  action: 'saved';
  alias: string;
  config: ConfigFile;
}

export interface ConfigSetContextCommandResult {
  action: 'set-context';
  alias: string;
  config: ConfigFile;
}

export interface ConfigSetDefaultCommandResult {
  action: 'set-default';
  alias: string;
  config: ConfigFile;
}

export interface ConfigRemovedCommandResult {
  action: 'removed';
  alias: string;
  config: ConfigFile;
}

export interface ConfigImportedCommandResult {
  action: 'imported';
  config: ConfigFile;
  filePath: string;
  importedAliases: string[];
  importedDefaults: Partial<
    Pick<ProfileConfig, 'default_project_id' | 'default_location'>
  >;
  previousDefault: string | undefined;
}

export type ConfigCommandResult =
  | ConfigImportedCommandResult
  | ConfigListCommandResult
  | ConfigRemovedCommandResult
  | ConfigSavedCommandResult
  | ConfigSetContextCommandResult
  | ConfigSetDefaultCommandResult;

interface ProfileValidator {
  validate(profile: ProfileConfig): Promise<unknown>;
}

interface ConfigStoreLike {
  readonly configPath: string;
  hasProfile(alias: string): Promise<boolean>;
  read(): Promise<ConfigFile>;
  removeProfile(alias: string): Promise<ConfigFile>;
  setDefault(alias: string): Promise<ConfigFile>;
  updateProfile(
    alias: string,
    patch: Partial<ProfileConfig>
  ): Promise<ConfigFile>;
  upsertProfile(alias: string, profile: ProfileConfig): Promise<ConfigFile>;
  write(config: ConfigFile): Promise<void>;
}

export interface ConfigServiceDependencies {
  confirm(message: string): Promise<boolean>;
  credentialValidator: ProfileValidator;
  isInteractive: boolean;
  prompt(message: string): Promise<string>;
  store: ConfigStoreLike;
}

export class ConfigService {
  constructor(private readonly dependencies: ConfigServiceDependencies) {}

  async addProfile(
    options: AddProfileInput
  ): Promise<ConfigSavedCommandResult> {
    validateOptionalContextDefaults(
      options.defaultProjectId,
      options.defaultLocation
    );

    const alias = options.alias.trim();
    const profile = buildProfileFromOptions(options);

    await this.dependencies.credentialValidator.validate(profile);
    const config = await this.dependencies.store.upsertProfile(alias, profile);

    return {
      action: 'saved',
      alias,
      config
    };
  }

  async importProfiles(
    options: ImportProfilesInput
  ): Promise<ConfigImportedCommandResult> {
    const filePath = options.file.trim();
    const importedSecrets = await readImportedProfiles(filePath);
    const importedAliases = Object.keys(importedSecrets).sort((left, right) =>
      left.localeCompare(right)
    );
    const canPrompt = this.canPromptForInput(options);
    const currentConfig = await this.dependencies.store.read();

    await this.confirmOverwriteIfNeeded(
      options,
      canPrompt,
      currentConfig,
      importedAliases
    );

    const importedProfiles: Record<string, ProfileConfig> = {};
    for (const alias of importedAliases) {
      const importedProfile = importedSecrets[alias];
      if (importedProfile === undefined) {
        throw new CliError(
          `Alias "${alias}" could not be resolved from the import file.`,
          {
            code: 'INVALID_IMPORT_ALIAS',
            exitCode: EXIT_CODES.config,
            suggestion:
              'Inspect the import file and retry with a valid alias map.'
          }
        );
      }

      importedProfiles[alias] = {
        api_key: importedProfile.api_key,
        auth_token: importedProfile.auth_token
      };
    }

    for (const alias of importedAliases) {
      await this.dependencies.credentialValidator.validate(
        getProfile(importedProfiles, alias)
      );
    }

    const importedDefaults = await this.resolveImportedDefaults(
      options,
      canPrompt
    );
    const nextProfiles = {
      ...currentConfig.profiles,
      ...applyImportedDefaults(importedProfiles, importedDefaults)
    };
    const nextConfig: ConfigFile =
      currentConfig.default === undefined
        ? {
            profiles: nextProfiles
          }
        : {
            profiles: nextProfiles,
            default: currentConfig.default
          };

    await this.dependencies.store.write(nextConfig);

    const defaultAlias = await this.resolveImportedDefaultAlias(
      options,
      canPrompt,
      currentConfig,
      importedAliases
    );
    const config =
      defaultAlias === undefined
        ? await this.dependencies.store.read()
        : await this.dependencies.store.setDefault(defaultAlias);

    return {
      action: 'imported',
      config,
      filePath,
      importedAliases,
      importedDefaults,
      previousDefault: currentConfig.default
    };
  }

  async listProfiles(): Promise<ConfigListCommandResult> {
    return {
      action: 'list',
      config: await this.dependencies.store.read()
    };
  }

  async removeProfile(
    options: RemoveProfileInput
  ): Promise<ConfigRemovedCommandResult> {
    const alias = options.alias.trim();

    await this.assertProfileExists(alias);

    return {
      action: 'removed',
      alias,
      config: await this.dependencies.store.removeProfile(alias)
    };
  }

  async setContext(
    options: SetContextInput
  ): Promise<ConfigSetContextCommandResult> {
    const alias = options.alias.trim();
    const defaultProjectId = normalizeOptionalString(options.defaultProjectId);
    const defaultLocation = normalizeOptionalString(options.defaultLocation);

    await this.assertProfileExists(alias);
    assertHasAtLeastOneContextValue(options);
    validateOptionalContextDefaults(defaultProjectId, defaultLocation);

    return {
      action: 'set-context',
      alias,
      config: await this.dependencies.store.updateProfile(alias, {
        ...(defaultProjectId === undefined
          ? {}
          : { default_project_id: defaultProjectId }),
        ...(defaultLocation === undefined
          ? {}
          : { default_location: defaultLocation })
      })
    };
  }

  async setDefault(
    options: SetDefaultInput
  ): Promise<ConfigSetDefaultCommandResult> {
    const alias = options.alias.trim();

    await this.assertProfileExists(alias);

    return {
      action: 'set-default',
      alias,
      config: await this.dependencies.store.setDefault(alias)
    };
  }

  private async assertProfileExists(alias: string): Promise<void> {
    const exists = await this.dependencies.store.hasProfile(alias);
    if (!exists) {
      throw new CliError(`Profile "${alias}" was not found.`, {
        code: 'PROFILE_NOT_FOUND',
        exitCode: EXIT_CODES.config,
        suggestion: 'Run `e2ectl config list` to inspect the saved aliases.'
      });
    }
  }

  private canPromptForInput(
    options: Pick<ImportProfilesInput, 'input'>
  ): boolean {
    return this.dependencies.isInteractive && (options.input ?? true);
  }

  private async confirmOverwriteIfNeeded(
    options: ImportProfilesInput,
    canPrompt: boolean,
    currentConfig: ConfigFile,
    importedAliases: string[]
  ): Promise<void> {
    const existingAliases = importedAliases.filter(
      (alias) => currentConfig.profiles[alias] !== undefined
    );

    if (existingAliases.length === 0 || (options.force ?? false)) {
      return;
    }

    if (!canPrompt) {
      throw new CliError(
        `Import would overwrite existing aliases: ${existingAliases.join(', ')}.`,
        {
          code: 'IMPORT_OVERWRITE_REQUIRED',
          exitCode: EXIT_CODES.config,
          suggestion:
            'Re-run with --force or use an interactive terminal to confirm overwriting.'
        }
      );
    }

    const confirmed = await this.dependencies.confirm(
      `Overwrite existing aliases: ${existingAliases.join(', ')}?`
    );

    if (!confirmed) {
      throw new CliError(
        'Import cancelled before overwriting existing aliases.',
        {
          code: 'IMPORT_CANCELLED',
          exitCode: EXIT_CODES.config,
          suggestion:
            'Re-run with --force if you want to replace the saved aliases.'
        }
      );
    }
  }

  private async resolveImportedDefaultAlias(
    options: ImportProfilesInput,
    canPrompt: boolean,
    currentConfig: ConfigFile,
    importedAliases: string[]
  ): Promise<string | undefined> {
    if (options.default !== undefined) {
      const defaultAlias = options.default.trim();
      if (!importedAliases.includes(defaultAlias)) {
        throw new CliError(
          `Default alias "${defaultAlias}" was not part of this import.`,
          {
            code: 'INVALID_IMPORT_DEFAULT_ALIAS',
            exitCode: EXIT_CODES.usage,
            suggestion: `Choose one of the imported aliases: ${importedAliases.join(', ')}.`
          }
        );
      }

      return defaultAlias;
    }

    if (currentConfig.default !== undefined || !canPrompt) {
      return undefined;
    }

    if (importedAliases.length === 1) {
      const alias = importedAliases[0];
      if (alias === undefined) {
        return undefined;
      }

      const confirmed = await this.dependencies.confirm(
        `Set "${alias}" as the default profile now?`
      );
      return confirmed ? alias : undefined;
    }

    const setDefault = await this.dependencies.confirm(
      'Set one of the imported aliases as the default profile now?'
    );
    if (!setDefault) {
      return undefined;
    }

    const enteredAlias = (
      await this.dependencies.prompt(
        `Default alias (${importedAliases.join(', ')}), or press Enter to skip: `
      )
    ).trim();
    if (enteredAlias.length === 0) {
      return undefined;
    }

    if (!importedAliases.includes(enteredAlias)) {
      throw new CliError(
        `Default alias "${enteredAlias}" was not part of this import.`,
        {
          code: 'INVALID_IMPORT_DEFAULT_ALIAS',
          exitCode: EXIT_CODES.usage,
          suggestion: `Choose one of the imported aliases: ${importedAliases.join(', ')}.`
        }
      );
    }

    return enteredAlias;
  }

  private async resolveImportedDefaults(
    options: ImportProfilesInput,
    canPrompt: boolean
  ): Promise<
    Partial<Pick<ProfileConfig, 'default_project_id' | 'default_location'>>
  > {
    const defaultProjectId =
      normalizeOptionalString(options.defaultProjectId) ??
      (canPrompt
        ? normalizeOptionalString(
            await this.dependencies.prompt(
              'Default project ID for imported aliases (press Enter to skip): '
            )
          )
        : undefined);
    const defaultLocation =
      normalizeOptionalString(options.defaultLocation) ??
      (canPrompt
        ? normalizeOptionalString(
            await this.dependencies.prompt(
              `Default location for imported aliases (${VALID_LOCATIONS.join('/')}, press Enter to skip): `
            )
          )
        : undefined);

    validateOptionalContextDefaults(defaultProjectId, defaultLocation);

    return {
      ...(defaultProjectId === undefined
        ? {}
        : {
            default_project_id: defaultProjectId
          }),
      ...(defaultLocation === undefined
        ? {}
        : {
            default_location: defaultLocation
          })
    };
  }
}

function applyImportedDefaults(
  profiles: Record<string, ProfileConfig>,
  defaults: Partial<
    Pick<ProfileConfig, 'default_project_id' | 'default_location'>
  >
): Record<string, ProfileConfig> {
  if (
    defaults.default_project_id === undefined &&
    defaults.default_location === undefined
  ) {
    return profiles;
  }

  return Object.fromEntries(
    Object.entries(profiles).map(([alias, profile]) => [
      alias,
      {
        ...profile,
        ...(defaults.default_project_id === undefined
          ? {}
          : {
              default_project_id: defaults.default_project_id
            }),
        ...(defaults.default_location === undefined
          ? {}
          : {
              default_location: defaults.default_location
            })
      }
    ])
  );
}

function assertHasAtLeastOneContextValue(options: SetContextInput): void {
  if (
    normalizeOptionalString(options.defaultProjectId) !== undefined ||
    normalizeOptionalString(options.defaultLocation) !== undefined
  ) {
    return;
  }

  throw new CliError('At least one default context value must be provided.', {
    code: 'MISSING_DEFAULT_CONTEXT',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass --default-project-id, --default-location, or both.'
  });
}

function buildProfileFromOptions(options: AddProfileInput): ProfileConfig {
  const defaultProjectId = normalizeOptionalString(options.defaultProjectId);
  const defaultLocation = normalizeOptionalString(options.defaultLocation);
  const profile: ProfileConfig = {
    api_key: options.apiKey.trim(),
    auth_token: options.authToken.trim()
  };

  if (defaultProjectId !== undefined) {
    profile.default_project_id = defaultProjectId;
  }

  if (defaultLocation !== undefined) {
    profile.default_location = defaultLocation;
  }

  return profile;
}

function getProfile(
  profiles: Record<string, ProfileConfig>,
  alias: string
): ProfileConfig {
  const profile = profiles[alias];
  if (profile === undefined) {
    throw new CliError(`Profile "${alias}" could not be resolved.`, {
      code: 'PROFILE_NOT_FOUND',
      exitCode: EXIT_CODES.config,
      suggestion:
        'Retry the command or inspect the saved aliases with `e2ectl config list`.'
    });
  }

  return profile;
}

function normalizeOptionalString(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function validateOptionalContextDefaults(
  defaultProjectId?: string,
  defaultLocation?: string
): void {
  const normalizedProjectId = normalizeOptionalString(defaultProjectId);
  if (normalizedProjectId !== undefined && !/^\d+$/.test(normalizedProjectId)) {
    throw new CliError('Default project ID must be numeric.', {
      code: 'INVALID_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass a numeric value with --default-project-id or leave it unset.'
    });
  }

  const normalizedLocation = normalizeOptionalString(defaultLocation);
  if (
    normalizedLocation !== undefined &&
    !VALID_LOCATIONS.includes(
      normalizedLocation as (typeof VALID_LOCATIONS)[number]
    )
  ) {
    throw new CliError(
      `Unsupported default location "${normalizedLocation}".`,
      {
        code: 'INVALID_LOCATION',
        details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Pass a supported location with --default-location or leave it unset.'
      }
    );
  }
}
