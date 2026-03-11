import { Command } from 'commander';

import { readImportedProfiles } from '../config/import-file.js';
import type { CliRuntime } from '../runtime.js';
import type { ConfigFile, ProfileConfig } from '../types/config.js';
import { VALID_LOCATIONS } from '../types/config.js';
import {
  formatJson,
  formatProfilesTable,
  summarizeProfiles
} from '../output/formatter.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

interface ConfigCommandOptions {
  alias: string;
  apiKey: string;
  authToken: string;
  defaultLocation?: string;
  defaultProjectId?: string;
}

interface GlobalOptions {
  json?: boolean;
}

interface ImportCommandOptions {
  default?: string;
  defaultLocation?: string;
  defaultProjectId?: string;
  file: string;
  force?: boolean;
  input?: boolean;
}

interface RemoveCommandOptions {
  alias: string;
}

interface SetContextCommandOptions {
  alias: string;
  defaultLocation?: string;
  defaultProjectId?: string;
}

interface SetDefaultCommandOptions {
  alias: string;
}

export function buildConfigCommand(runtime: CliRuntime): Command {
  const command = new Command('config').description(
    'Manage local e2ectl profiles and per-alias defaults.'
  );

  command.helpCommand('help [command]', 'Show help for a config command');

  command
    .command('add')
    .description(
      'Add or update a saved auth profile after validating the API key and token.'
    )
    .requiredOption('--alias <alias>', 'Profile alias to save.')
    .requiredOption('--api-key <apiKey>', 'MyAccount API key for the profile.')
    .requiredOption(
      '--auth-token <authToken>',
      'MyAccount bearer token for the profile.'
    )
    .option(
      '--default-project-id <projectId>',
      'Optional default project id to use when commands omit --project-id.'
    )
    .option(
      '--default-location <location>',
      'Optional default location (Delhi or Chennai) to use when commands omit --location.'
    )
    .action(async (options: ConfigCommandOptions, commandInstance: Command) => {
      validateProfileInput(options);

      const alias = options.alias.trim();
      const profile = buildProfileFromOptions(options);

      await runtime.credentialValidator.validate(profile);
      const nextConfig = await runtime.store.upsertProfile(alias, profile);

      writeConfigOutput(
        runtime,
        commandInstance.optsWithGlobals<GlobalOptions>(),
        {
          action: 'saved',
          default: nextConfig.default,
          profiles: summarizeProfiles(nextConfig)
        },
        `Saved profile "${alias}".`
      );
    });

  command
    .command('import')
    .description(
      'Import aliases from a downloaded credential JSON file and optionally save shared default project/location values.'
    )
    .requiredOption('--file <path>', 'Path to the downloaded credential file.')
    .option(
      '--default-project-id <projectId>',
      'Optional default project id to apply to every imported alias.'
    )
    .option(
      '--default-location <location>',
      'Optional default location (Delhi or Chennai) to apply to every imported alias.'
    )
    .option('--default <alias>', 'Alias to make default after import.')
    .option('--force', 'Overwrite existing aliases without confirmation.')
    .option(
      '--no-input',
      'Disable prompts for default selection and optional default context.'
    )
    .action(async (options: ImportCommandOptions, commandInstance: Command) => {
      const importedSecrets = await readImportedProfiles(options.file.trim());
      const importedAliases = Object.keys(importedSecrets).sort((left, right) =>
        left.localeCompare(right)
      );
      const canPrompt = canPromptForInput(runtime, options);
      const currentConfig = await runtime.store.read();

      await confirmOverwriteIfNeeded(
        runtime,
        options,
        canPrompt,
        currentConfig,
        importedAliases
      );

      const importedProfiles: Record<string, ProfileConfig> =
        Object.fromEntries(
          importedAliases.map((alias) => {
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

            return [
              alias,
              {
                api_key: importedProfile.api_key,
                auth_token: importedProfile.auth_token
              } satisfies ProfileConfig
            ] as const;
          })
        );

      for (const alias of importedAliases) {
        await runtime.credentialValidator.validate(
          getProfile(importedProfiles, alias)
        );
      }

      const importedDefaults = await resolveImportedDefaults(
        runtime,
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

      await runtime.store.write(nextConfig);

      if (!(commandInstance.optsWithGlobals<GlobalOptions>().json ?? false)) {
        runtime.stdout.write(
          formatImportSuccessMessage(options.file.trim(), importedAliases)
        );
      }

      const defaultAlias = await resolveImportedDefaultAlias(
        runtime,
        options,
        canPrompt,
        currentConfig,
        importedAliases
      );
      const finalConfig =
        defaultAlias === undefined
          ? await runtime.store.read()
          : await runtime.store.setDefault(defaultAlias);

      writeImportOutput(
        runtime,
        commandInstance.optsWithGlobals<GlobalOptions>(),
        {
          config: finalConfig,
          defaultAlias,
          importedAliases,
          importedDefaults,
          previousDefault: currentConfig.default
        }
      );
    });

  command
    .command('list')
    .description('List saved profiles with masked secrets and default context.')
    .action(
      async (_options: Record<string, never>, commandInstance: Command) => {
        const config = await runtime.store.read();
        const summaries = summarizeProfiles(config);

        writeConfigOutput(
          runtime,
          commandInstance.optsWithGlobals<GlobalOptions>(),
          {
            action: 'list',
            default: config.default,
            profiles: summaries
          },
          summaries.length === 0
            ? 'No profiles saved.'
            : formatProfilesTable(summaries)
        );
      }
    );

  command
    .command('set-context')
    .description(
      'Set or update the default project id/location for a saved profile.'
    )
    .requiredOption('--alias <alias>', 'Profile alias to update.')
    .option(
      '--default-project-id <projectId>',
      'Default project id to save for this profile.'
    )
    .option(
      '--default-location <location>',
      'Default location (Delhi or Chennai) to save for this profile.'
    )
    .action(
      async (options: SetContextCommandOptions, commandInstance: Command) => {
        const alias = options.alias.trim();
        const defaultProjectId = normalizeOptionalString(
          options.defaultProjectId
        );
        const defaultLocation = normalizeOptionalString(
          options.defaultLocation
        );

        await assertProfileExists(runtime, alias);
        assertHasAtLeastOneContextValue(options);
        validateOptionalContextDefaults(defaultProjectId, defaultLocation);

        const nextConfig = await runtime.store.updateProfile(alias, {
          ...(defaultProjectId === undefined
            ? {}
            : { default_project_id: defaultProjectId }),
          ...(defaultLocation === undefined
            ? {}
            : { default_location: defaultLocation })
        });

        writeConfigOutput(
          runtime,
          commandInstance.optsWithGlobals<GlobalOptions>(),
          {
            action: 'set-context',
            default: nextConfig.default,
            profiles: summarizeProfiles(nextConfig)
          },
          `Updated default context for "${alias}".`
        );
      }
    );

  command
    .command('set-default')
    .description('Set the default saved profile.')
    .requiredOption('--alias <alias>', 'Profile alias to make default.')
    .action(
      async (options: SetDefaultCommandOptions, commandInstance: Command) => {
        const alias = options.alias.trim();
        await assertProfileExists(runtime, alias);
        const nextConfig = await runtime.store.setDefault(alias);

        writeConfigOutput(
          runtime,
          commandInstance.optsWithGlobals<GlobalOptions>(),
          {
            action: 'set-default',
            default: nextConfig.default,
            profiles: summarizeProfiles(nextConfig)
          },
          `Set "${alias}" as the default profile.`
        );
      }
    );

  command
    .command('remove')
    .description('Remove a saved profile.')
    .requiredOption('--alias <alias>', 'Profile alias to remove.')
    .action(async (options: RemoveCommandOptions, commandInstance: Command) => {
      const alias = options.alias.trim();
      await assertProfileExists(runtime, alias);
      const nextConfig = await runtime.store.removeProfile(alias);

      writeConfigOutput(
        runtime,
        commandInstance.optsWithGlobals<GlobalOptions>(),
        {
          action: 'removed',
          default: nextConfig.default,
          profiles: summarizeProfiles(nextConfig)
        },
        `Removed profile "${alias}".`
      );
    });

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildProfileFromOptions(options: ConfigCommandOptions): ProfileConfig {
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

function validateProfileInput(options: ConfigCommandOptions): void {
  validateOptionalContextDefaults(
    options.defaultProjectId,
    options.defaultLocation
  );
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

async function assertProfileExists(
  runtime: CliRuntime,
  alias: string
): Promise<void> {
  const exists = await runtime.store.hasProfile(alias);
  if (!exists) {
    throw new CliError(`Profile "${alias}" was not found.`, {
      code: 'PROFILE_NOT_FOUND',
      exitCode: EXIT_CODES.config,
      suggestion: 'Run `e2ectl config list` to inspect the saved aliases.'
    });
  }
}

function assertHasAtLeastOneContextValue(
  options: SetContextCommandOptions
): void {
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

function writeConfigOutput(
  runtime: CliRuntime,
  options: GlobalOptions,
  payload: {
    action: string;
    default: ConfigFile['default'];
    profiles: ReturnType<typeof summarizeProfiles>;
  },
  humanOutput: string
): void {
  if (options.json ?? false) {
    runtime.stdout.write(
      formatJson({
        action: payload.action,
        default: payload.default ?? null,
        profiles: payload.profiles
      })
    );
    return;
  }

  runtime.stdout.write(`${humanOutput}\n`);
}

function writeImportOutput(
  runtime: CliRuntime,
  options: GlobalOptions,
  payload: {
    config: ConfigFile;
    defaultAlias: string | undefined;
    importedAliases: string[];
    importedDefaults: Partial<
      Pick<ProfileConfig, 'default_project_id' | 'default_location'>
    >;
    previousDefault: string | undefined;
  }
): void {
  if (options.json ?? false) {
    runtime.stdout.write(
      formatJson({
        action: 'imported',
        default: payload.config.default ?? null,
        imported_aliases: payload.importedAliases,
        imported_count: payload.importedAliases.length,
        saved_default_location:
          payload.importedDefaults.default_location ?? null,
        saved_default_project_id:
          payload.importedDefaults.default_project_id ?? null,
        profiles: summarizeProfiles(payload.config)
      })
    );
    return;
  }

  if (
    payload.config.default !== undefined &&
    payload.config.default !== payload.previousDefault
  ) {
    runtime.stdout.write(
      `Set "${payload.config.default}" as the default profile.\n`
    );
  } else if (payload.config.default !== undefined) {
    runtime.stdout.write(
      `Default profile remains "${payload.config.default}".\n`
    );
  } else {
    runtime.stdout.write('No default profile was set.\n');
  }

  if (payload.importedDefaults.default_project_id !== undefined) {
    runtime.stdout.write(
      `Saved default project ID "${payload.importedDefaults.default_project_id}" for imported aliases.\n`
    );
  }

  if (payload.importedDefaults.default_location !== undefined) {
    runtime.stdout.write(
      `Saved default location "${payload.importedDefaults.default_location}" for imported aliases.\n`
    );
  }
}

function formatImportSuccessMessage(
  filePath: string,
  aliases: string[]
): string {
  const noun = aliases.length === 1 ? 'profile' : 'profiles';
  return `Imported ${aliases.length} ${noun} from "${filePath}".\nSaved aliases: ${aliases.join(', ')}.\n`;
}

function canPromptForInput(
  runtime: CliRuntime,
  options: Pick<ImportCommandOptions, 'input'>
): boolean {
  return runtime.isInteractive && (options.input ?? true);
}

async function confirmOverwriteIfNeeded(
  runtime: CliRuntime,
  options: ImportCommandOptions,
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

  const confirmed = await runtime.confirm(
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

async function resolveImportedDefaultAlias(
  runtime: CliRuntime,
  options: ImportCommandOptions,
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
    const confirmed = await runtime.confirm(
      `Set "${alias}" as the default profile now?`
    );
    return confirmed ? alias : undefined;
  }

  const setDefault = await runtime.confirm(
    'Set one of the imported aliases as the default profile now?'
  );
  if (!setDefault) {
    return undefined;
  }

  const enteredAlias = (
    await runtime.prompt(
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

async function resolveImportedDefaults(
  runtime: CliRuntime,
  options: ImportCommandOptions,
  canPrompt: boolean
): Promise<
  Partial<Pick<ProfileConfig, 'default_project_id' | 'default_location'>>
> {
  const defaultProjectId =
    normalizeOptionalString(options.defaultProjectId) ??
    (canPrompt
      ? normalizeOptionalString(
          await runtime.prompt(
            'Default project ID for imported aliases (press Enter to skip): '
          )
        )
      : undefined);
  const defaultLocation =
    normalizeOptionalString(options.defaultLocation) ??
    (canPrompt
      ? normalizeOptionalString(
          await runtime.prompt(
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
