import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderDnsResult } from './formatter.js';
import {
  DnsService,
  type DnsContextOptions,
  type DnsCreateOptions,
  type DnsDeleteOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildDnsCommand(runtime: CliRuntime): Command {
  const service = new DnsService({
    confirm: (message) => runtime.confirm(message),
    createDnsClient: (credentials) => runtime.createDnsClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('dns').description(
    'Manage MyAccount forward DNS zones and diagnostics.'
  );

  command.helpCommand('help [command]', 'Show help for a dns command');

  addContextOptions(
    command
      .command('list')
      .description('List forward DNS domains for the selected project.')
  ).action(async (options: DnsContextOptions, commandInstance: Command) => {
    const result = await service.listDomains(options);
    runtime.stdout.write(
      renderDnsResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('get <domainName>')
      .description('Get one forward DNS zone by domain name.')
  ).action(
    async (
      domainName: string,
      options: DnsContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getDomain(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('create <domainName>')
      .description('Create a forward DNS zone pointing at an IPv4 address.')
      .requiredOption('--ip <ipv4>', 'IPv4 address for the apex A record.')
  ).action(
    async (
      domainName: string,
      options: DnsCreateOptions,
      commandInstance: Command
    ) => {
      const result = await service.createDomain(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <domainName>')
      .description('Delete a forward DNS zone.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      domainName: string,
      options: DnsDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteDomain(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  const verifyCommand = command
    .command('verify')
    .description('Run forward DNS backend diagnostics.');

  verifyCommand.helpCommand(
    'help [command]',
    'Show help for a dns verify command'
  );

  addContextOptions(
    verifyCommand
      .command('ns <domainName>')
      .description('Verify nameserver authority for a forward DNS domain.')
  ).action(
    async (
      domainName: string,
      options: DnsContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.verifyNameservers(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    verifyCommand
      .command('validity <domainName>')
      .description('Verify the stored domain validity window.')
  ).action(
    async (
      domainName: string,
      options: DnsContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.verifyValidity(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    verifyCommand
      .command('ttl <domainName>')
      .description('Verify whether any rrsets use low TTL values.')
  ).action(
    async (
      domainName: string,
      options: DnsContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.verifyTtl(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  verifyCommand.action(() => {
    verifyCommand.outputHelp();
  });

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
