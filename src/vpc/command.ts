import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderVpcResult } from './formatter.js';
import {
  VpcService,
  type VpcContextOptions,
  type VpcCreateOptions,
  type VpcDeleteOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildVpcCommand(runtime: CliRuntime): Command {
  const service = new VpcService({
    confirm: (message) => runtime.confirm(message),
    createVpcClient: (credentials) => runtime.createVpcClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('vpc').description(
    'Manage MyAccount VPC networks.'
  );

  command.helpCommand('help [command]', 'Show help for a vpc command');

  addContextOptions(
    command
      .command('list')
      .description(
        'List VPC networks for the selected profile or environment credentials.'
      )
  ).action(async (options: VpcContextOptions, commandInstance: Command) => {
    const result = await service.listVpcs(options);
    runtime.stdout.write(
      renderVpcResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('plans')
      .description(
        'Discover hourly and committed VPC billing options before creation.'
      )
  ).action(async (options: VpcContextOptions, commandInstance: Command) => {
    const result = await service.listVpcPlans(options);
    runtime.stdout.write(
      renderVpcResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('create')
      .description(
        `Create a VPC. Inspect \`${formatCliCommand('vpc plans')}\` first to choose hourly or committed billing intentionally.`
      )
      .requiredOption('--name <name>', 'VPC name.')
      .requiredOption(
        '--billing-type <billingType>',
        'Billing type: hourly or committed.'
      )
      .requiredOption(
        '--cidr-source <cidrSource>',
        'CIDR source: e2e or custom.'
      )
      .option(
        '--cidr <cidr>',
        'Custom IPv4 CIDR block to use when cidr-source is custom.'
      )
      .option(
        '--committed-plan-id <committedPlanId>',
        `Committed VPC plan identifier from \`${formatCliCommand('vpc plans')}\`.`
      )
      .option(
        '--post-commit-behavior <behavior>',
        'Committed renewal behavior: auto-renew or hourly-billing.'
      )
  ).action(async (options: VpcCreateOptions, commandInstance: Command) => {
    const result = await service.createVpc(options);
    runtime.stdout.write(
      renderVpcResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command.command('get <vpcId>').description('Get details for a VPC.')
  ).action(
    async (
      vpcId: string,
      options: VpcContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getVpc(vpcId, options);
      runtime.stdout.write(
        renderVpcResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <vpcId>')
      .description('Delete a VPC.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      vpcId: string,
      options: VpcDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteVpc(vpcId, options);
      runtime.stdout.write(
        renderVpcResult(
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
