import { Command } from 'commander';
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
  projectId: string;
  location: string;
}

interface GlobalOptions {
  json?: boolean;
}

interface RemoveCommandOptions {
  alias: string;
}

interface SetDefaultCommandOptions {
  alias: string;
}

export function buildConfigCommand(runtime: CliRuntime): Command {
  const command = new Command('config').description(
    'Manage local e2ectl profiles and authentication settings.'
  );

  command.helpCommand('help [command]', 'Show help for a config command');

  command
    .command('add')
    .description(
      'Add or update a saved profile after validating the credentials.'
    )
    .requiredOption('--alias <alias>', 'Profile alias to save.')
    .requiredOption('--api-key <apiKey>', 'MyAccount API key for the profile.')
    .requiredOption(
      '--auth-token <authToken>',
      'MyAccount bearer token for the profile.'
    )
    .requiredOption('--project-id <projectId>', 'MyAccount project id.')
    .requiredOption(
      '--location <location>',
      'MyAccount location (Delhi or Chennai).'
    )
    .action(async (options: ConfigCommandOptions, commandInstance: Command) => {
      validateProfileInput(options);

      const alias = options.alias.trim();
      const profile: ProfileConfig = {
        api_key: options.apiKey.trim(),
        auth_token: options.authToken.trim(),
        project_id: options.projectId.trim(),
        location: options.location.trim()
      };

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
    .command('list')
    .description('List saved profiles with masked credentials.')
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

function validateProfileInput(options: ConfigCommandOptions): void {
  if (
    !VALID_LOCATIONS.includes(
      options.location.trim() as (typeof VALID_LOCATIONS)[number]
    )
  ) {
    throw new CliError(`Unsupported location "${options.location}".`, {
      code: 'INVALID_LOCATION',
      details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
      exitCode: EXIT_CODES.usage,
      suggestion: 'Use one of the supported locations from the MyAccount API.'
    });
  }

  if (!/^\d+$/.test(options.projectId.trim())) {
    throw new CliError('Project ID must be numeric.', {
      code: 'INVALID_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric MyAccount project id with --project-id.'
    });
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
