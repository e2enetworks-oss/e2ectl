import { Command } from 'commander';

import type { CliRuntime } from '../app/index.js';
import { renderVolumeResult } from './formatter.js';
import {
  VolumeService,
  type VolumeContextOptions,
  type VolumeCreateOptions,
  type VolumePlansOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildVolumeCommand(runtime: CliRuntime): Command {
  const service = new VolumeService({
    createVolumeClient: (credentials) =>
      runtime.createVolumeClient(credentials),
    store: runtime.store
  });
  const command = new Command('volume').description(
    'Manage MyAccount block storage volumes.'
  );

  command.helpCommand('help [command]', 'Show help for a volume command');

  command
    .command('list')
    .description(
      'List block storage volumes for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: VolumeContextOptions, commandInstance: Command) => {
      const result = await service.listVolumes(options);
      runtime.stdout.write(
        renderVolumeResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('plans')
    .description(
      'Discover available volume sizes, derived IOPS, and committed options before creation.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .option(
      '--size <size>',
      'Inspect one size in GB with exact committed pricing.'
    )
    .option(
      '--available-only',
      'Hide sizes that are currently unavailable in inventory.'
    )
    .action(async (options: VolumePlansOptions, commandInstance: Command) => {
      const result = await service.listVolumePlans(options);
      runtime.stdout.write(
        renderVolumeResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('create')
    .description(
      'Create a block storage volume. Inspect `e2ectl volume plans` first so the CLI can derive IOPS from a valid size.'
    )
    .requiredOption('--name <name>', 'Volume name.')
    .requiredOption('--size <size>', 'Volume size in GB.')
    .requiredOption(
      '--billing-type <billingType>',
      'Billing type: hourly or committed.'
    )
    .option(
      '--committed-plan-id <committedPlanId>',
      'Committed volume plan identifier from `e2ectl volume plans`.'
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
    .action(async (options: VolumeCreateOptions, commandInstance: Command) => {
      const result = await service.createVolume(options);
      runtime.stdout.write(
        renderVolumeResult(
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
