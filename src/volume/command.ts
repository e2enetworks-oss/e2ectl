import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderVolumeResult } from './formatter.js';
import {
  VolumeService,
  type VolumeContextOptions,
  type VolumeCreateOptions,
  type VolumeDeleteOptions,
  type VolumePlansOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildVolumeCommand(runtime: CliRuntime): Command {
  const service = new VolumeService({
    confirm: (message) => runtime.confirm(message),
    createVolumeClient: (credentials) =>
      runtime.createVolumeClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('volume').description(
    'Manage MyAccount block storage volumes.'
  );

  command.helpCommand('help [command]', 'Show help for a volume command');

  addContextOptions(
    command
      .command('list')
      .description(
        'List block storage volumes for the selected profile or environment credentials.'
      )
  ).action(async (options: VolumeContextOptions, commandInstance: Command) => {
    const result = await service.listVolumes(options);
    runtime.stdout.write(
      renderVolumeResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('plans')
      .description(
        'Discover available volume sizes, derived IOPS, and committed options before creation.'
      )
      .option(
        '--size <size>',
        'Inspect one size in GB with exact committed pricing.'
      )
      .option(
        '--available-only',
        'Hide sizes that are currently unavailable in inventory.'
      )
  ).action(async (options: VolumePlansOptions, commandInstance: Command) => {
    const result = await service.listVolumePlans(options);
    runtime.stdout.write(
      renderVolumeResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('create')
      .description(
        `Create a block storage volume. Inspect \`${formatCliCommand('volume plans')}\` first so the CLI can derive IOPS from a valid size.`
      )
      .requiredOption('--name <name>', 'Volume name.')
      .requiredOption('--size <size>', 'Volume size in GB.')
      .requiredOption(
        '--billing-type <billingType>',
        'Billing type: hourly or committed.'
      )
      .option(
        '--committed-plan-id <committedPlanId>',
        `Committed volume plan identifier from \`${formatCliCommand('volume plans')}\`.`
      )
      .option(
        '--post-commit-behavior <behavior>',
        'Committed renewal behavior: auto-renew or hourly-billing.'
      )
  ).action(async (options: VolumeCreateOptions, commandInstance: Command) => {
    const result = await service.createVolume(options);
    runtime.stdout.write(
      renderVolumeResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command.command('get <volumeId>').description('Get details for a volume.')
  ).action(
    async (
      volumeId: string,
      options: VolumeContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getVolume(volumeId, options);
      runtime.stdout.write(
        renderVolumeResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('delete <volumeId>')
      .description('Delete a volume.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      volumeId: string,
      options: VolumeDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteVolume(volumeId, options);
      runtime.stdout.write(
        renderVolumeResult(
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
