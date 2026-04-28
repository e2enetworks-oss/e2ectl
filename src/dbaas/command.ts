import { readFile } from 'node:fs/promises';

import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderDbaasResult } from './formatter.js';
import {
  DbaasService,
  type DbaasAttachVpcOptions,
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
  type DbaasSkusOptions,
  type DbaasWhitelistListOptions,
  type DbaasWhitelistUpdateOptions
} from './service.js';

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
  const command = new Command('dbaas').description(
    'Manage MyAccount MariaDB, MySQL, and PostgreSQL DBaaS clusters.'
  );

  command.helpCommand('help [command]', 'Show help for a dbaas command');

  addContextOptions(
    command
      .command('list-types')
      .description(
        'List supported DBaaS engine types and versions available for your account.'
      )
      .option(
        '--type <databaseType>',
        'Filter by database type: maria, sql, or postgres.'
      )
  ).action(async (options: DbaasListTypesOptions, commandInstance: Command) => {
    const result = await service.listTypes(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('plans')
      .description(
        `List hourly template plans and committed SKU options for a specific engine version. Run ${formatCliCommand('dbaas list-types')} first to find valid --type and --db-version values.`
      )
      .requiredOption(
        '--type <databaseType>',
        'Database type: maria, sql, or postgres.'
      )
      .requiredOption('--db-version <version>', 'Database engine version.')
  ).action(async (options: DbaasPlansOptions, commandInstance: Command) => {
    const result = await service.listPlans(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('skus')
      .description(
        `List committed SKU options for a specific engine version. Use the SKU ID with ${formatCliCommand('dbaas create --billing-type committed --committed-plan-id <id>')}.`
      )
      .requiredOption(
        '--type <databaseType>',
        'Database type: maria, sql, or postgres.'
      )
      .requiredOption('--db-version <version>', 'Database engine version.')
  ).action(async (options: DbaasSkusOptions, commandInstance: Command) => {
    const result = await service.listSkus(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
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
    const result = await service.listDbaas(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
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
      const result = await service.getDbaas(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
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
        `Create a DBaaS cluster. Run ${formatCliCommand('dbaas list-types')} then ${formatCliCommand('dbaas plans --type <type> --db-version <version>')} first to discover plan names and committed SKU IDs.`
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
      .option('--no-public-ip', 'Create the DBaaS without a public endpoint.')
      .option(
        '--public-ip',
        'Create the DBaaS with a public endpoint. This is the default when a VPC is attached.'
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
        `Committed SKU ID from ${formatCliCommand('dbaas skus')} output. Requires --billing-type committed.`
      )
      .addOption(
        new Option(
          '--committed-renewal <committedRenewal>',
          'What happens when the committed term ends: auto-renew (default) or hourly.'
        )
          .choices(['auto-renew', 'hourly'])
          .default('auto-renew')
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
    const result = await service.createDbaas(options);
    runtime.stdout.write(
      renderDbaasResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('attach <dbaasId>')
      .description(
        'Attach a VPC to an existing DBaaS cluster. The cluster must be in Running state.'
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
      const result = await service.attachVpc(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  const networkCommand = command
    .command('network')
    .description('Manage DBaaS VPC and public IP networking.');
  networkCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas network command'
  );

  addContextOptions(
    networkCommand
      .command('attach-vpc <dbaasId>')
      .description('Attach a VPC to an existing DBaaS cluster.')
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
      const result = await service.attachVpc(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    networkCommand
      .command('detach-vpc <dbaasId>')
      .description('Detach a VPC from an existing DBaaS cluster.')
      .requiredOption(
        '--vpc-id <vpcId>',
        'VPC network_id to detach. Use the network_id from dbaas get.'
      )
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
      const result = await service.detachVpc(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    networkCommand
      .command('attach-public-ip <dbaasId>')
      .description('Attach a public IP and enable external DBaaS access.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasPublicIpOptions,
      commandInstance: Command
    ) => {
      const result = await service.attachPublicIp(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    networkCommand
      .command('detach-public-ip <dbaasId>')
      .description(
        'Detach the public IP and remove external DBaaS access. Requires confirmation.'
      )
      .option(
        '--force',
        'Acknowledge connectivity loss and skip the interactive confirmation prompt.'
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasPublicIpDetachOptions,
      commandInstance: Command
    ) => {
      const result = await service.detachPublicIp(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  networkCommand.action(() => {
    networkCommand.outputHelp();
  });

  const whitelistCommand = command
    .command('whitelist')
    .description('Manage DBaaS whitelisted IPs.');
  whitelistCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas whitelist command'
  );

  addContextOptions(
    whitelistCommand
      .command('list <dbaasId>')
      .description('List whitelisted IPs for a DBaaS cluster.')
  ).action(
    async (
      dbaasId: string,
      options: DbaasWhitelistListOptions,
      commandInstance: Command
    ) => {
      const result = await service.listWhitelistedIps(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    whitelistCommand
      .command('add <dbaasId>')
      .description('Whitelist an IP address for a DBaaS cluster.')
      .requiredOption('--ip <ip>', 'IPv4 address or CIDR to whitelist.')
      .option(
        '--tag-id <tagId>',
        'Optional MyAccount tag ID to attach. Repeat to attach multiple tags.',
        collectRepeatedOption,
        []
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasWhitelistUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.addWhitelistedIp(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    whitelistCommand
      .command('remove <dbaasId>')
      .description('Remove a whitelisted IP address from a DBaaS cluster.')
      .requiredOption('--ip <ip>', 'IPv4 address or CIDR to remove.')
      .option(
        '--tag-id <tagId>',
        'Optional tag ID currently attached to the whitelisted IP. Repeat when needed by the API.',
        collectRepeatedOption,
        []
      )
  ).action(
    async (
      dbaasId: string,
      options: DbaasWhitelistUpdateOptions,
      commandInstance: Command
    ) => {
      const result = await service.removeWhitelistedIp(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  whitelistCommand.action(() => {
    whitelistCommand.outputHelp();
  });

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
      const result = await service.resetPassword(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
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
      const result = await service.deleteDbaas(dbaasId, options);
      runtime.stdout.write(
        renderDbaasResult(
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

function collectRepeatedOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}
