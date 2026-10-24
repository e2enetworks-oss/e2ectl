import { Command } from 'commander';

import { addTirContextOptions } from '../../app/context-options.js';
import type { CliRuntime } from '../../app/runtime.js';
import { renderTirImageResult } from './formatter.js';
import { TirImageService } from './service.js';
import type { TirImageContextOptions } from './types.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildTirImageCommand(runtime: CliRuntime): Command {
  const service = new TirImageService({
    createTirImageClient: (credentials) =>
      runtime.createTirImageClient(credentials),
    store: runtime.store
  });
  const command = new Command('image').description(
    'List the images TIR instances can start from.'
  );

  command.helpCommand('help [command]', 'Show help for a tir image command');

  addTirContextOptions(
    command
      .command('list')
      .description(
        'List container images and their versions. Pass a version id to tir plan list to see the plans that fit it.'
      )
  ).action(
    async (options: TirImageContextOptions, commandInstance: Command) => {
      const result = await service.list(options);
      runtime.stdout.write(
        renderTirImageResult(
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
