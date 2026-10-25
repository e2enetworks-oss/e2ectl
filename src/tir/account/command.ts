import { Command } from 'commander';

import { addAliasOption } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { renderTirAccountResult } from './formatter.js';
import { TirAccountService } from './service.js';
import type { TirAccountContextOptions } from './types.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildTirAccountCommand(runtime: CliRuntime): Command {
  const service = new TirAccountService({
    createTirAccountClient: (credentials) =>
      runtime.createTirAccountClient(credentials),
    store: runtime.store
  });
  const command = new Command('account').description(
    'List the TIR accounts your key can work in.'
  );

  command.helpCommand('help [command]', 'Show help for a tir account command');

  addAliasOption(
    command
      .command('list')
      .description(
        'List the accounts your key can use, with your role and whether TIR is on for each.'
      )
  ).action(
    async (options: TirAccountContextOptions, commandInstance: Command) => {
      const result = await service.list(options);
      runtime.stdout.write(
        renderTirAccountResult(
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
