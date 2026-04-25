import { Command } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderImageResult } from './formatter.js';
import {
  ImageService,
  type ImageContextOptions,
  type ImageDeleteOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

interface ImageRenameCommandOptions extends ImageContextOptions {
  name: string;
}

export function buildImageCommand(runtime: CliRuntime): Command {
  const service = new ImageService({
    confirm: (message) => runtime.confirm(message),
    createImageClient: (credentials) => runtime.createImageClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('image').description('Manage saved images.');

  command.helpCommand('help [command]', 'Show help for an image command');

  addContextOptions(
    command
      .command('list')
      .description(
        'List saved images for the selected profile or environment credentials.'
      )
  ).action(async (options: ImageContextOptions, commandInstance: Command) => {
    const result = await service.listImages(options);
    runtime.stdout.write(
      renderImageResult(
        result,
        commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
      )
    );
  });

  addContextOptions(
    command
      .command('delete <imageId>')
      .description('Delete a saved image.')
      .option('--force', 'Skip the interactive confirmation prompt.')
  ).action(
    async (
      imageId: string,
      options: ImageDeleteOptions,
      commandInstance: Command
    ) => {
      const result = await service.deleteImage(imageId, options);
      runtime.stdout.write(
        renderImageResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    }
  );

  addContextOptions(
    command
      .command('rename <imageId>')
      .description('Rename a saved image.')
      .requiredOption('--name <name>', 'New name for the image.')
  ).action(
    async (
      imageId: string,
      options: ImageRenameCommandOptions,
      commandInstance: Command
    ) => {
      const result = await service.renameImage(imageId, options);
      runtime.stdout.write(
        renderImageResult(
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
