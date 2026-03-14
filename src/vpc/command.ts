import { Command } from 'commander';

import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderVpcResult } from './formatter.js';
import {
  VpcService,
  type VpcContextOptions,
  type VpcCreateOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildVpcCommand(runtime: CliRuntime): Command {
  const service = new VpcService({
    createVpcClient: (credentials) => runtime.createVpcClient(credentials),
    store: runtime.store
  });
  const command = new Command('vpc').description(
    'Manage MyAccount VPC networks.'
  );

  command.helpCommand('help [command]', 'Show help for a vpc command');

  command
    .command('list')
    .description(
      'List VPC networks for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: VpcContextOptions, commandInstance: Command) => {
      const result = await service.listVpcs(options);
      runtime.stdout.write(
        renderVpcResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('plans')
    .description(
      'Discover hourly and committed VPC billing options before creation.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: VpcContextOptions, commandInstance: Command) => {
      const result = await service.listVpcPlans(options);
      runtime.stdout.write(
        renderVpcResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

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
    .requiredOption('--cidr-source <cidrSource>', 'CIDR source: e2e or custom.')
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
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: VpcCreateOptions, commandInstance: Command) => {
      const result = await service.createVpc(options);
      runtime.stdout.write(
        renderVpcResult(
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
