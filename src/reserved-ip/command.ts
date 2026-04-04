import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderReservedIpResult } from './formatter.js';
import {
  ReservedIpService,
  type ReservedIpCreateOptions,
  type ReservedIpContextOptions,
  type ReservedIpDeleteOptions,
  type ReservedIpNodeActionOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildReservedIpCommand(runtime: CliRuntime): Command {
  const service = new ReservedIpService({
    confirm: (message) => runtime.confirm(message),
    createNodeClient: (credentials) => runtime.createNodeClient(credentials),
    createReservedIpClient: (credentials) =>
      runtime.createReservedIpClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('reserved-ip').description(
    'Manage MyAccount reserved IP addresses.'
  );

  command.helpCommand('help [command]', 'Show help for a reserved-ip command');

  addContextOptions(
    command.command('list').description('List reserved IPs.')
  ).action(
    async (options: ReservedIpContextOptions, commandInstance: Command) => {
      const result = await service.listReservedIps(options);
      runtime.stdout.write(
        renderReservedIpResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('get <ipAddress>')
      .description('Get details for one reserved IP by ip_address.')
  ).action(
    async (
      ipAddress: string,
      options: ReservedIpContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getReservedIp(ipAddress, options);
      runtime.stdout.write(
        renderReservedIpResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('create')
      .description('Reserve a new IP.')
      .option(
        '--from-node <nodeId>',
        'Reserve the current public IP from the given e2ectl node id.'
      )
  ).action(
    async (options: ReservedIpCreateOptions, commandInstance: Command) => {
      const result = await service.createReservedIp(options);
      runtime.stdout.write(
        renderReservedIpResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <ipAddress>')
      .description('Delete a reserved IP.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      ipAddress: string,
      options: ReservedIpDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteReservedIp(ipAddress, options);
      runtime.stdout.write(
        renderReservedIpResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.addCommand(buildReservedIpAttachCommand(service, runtime));
  command.addCommand(buildReservedIpDetachCommand(service, runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildReservedIpAttachCommand(
  service: ReservedIpService,
  runtime: CliRuntime
): Command {
  const command = new Command('attach').description(
    'Attach a reserved IP to a supported target.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a reserved-ip attach command'
  );

  addContextOptions(
    command
      .command('node <ipAddress>')
      .description('Attach a reserved IP to a node.')
      .requiredOption(
        '--node-id <nodeId>',
        'Node id shown by e2ectl node list/get.'
      )
  ).action(
    async (
      ipAddress: string,
      options: ReservedIpNodeActionOptions,
      commandInstance: Command
    ) => {
      const result = await service.attachReservedIpToNode(ipAddress, options);
      runtime.stdout.write(
        renderReservedIpResult(
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

function buildReservedIpDetachCommand(
  service: ReservedIpService,
  runtime: CliRuntime
): Command {
  const command = new Command('detach').description(
    'Detach a reserved IP from a supported target.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a reserved-ip detach command'
  );

  addContextOptions(
    command
      .command('node <ipAddress>')
      .description('Detach a reserved IP from a node.')
      .requiredOption(
        '--node-id <nodeId>',
        'Node id shown by e2ectl node list/get.'
      )
  ).action(
    async (
      ipAddress: string,
      options: ReservedIpNodeActionOptions,
      commandInstance: Command
    ) => {
      const result = await service.detachReservedIpFromNode(ipAddress, options);
      runtime.stdout.write(
        renderReservedIpResult(
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
