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
  type DbaasListOptions,
  type DbaasListTypesOptions,
  type DbaasPlansOptions,
  type DbaasResetPasswordOptions,
  type DbaasSkusOptions
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
