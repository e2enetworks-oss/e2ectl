import { Command } from 'commander';

import { addAliasOption } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { renderTirProjectResult } from './formatter.js';
import { TirProjectService } from './service.js';
import type { TirConfigureOptions, TirProjectContextOptions } from './types.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildTirProjectCommand(runtime: CliRuntime): Command {
  const service = createService(runtime);
  const command = new Command('project').description(
    'List the projects in a TIR account.'
  );

  command.helpCommand('help [command]', 'Show help for a tir project command');

  addAliasOption(
    command
      .command('list')
      .description(
        'List the projects in a TIR account: the one passed with --account-id, set in E2E_TIR_ACCOUNT_ID, or saved by tir configure.'
      )
      .option(
        '--account-id <accountId>',
        'TIR account id (from tir account list).'
      )
  ).action(
    async (options: TirProjectContextOptions, commandInstance: Command) => {
      const result = await service.list(options);
      runtime.stdout.write(
        renderTirProjectResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

export function buildTirConfigureCommand(runtime: CliRuntime): Command {
  const service = createService(runtime);

  return addAliasOption(
    new Command('configure')
      .description(
        'Check a TIR account, project and location, then save them in the profile. Every later tir command uses them unless a flag or E2E_TIR_* variable says otherwise.'
      )
      .requiredOption(
        '--account-id <accountId>',
        'TIR account id (from tir account list).'
      )
      .requiredOption(
        '--project-id <projectId>',
        'TIR project id (from tir project list).'
      )
      .requiredOption('--location <location>', 'Delhi or Chennai.')
  ).action(async (options: TirConfigureOptions, commandInstance: Command) => {
    const result = await service.configure(options);
    runtime.stdout.write(
      renderTirProjectResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });
}

function createService(runtime: CliRuntime): TirProjectService {
  return new TirProjectService({
    createTirAccountClient: (credentials) =>
      runtime.createTirAccountClient(credentials),
    createTirProjectClient: (credentials) =>
      runtime.createTirProjectClient(credentials),
    store: runtime.store
  });
}
