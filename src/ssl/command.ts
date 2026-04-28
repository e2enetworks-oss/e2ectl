import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { CliRuntime } from '../app/index.js';
import { renderSslResult } from './formatter.js';
import { SslService, type SslContextOptions } from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildSslCommand(runtime: CliRuntime): Command {
  const service = new SslService({
    createSslClient: (credentials) => {
      if (runtime.createSslClient === undefined) {
        throw new CliError('SSL client is not available in this runtime.', {
          code: 'SSL_CLIENT_UNAVAILABLE',
          exitCode: EXIT_CODES.general
        });
      }

      return runtime.createSslClient(credentials);
    },
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
