import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderDnsResult } from './formatter.js';
import {
  DnsService,
  type DnsContextOptions,
  type DnsCreateOptions,
  type DnsDeleteOptions,
  type DnsRecordCreateOptions,
  type DnsRecordDeleteOptions,
  type DnsRecordUpdateOptions
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

  addContextOptions(
    command
      .command('nameservers <domainName>')
      .description(
        'Compare configured zone nameservers with the current delegated nameservers.'
      )
  ).action(
    async (
      domainName: string,
      options: DnsContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getNameservers(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  command.addCommand(buildDnsRecordCommand(service, runtime));

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

function buildDnsRecordCommand(
  service: DnsService,
  runtime: CliRuntime
): Command {
  const command = new Command('record').description(
    'Manage forward DNS records within an existing DNS zone.'
  );

  command.helpCommand('help [command]', 'Show help for a dns record command');

  addContextOptions(
    command
      .command('list <domainName>')
      .description('List forward DNS records for one zone.')
  ).action(
    async (
      domainName: string,
      options: DnsContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.listRecords(domainName, options);
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
      .description('Create a forward DNS record.')
      .requiredOption(
        '--type <type>',
        'Record type: A, AAAA, CNAME, MX, TXT, or SRV.'
      )
      .option(
        '--name <host>',
        'Record name within the zone. Use @ for apex.',
        '@'
      )
      .option('--value <value>', 'Value for A, AAAA, CNAME, or TXT records.')
      .option('--exchange <host>', 'MX exchange host.')
      .option('--priority <number>', 'MX or SRV priority.')
      .option('--weight <number>', 'SRV weight.')
      .option('--port <number>', 'SRV port.')
      .option('--target <host>', 'SRV target host.')
      .option('--ttl <seconds>', 'Optional record TTL in seconds.')
  ).action(
    async (
      domainName: string,
      options: DnsRecordCreateOptions,
      commandInstance: Command
    ) => {
      const result = await service.createRecord(domainName, options);
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
      .command('update <domainName>')
      .description('Update one forward DNS record by its exact current value.')
      .requiredOption(
        '--type <type>',
        'Record type: A, AAAA, CNAME, MX, TXT, or SRV.'
      )
      .option(
        '--name <host>',
        'Record name within the zone. Use @ for apex.',
        '@'
      )
      .requiredOption(
        '--current-value <value>',
        'Exact current value shown by e2ectl dns record list.'
      )
      .option(
        '--value <value>',
        'New value for A, AAAA, CNAME, or TXT records.'
      )
      .option('--exchange <host>', 'New MX exchange host.')
      .option('--priority <number>', 'New MX or SRV priority.')
      .option('--weight <number>', 'New SRV weight.')
      .option('--port <number>', 'New SRV port.')
      .option('--target <host>', 'New SRV target host.')
      .option(
        '--ttl <seconds>',
        'Optional new TTL in seconds. Defaults to the current TTL.'
      )
  ).action(
    async (
      domainName: string,
      options: DnsRecordUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.updateRecord(domainName, options);
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
      .description('Delete one forward DNS record by its exact current value.')
      .requiredOption(
        '--type <type>',
        'Record type: A, AAAA, CNAME, MX, TXT, or SRV.'
      )
      .option(
        '--name <host>',
        'Record name within the zone. Use @ for apex.',
        '@'
      )
      .requiredOption(
        '--value <value>',
        'Exact current value shown by e2ectl dns record list.'
      )
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      domainName: string,
      options: DnsRecordDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteRecord(domainName, options);
      runtime.stdout.write(
        renderDnsResult(
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
