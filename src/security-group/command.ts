import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderSecurityGroupResult } from './formatter.js';
import {
  SecurityGroupService,
  type SecurityGroupContextOptions,
  type SecurityGroupCreateOptions,
  type SecurityGroupDeleteOptions,
  type SecurityGroupUpdateOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildSecurityGroupCommand(runtime: CliRuntime): Command {
  const service = new SecurityGroupService({
    confirm: (message) => runtime.confirm(message),
    createSecurityGroupClient: (credentials) =>
      runtime.createSecurityGroupClient(credentials),
    isInteractive: runtime.isInteractive,
    readRulesFile: async (path) => await readFile(path, 'utf8'),
    readRulesFromStdin: readAllFromStdin,
    store: runtime.store
  });
  const command = new Command('security-group').description(
    'Manage MyAccount security groups.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a security-group command'
  );

  addContextOptions(
    command
      .command('list')
      .description(
        'List security groups for the selected profile or environment credentials.'
      )
  ).action(
    async (options: SecurityGroupContextOptions, commandInstance: Command) => {
      const result = await service.listSecurityGroups(options);
      runtime.stdout.write(
        renderSecurityGroupResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('get <securityGroupId>')
      .description('Get details for a security group.')
  ).action(
    async (
      securityGroupId: string,
      options: SecurityGroupContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getSecurityGroup(securityGroupId, options);
      runtime.stdout.write(
        renderSecurityGroupResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('create')
      .description(
        'Create a security group from a backend-compatible JSON rules file or stdin.'
      )
      .requiredOption('--name <name>', 'Security group name.')
      .requiredOption(
        '--rules-file <path>',
        'Path to the JSON rules file, or - to read from stdin.'
      )
      .option('--description <text>', 'Optional security group description.')
      .option('--default', 'Mark the new security group as default.')
  ).action(
    async (options: SecurityGroupCreateOptions, commandInstance: Command) => {
      const result = await service.createSecurityGroup(options);
      runtime.stdout.write(
        renderSecurityGroupResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('update <securityGroupId>')
      .description(
        'Replace the full desired security-group rule set from a backend-compatible JSON rules file or stdin.'
      )
      .requiredOption('--name <name>', 'Security group name.')
      .requiredOption(
        '--rules-file <path>',
        'Path to the JSON rules file, or - to read from stdin.'
      )
      .option(
        '--description <text>',
        'Optional description override. Omit to keep the current description.'
      )
  ).action(
    async (
      securityGroupId: string,
      options: SecurityGroupUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.updateSecurityGroup(
        securityGroupId,
        options
      );
      runtime.stdout.write(
        renderSecurityGroupResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <securityGroupId>')
      .description('Delete a security group.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      securityGroupId: string,
      options: SecurityGroupDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteSecurityGroup(
        securityGroupId,
        options
      );
      runtime.stdout.write(
        renderSecurityGroupResult(
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

async function readAllFromStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');

  let buffer = '';
  for await (const chunk of process.stdin) {
    buffer += chunk;
  }

  return buffer;
}
