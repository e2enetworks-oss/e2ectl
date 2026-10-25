import { Command } from 'commander';

import { addAliasOption } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { renderPlatformSetupResult } from '../../config/index.js';
import { renderTirProjectResult } from './formatter.js';
import { TirProjectService } from './service.js';
import { formatTirCommand } from '../api.js';
import { configureTir } from './configure.js';
import type { TirProjectContextOptions } from './types.js';

interface TirConfigureOptions {
  accountId?: string;
  alias?: string;
  location?: string;
  projectId?: string;
}

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
  return addAliasOption(
    new Command('configure')
      .description(
        'Choose the TIR account, project and location and save them in the profile. Every later tir command uses them unless a flag or E2E_TIR_* variable says otherwise. Asks in a terminal; give the flags in scripts.'
      )
      .option(
        '--account-id <accountId>',
        'TIR account id (from tir account list).'
      )
      .option(
        '--project-id <projectId>',
        'TIR project id (from tir project list).'
      )
      .option('--location <location>', 'Delhi or Chennai.')
      .addHelpText(
        'after',
        `\nExample:\n  ${formatTirCommand('configure --account-id 12 --project-id 34 --location Delhi')}\n`
      )
  ).action(async (options: TirConfigureOptions, commandInstance: Command) => {
    const json = commandInstance.optsWithGlobals<GlobalOptions>().json ?? false;
    const result = await configureTir(runtime, {
      alias: options.alias,
      canPrompt: runtime.isInteractive && !json,
      flagPrefix: '',
      values: {
        account: options.accountId,
        location: options.location,
        project: options.projectId
      }
    });
    runtime.stdout.write(renderPlatformSetupResult(result, json));
  });
}

function createService(runtime: CliRuntime): TirProjectService {
  return new TirProjectService({
    createTirProjectClient: (credentials) =>
      runtime.createTirProjectClient(credentials),
    store: runtime.store
  });
}
