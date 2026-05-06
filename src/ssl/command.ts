import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderSslResult } from './formatter.js';
import { SslService } from './service.js';
import type { SslContextOptions } from './types/index.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildSslCommand(runtime: CliRuntime): Command {
  const service = new SslService({
    createSslClient: (credentials) => runtime.createSslClient(credentials),
    store: runtime.store
  });
  const command = new Command('ssl').description(
    'Manage MyAccount SSL certificate metadata.'
  );

  command.helpCommand('help [command]', 'Show help for an ssl command');

  addContextOptions(
    command
      .command('list')
      .description('List SSL certificates and their certificate IDs.')
  ).action(async (options: SslContextOptions, commandInstance: Command) => {
    const result = await service.listCertificates(options);
    runtime.stdout.write(
      renderSslResult(
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
