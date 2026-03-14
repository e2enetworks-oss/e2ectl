import { Command } from 'commander';

import { CLI_COMMAND_NAME } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderConfigResult } from './formatter.js';
import {
  ConfigService,
  type AddProfileInput,
  type ImportProfilesInput,
  type RemoveProfileInput,
  type SetContextInput,
  type SetDefaultInput
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildConfigCommand(runtime: CliRuntime): Command {
  const service = new ConfigService({
    confirm: (message) => runtime.confirm(message),
    credentialValidator: runtime.credentialValidator,
    isInteractive: runtime.isInteractive,
    prompt: (message) => runtime.prompt(message),
    store: runtime.store
  });
  const command = new Command('config').description(
    `Manage local ${CLI_COMMAND_NAME} profiles and per-alias defaults.`
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
    .action(async (options: AddProfileInput, commandInstance: Command) => {
      const result = await service.addProfile(options);
      runtime.stdout.write(
        renderConfigResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
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
    .action(async (options: ImportProfilesInput, commandInstance: Command) => {
      const result = await service.importProfiles(options);
      runtime.stdout.write(
        renderConfigResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('list')
    .description('List saved profiles with masked secrets and default context.')
    .action(
      async (_options: Record<string, never>, commandInstance: Command) => {
        const result = await service.listProfiles();
        runtime.stdout.write(
          renderConfigResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
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
    .action(async (options: SetContextInput, commandInstance: Command) => {
      const result = await service.setContext(options);
      runtime.stdout.write(
        renderConfigResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('set-default')
    .description('Set the default saved profile.')
    .requiredOption('--alias <alias>', 'Profile alias to make default.')
    .action(async (options: SetDefaultInput, commandInstance: Command) => {
      const result = await service.setDefault(options);
      runtime.stdout.write(
        renderConfigResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('remove')
    .description('Remove a saved profile.')
    .requiredOption('--alias <alias>', 'Profile alias to remove.')
    .action(async (options: RemoveProfileInput, commandInstance: Command) => {
      const result = await service.removeProfile(options);
      runtime.stdout.write(
        renderConfigResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
