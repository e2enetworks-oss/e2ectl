import { Command, Option } from 'commander';

import { addContextOptions } from '../app/context-options.js';
import type { CliRuntime } from '../app/index.js';
import { renderImageResult } from './formatter.js';
import {
  ImageService,
  type ImageContextOptions,
  type ImageDeleteOptions,
  type ImageImportOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

interface ImageCreateCommandOptions extends ImageContextOptions {
  name: string;
  plan: string;
  sshKeyId?: string[] | string;
}

interface ImageImportCommandOptions extends ImageImportOptions {
  name: string;
  os?: string;
  url: string;
}

interface ImageRenameCommandOptions extends ImageContextOptions {
  name: string;
}

const IMAGE_OS_CHOICES = [
  'CENTOS',
  'UBUNTU',
  'WINDOWS_BIOS',
  'WINDOWS_UEFI'
] as const;

export function buildImageCommand(runtime: CliRuntime): Command {
  const service = new ImageService({
    confirm: (message) => runtime.confirm(message),
    createImageClient: (credentials) => runtime.createImageClient(credentials),
    createNodeClient: (credentials) => runtime.createNodeClient(credentials),
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
    command.command('get <imageId>').description('Get details for a saved image.')
  ).action(
    async (
      imageId: string,
      options: ImageContextOptions,
      commandInstance: Command
    ) => {
      const result = await service.getImage(imageId, options);
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
      .command('import')
      .description('Import an image from a public URL into saved images.')
      .requiredOption('--name <name>', 'Name for the imported image.')
      .requiredOption('--url <url>', 'Public URL of the image to import.')
      .addOption(
        new Option('--os <os>', 'Operating system type of the image.')
          .choices(IMAGE_OS_CHOICES)
          .default('CENTOS')
      )
  ).action(
    async (options: ImageImportCommandOptions, commandInstance: Command) => {
      const result = await service.importImage(options);
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

  addContextOptions(
    command
      .command('create-node <imageId>')
      .description('Create a new node from a saved image.')
      .requiredOption('--name <name>', 'Node name.')
      .requiredOption('--plan <plan>', 'MyAccount node plan identifier.')
      .option(
        '--ssh-key-id <sshKeyId>',
        'Saved SSH key id to attach during node creation. Repeat to attach multiple keys.',
        collectOptionValue
      )
  ).action(
    async (
      imageId: string,
      options: ImageCreateCommandOptions,
      commandInstance: Command
    ) => {
      const result = await service.createNodeFromImage(imageId, {
        ...(options.alias === undefined ? {} : { alias: options.alias }),
        ...(options.location === undefined ? {} : { location: options.location }),
        ...(options.projectId === undefined
          ? {}
          : { projectId: options.projectId }),
        name: options.name,
        plan: options.plan,
        sshKeyIds: toOptionArray(options.sshKeyId)
      });
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

function collectOptionValue(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function toOptionArray(value: string[] | string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
