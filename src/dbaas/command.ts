import { readFile } from 'node:fs/promises';

import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
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

type DbaasNetworkAction =
  | 'attach-vpc'
  | 'detach-vpc'
  | 'attach-public-ip'
  | 'detach-public-ip';

type DbaasWhitelistAction = 'list' | 'add' | 'remove';

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
      .command('list-types')
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
        `List hourly template plans and committed SKU options for a specific engine version. Run ${formatCliCommand('dbaas list-types')} first to find valid --type and --db-version values.`
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
    await runDbaasAction(commandInstance, () => service.createDbaas(options));
  });

  const networkCommand = addContextOptions(
    command
      .command('network')
      .description('Manage DBaaS VPC and public IP networking.')
      .usage('<dbaasId> <action> [target] [options]')
      .argument('[dbaasId]', 'DBaaS cluster ID.')
      .argument(
        '[action]',
        'Network action: attach-vpc, detach-vpc, attach-public-ip, or detach-public-ip.'
      )
      .argument('[target]', 'VPC network_id for attach-vpc or detach-vpc.')
      .option(
        '--subnet-id <subnetId>',
        'Optional subnet ID within the VPC. Only for non-default VPCs.'
      )
      .option(
        '--force',
        'Acknowledge connectivity loss and skip the public IP detach confirmation prompt.'
      )
  );
  networkCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas network command'
  );

  networkCommand.action(
    async (
      dbaasId: string | undefined,
      action: string | undefined,
      target: string | undefined,
      options:
        | DbaasAttachVpcOptions
        | DbaasDetachVpcOptions
        | DbaasPublicIpOptions
        | DbaasPublicIpDetachOptions,
      commandInstance: Command
    ) => {
      const input = requireDbaasNetworkInput(dbaasId, action);

      switch (normalizeDbaasNetworkAction(input.action)) {
        case 'attach-vpc':
          await runDbaasAction(commandInstance, () =>
            service.attachVpc(input.dbaasId, {
              ...options,
              vpcId: requireNetworkTarget(target, 'attach-vpc')
            })
          );
          return;
        case 'detach-vpc':
          await runDbaasAction(commandInstance, () =>
            service.detachVpc(input.dbaasId, {
              ...options,
              vpcId: requireNetworkTarget(target, 'detach-vpc')
            })
          );
          return;
        case 'attach-public-ip':
          await runDbaasAction(commandInstance, () =>
            service.attachPublicIp(input.dbaasId, options)
          );
          return;
        case 'detach-public-ip':
          await runDbaasAction(commandInstance, () =>
            service.detachPublicIp(input.dbaasId, options)
          );
          return;
      }
    }
  );

  const whitelistCommand = addContextOptions(
    command
      .command('whitelist-ip')
      .description('Manage DBaaS whitelisted IPs.')
      .usage('<dbaasId> <action> [ip] [options]')
      .argument('[dbaasId]', 'DBaaS cluster ID.')
      .argument('[action]', 'Whitelist IP action: list, add, or remove.')
      .argument('[ip]', 'IPv4 address for add or remove.')
  );
  whitelistCommand.helpCommand(
    'help [command]',
    'Show help for a dbaas whitelist-ip command'
  );

  whitelistCommand.action(
    async (
      dbaasId: string | undefined,
      action: string | undefined,
      ip: string | undefined,
      options: DbaasWhitelistListOptions | DbaasWhitelistUpdateOptions,
      commandInstance: Command
    ) => {
      const input = requireDbaasWhitelistInput(dbaasId, action);

      switch (normalizeDbaasWhitelistAction(input.action)) {
        case 'list':
          await runDbaasAction(commandInstance, () =>
            service.listWhitelistedIps(input.dbaasId, options)
          );
          return;
        case 'add':
          await runDbaasAction(commandInstance, () =>
            service.addWhitelistedIp(input.dbaasId, {
              ...options,
              ip: requireWhitelistIp(ip, 'add')
            })
          );
          return;
        case 'remove':
          await runDbaasAction(commandInstance, () =>
            service.removeWhitelistedIp(input.dbaasId, {
              ...options,
              ip: requireWhitelistIp(ip, 'remove')
            })
          );
          return;
      }
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

function normalizeDbaasNetworkAction(action: string): DbaasNetworkAction {
  if (
    action === 'attach-vpc' ||
    action === 'detach-vpc' ||
    action === 'attach-public-ip' ||
    action === 'detach-public-ip'
  ) {
    return action;
  }

  throw new CliError(`Unknown DBaaS network action "${action}".`, {
    code: 'INVALID_DBAAS_NETWORK_ACTION',
    details: [
      'Valid actions: attach-vpc, detach-vpc, attach-public-ip, detach-public-ip'
    ],
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Use dbaas network <dbaas-id> <action>, for example dbaas network 7869 attach-vpc 501.'
  });
}

function requireDbaasNetworkInput(
  dbaasId: string | undefined,
  action: string | undefined
): { action: string; dbaasId: string } {
  if (dbaasId === undefined) {
    throw new CliError('DBaaS cluster ID is required for dbaas network.', {
      code: 'MISSING_DBAAS_NETWORK_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Use dbaas network <dbaas-id> <action>, for example dbaas network 7869 attach-public-ip.'
    });
  }

  if (action === undefined) {
    throw new CliError('Network action is required for dbaas network.', {
      code: 'MISSING_DBAAS_NETWORK_ACTION',
      details: [
        'Valid actions: attach-vpc, detach-vpc, attach-public-ip, detach-public-ip'
      ],
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Use dbaas network <dbaas-id> <action>, for example dbaas network 7869 attach-vpc 501.'
    });
  }

  return { action, dbaasId };
}

function normalizeDbaasWhitelistAction(action: string): DbaasWhitelistAction {
  if (action === 'list' || action === 'add' || action === 'remove') {
    return action;
  }

  throw new CliError(`Unknown DBaaS whitelist action "${action}".`, {
    code: 'INVALID_DBAAS_WHITELIST_ACTION',
    details: ['Valid actions: list, add, remove'],
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Use dbaas whitelist-ip <dbaas-id> <action>, for example dbaas whitelist-ip 7869 add 203.0.113.10.'
  });
}

function requireDbaasWhitelistInput(
  dbaasId: string | undefined,
  action: string | undefined
): { action: string; dbaasId: string } {
  if (dbaasId === undefined) {
    throw new CliError('DBaaS cluster ID is required for dbaas whitelist-ip.', {
      code: 'MISSING_DBAAS_WHITELIST_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Use dbaas whitelist-ip <dbaas-id> <action>, for example dbaas whitelist-ip 7869 list.'
    });
  }

  if (action === undefined) {
    throw new CliError(
      'Whitelist IP action is required for dbaas whitelist-ip.',
      {
        code: 'MISSING_DBAAS_WHITELIST_ACTION',
        details: ['Valid actions: list, add, remove'],
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Use dbaas whitelist-ip <dbaas-id> <action>, for example dbaas whitelist-ip 7869 add 203.0.113.10.'
      }
    );
  }

  return { action, dbaasId };
}

function requireNetworkTarget(
  target: string | undefined,
  action: 'attach-vpc' | 'detach-vpc'
): string {
  if (target !== undefined) {
    return target;
  }

  throw new CliError(`VPC ID is required for dbaas network ${action}.`, {
    code: 'MISSING_DBAAS_VPC_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: `Use dbaas network <dbaas-id> ${action} <vpc-id>.`
  });
}

function requireWhitelistIp(
  ip: string | undefined,
  action: 'add' | 'remove'
): string {
  if (ip !== undefined) {
    return ip;
  }

  throw new CliError(
    `IP address is required for dbaas whitelist-ip ${action}.`,
    {
      code: 'MISSING_DBAAS_WHITELIST_IP',
      exitCode: EXIT_CODES.usage,
      suggestion: `Use dbaas whitelist-ip <dbaas-id> ${action} <ip>.`
    }
  );
}

async function readAllFromStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');

  let buffer = '';
  for await (const chunk of process.stdin) {
    buffer += chunk;
  }

  return buffer;
}
