import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import type { CliRuntime } from '../app/index.js';
import { renderSshKeyResult } from './formatter.js';
import {
  SshKeyService,
  type SshKeyContextOptions,
  type SshKeyCreateOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildSshKeyCommand(runtime: CliRuntime): Command {
  const service = new SshKeyService({
    createSshKeyClient: (credentials) =>
      runtime.createSshKeyClient(credentials),
    readPublicKeyFile: async (path) => await readFile(path, 'utf8'),
    readPublicKeyFromStdin: readAllFromStdin,
    store: runtime.store
  });
  const command = new Command('ssh-key').description(
    'Manage MyAccount SSH public keys.'
  );

  command.helpCommand('help [command]', 'Show help for an ssh-key command');

  command
    .command('list')
    .description(
      'List SSH keys for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: SshKeyContextOptions, commandInstance: Command) => {
      const result = await service.listSshKeys(options);
      runtime.stdout.write(
        renderSshKeyResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('create')
    .description('Create an SSH key from a public key file or stdin.')
    .requiredOption('--label <label>', 'Label for the SSH key.')
    .requiredOption(
      '--public-key-file <path>',
      'Path to the public key file, or - to read from stdin.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: SshKeyCreateOptions, commandInstance: Command) => {
      const result = await service.createSshKey(options);
      runtime.stdout.write(
        renderSshKeyResult(
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

async function readAllFromStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');

  let buffer = '';
  for await (const chunk of process.stdin) {
    buffer += chunk;
  }

  return buffer;
}
