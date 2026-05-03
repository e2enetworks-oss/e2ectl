import { readFile } from 'node:fs/promises';

import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderDbaasResult } from './formatter.js';
import { DbaasService } from './service.js';
import {
  type DbaasAttachVpcOptions,
  type DbaasCommandResult,
  type DbaasCreateOptions,
  type DbaasDeleteOptions,
  type DbaasDetachVpcOptions,
  type DbaasGetOptions,
  type DbaasListOptions,
  type DbaasListTypesOptions,
  type DbaasPublicIpDetachOptions,
  type DbaasPublicIpOptions,
  type DbaasPlansOptions,
  type DbaasResetPasswordOptions,
  type DbaasWhitelistListOptions,
  type DbaasWhitelistUpdateOptions
} from './types/index.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildDbaasCommand(runtime: CliRuntime): Command {
  const service = new DbaasService({
    confirm: (message) => runtime.confirm(message),
    createDbaasClient: (credentials) => runtime.createDbaasClient(credentials),
    createVpcClient: (credentials) => runtime.createVpcClient(credentials),
    isInteractive: runtime.isInteractive,
    readPasswordFile: async (path) => await readFile(path, 'utf8'),
    readPasswordFromStdin: readAllFromStdin,
    store: runtime.store
  });

  const runDbaasAction = async (
    commandInstance: Command,
    produceResult: () => Promise<DbaasCommandResult>
  ): Promise<void> => {
    const result = await produceResult();
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  };

  const command = new Command('dbaas').description(
    'Manage MyAccount MariaDB, MySQL, and PostgreSQL DBaaS clusters.'
  );

  command.helpCommand('help [command]', 'Show help for a dbaas command');

  addContextOptions(
    command
      .command('types')
      .description(
        'List supported DBaaS engine types and versions available for your account.'
      )
      .option(
        '--type <databaseType>',
        'Filter by database type: maria, sql, or postgres.'
      )
  ).action(async (options: DbaasListTypesOptions, commandInstance: Command) => {
    await runDbaasAction(commandInstance, () => service.listTypes(options));
  });

  addContextOptions(
    command
      .command('plans')
      .description(
        `List hourly template plans and committed SKU options for a specific engine version. Run ${formatCliCommand('dbaas types')} first to find valid --type and --db-version values.`
      )
      .requiredOption(
        '--type <databaseType>',
        'Database type: maria, sql, or postgres.'
      )
      .requiredOption('--db-version <version>', 'Database engine version.')
  ).action(async (options: DbaasPlansOptions, commandInstance: Command) => {
    await runDbaasAction(commandInstance, () => service.listPlans(options));
  });

  addContextOptions(
    command
      .command('list')
      .description(
        'List supported DBaaS clusters for the selected profile or environment credentials.'
      )
      .option(
        '--type <databaseType>',
        'Filter by database type: maria, sql, or postgres.'
      )
  ).action(async (options: DbaasListOptions, commandInstance: Command) => {
    await runDbaasAction(commandInstance, () => service.listDbaas(options));
  });

  addContextOptions(
    command
      .command('get <dbaasId>')
      .description('Show detailed information for a supported DBaaS cluster.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasGetOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.getDbaas(dbaasId, options)
      );
    }
  );

  addContextOptions(
    command
      .command('create')
      .description(
        `Create a DBaaS cluster. Run ${formatCliCommand('dbaas types')} then ${formatCliCommand('dbaas plans --type <type> --db-version <version>')} first to discover plan names and committed SKU IDs.`
      )
      .requiredOption('--name <name>', 'DBaaS cluster name.')
      .requiredOption(
        '--type <databaseType>',
        'Database type: maria, sql, or postgres.'
      )
      .requiredOption('--db-version <version>', 'Database engine version.')
      .requiredOption(
        '--plan <plan>',
        'Template plan name from the dbaas plans output.'
      )
      .requiredOption(
        '--database-name <databaseName>',
        'Initial database name.'
      )
      .option(
        '--password <password>',
        'Initial admin password that matches the frontend DBaaS policy.'
      )
      .option(
        '--password-file <path>',
        'Read the initial admin password from a file, or - to read from stdin.'
      )
      .option(
        '--username <username>',
        'Initial admin username. Defaults to admin.',
        'admin'
      )
      .option(
        '--public-ip',
        'Create a VPC-attached DBaaS with a public endpoint. This is the default when a VPC is attached.'
      )
      .addOption(
        new Option(
          '--no-public-ip',
          'Create a VPC-attached DBaaS without a public endpoint.'
        ).default(undefined)
      )
      .addOption(
        new Option(
          '--billing-type <billingType>',
          'Billing type: hourly (default) or committed.'
        )
          .choices(['hourly', 'committed'])
          .default('hourly')
      )
      .option(
        '--committed-plan-id <committedPlanId>',
        'Committed SKU ID. Requires --billing-type committed.'
      )
      .addOption(
        new Option(
          '--committed-renewal <committedRenewal>',
          'What happens when the committed term ends: auto-renew (default) or hourly.'
        ).choices(['auto-renew', 'hourly'])
      )
      .option(
        '--vpc-id <vpcId>',
        'Attach the cluster to this VPC at creation. Use the network_id from vpc list.'
      )
      .option(
        '--subnet-id <subnetId>',
        'Optional subnet ID within the VPC. Only for non-default VPCs.'
      )
  ).action(async (options: DbaasCreateOptions, commandInstance: Command) => {
    await runDbaasAction(commandInstance, () => service.createDbaas(options));
  });

  const networkCommand = command
    .command('network')
    .description('Manage DBaaS VPC and public IP networking.');
  networkCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas network command'
  );
  networkCommand.action(() => {
    networkCommand.outputHelp();
  });

  const vpcCommand = networkCommand
    .command('vpc')
    .description('Manage DBaaS VPC attachments.');
  vpcCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas network vpc command'
  );
  vpcCommand.action(() => {
    vpcCommand.outputHelp();
  });

  addContextOptions(
    vpcCommand
      .command('attach <dbaasId>')
      .description(
        `Attach a VPC to a DBaaS cluster. Run ${formatCliCommand('vpc list')} to find the VPC ID.`
      )
      .requiredOption(
        '--vpc-id <vpcId>',
        'VPC network_id to attach. Use the network_id from vpc list.'
      )
      .option(
        '--subnet-id <subnetId>',
        'Optional subnet ID within the VPC. Only for non-default VPCs.'
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasAttachVpcOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.attachVpc(dbaasId, options)
      );
    }
  );

  addContextOptions(
    vpcCommand
      .command('detach <dbaasId>')
      .description('Detach a VPC from a DBaaS cluster.')
      .requiredOption('--vpc-id <vpcId>', 'VPC network_id to detach.')
      .option(
        '--subnet-id <subnetId>',
        'Optional subnet ID within the VPC. Only for non-default VPCs.'
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasDetachVpcOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.detachVpc(dbaasId, options)
      );
    }
  );

  const publicIpCommand = networkCommand
    .command('public-ip')
    .description('Manage DBaaS public IP access.');
  publicIpCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas network public-ip command'
  );
  publicIpCommand.action(() => {
    publicIpCommand.outputHelp();
  });

  addContextOptions(
    publicIpCommand
      .command('attach <dbaasId>')
      .description('Enable public IP access for a DBaaS cluster.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasPublicIpOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.attachPublicIp(dbaasId, options)
      );
    }
  );

  addContextOptions(
    publicIpCommand
      .command('detach <dbaasId>')
      .description('Disable public IP access for a DBaaS cluster.')
      .option(
        '--force',
        'Acknowledge connectivity loss and skip the confirmation prompt.'
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasPublicIpDetachOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.detachPublicIp(dbaasId, options)
      );
    }
  );

  const whitelistCommand = command
    .command('whitelist')
    .description('Manage DBaaS whitelisted IP addresses.');
  whitelistCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas whitelist command'
  );
  whitelistCommand.action(() => {
    whitelistCommand.outputHelp();
  });

  addContextOptions(
    whitelistCommand
      .command('list <dbaasId>')
      .description('List whitelisted IP addresses for a DBaaS cluster.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasWhitelistListOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.listWhitelistedIps(dbaasId, options)
      );
    }
  );

  addContextOptions(
    whitelistCommand
      .command('add <dbaasId>')
      .description('Add an IP address to the DBaaS whitelist.')
      .requiredOption('--ip <ip>', 'IPv4 address to whitelist.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasWhitelistUpdateOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.addWhitelistedIp(dbaasId, options)
      );
    }
  );

  addContextOptions(
    whitelistCommand
      .command('remove <dbaasId>')
      .description('Remove an IP address from the DBaaS whitelist.')
      .requiredOption('--ip <ip>', 'IPv4 address to remove.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasWhitelistUpdateOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.removeWhitelistedIp(dbaasId, options)
      );
    }
  );

  addContextOptions(
    command
      .command('reset-password <dbaasId>')
      .description('Reset the admin password for a supported DBaaS cluster.')
      .option(
        '--password <password>',
        'New admin password that matches the frontend DBaaS policy.'
      )
      .option(
        '--password-file <path>',
        'Read the new admin password from a file, or - to read from stdin.'
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasResetPasswordOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.resetPassword(dbaasId, options)
      );
    }
  );

  addContextOptions(
    command
      .command('delete <dbaasId>')
      .description('Delete a supported DBaaS cluster.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasDeleteOptions,
      commandInstance: Command
    ) => {
      await runDbaasAction(commandInstance, () =>
        service.deleteDbaas(dbaasId, options)
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
