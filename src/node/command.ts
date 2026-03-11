import { Command } from 'commander';

import type { CliRuntime } from '../app/runtime.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import { renderNodeResult } from './formatter.js';
import {
  NodeService,
  type NodeActionCommandName,
  type NodeCatalogPlansOptions,
  type NodeContextOptions,
  type NodeCreateOptions,
  type NodeDeleteOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

export function buildNodeCommand(runtime: CliRuntime): Command {
  const service = new NodeService({
    confirm: (message) => runtime.confirm(message),
    createApiClient: (credentials) => runtime.createApiClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('node').description('Manage MyAccount nodes.');
  const actionCommand = buildNodeActionCommand(service, runtime);
  const catalogCommand = buildNodeCatalogCommand(service, runtime);

  command.helpCommand('help [command]', 'Show help for a node command');
  command.addCommand(actionCommand);
  command.addCommand(catalogCommand);

  command
    .command('list')
    .description(
      'List nodes for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: NodeContextOptions, commandInstance: Command) => {
      const result = await service.listNodes(options);
      runtime.stdout.write(
        renderNodeResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('create')
    .description(
      'Create a new node with the documented default fields. Discover valid plan and image pairs with `e2ectl node catalog` first.'
    )
    .requiredOption('--name <name>', 'Node name.')
    .requiredOption('--plan <plan>', 'MyAccount node plan identifier.')
    .requiredOption('--image <image>', 'MyAccount image identifier.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: NodeCreateOptions, commandInstance: Command) => {
      const result = await service.createNode(options);
      runtime.stdout.write(
        renderNodeResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('get <nodeId>')
    .description('Get details for a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeContextOptions,
        commandInstance: Command
      ) => {
        const result = await service.getNode(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );

  command
    .command('delete <nodeId>')
    .description('Delete a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .option('--force', 'Skip the interactive confirmation prompt.')
    .action(
      async (
        nodeId: string,
        options: NodeDeleteOptions,
        commandInstance: Command
      ) => {
        const result = await service.deleteNode(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
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

function buildNodeActionCommand(
  service: NodeService,
  runtime: CliRuntime
): Command {
  const command = new Command('action').description(
    'Run supported node actions.'
  );

  command.helpCommand('help [command]', 'Show help for a node action command');

  registerSimpleNodeActionCommand(command, service, runtime, {
    actionName: 'power-on',
    description: 'Power on a node.',
    requestType: 'power_on'
  });
  registerSimpleNodeActionCommand(command, service, runtime, {
    actionName: 'power-off',
    description: 'Power off a node.',
    requestType: 'power_off'
  });
  registerSimpleNodeActionCommand(command, service, runtime, {
    actionName: 'lock-vm',
    description: 'Lock a node.',
    requestType: 'lock_vm'
  });

  command
    .command('save-image <nodeId>')
    .description('Save a node as an image.')
    .requiredOption('--name <name>', 'Image name to create.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeContextOptions & { name: string },
        commandInstance: Command
      ) => {
        const result = await service.runNodeAction(
          nodeId,
          options,
          'save-image',
          {
            name: normalizeRequiredString(options.name, 'Image name', '--name'),
            type: 'save_images'
          }
        );
        runtime.stdout.write(
          renderNodeResult(
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

function buildNodeCatalogCommand(
  service: NodeService,
  runtime: CliRuntime
): Command {
  const command = new Command('catalog').description(
    'Discover valid OS, plan, and image combinations for node creation.'
  );

  command.helpCommand('help [command]', 'Show help for a node catalog command');

  command
    .command('os')
    .description(
      'List OS rows that can be used to query valid plan/image pairs.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(async (options: NodeContextOptions, commandInstance: Command) => {
      const result = await service.listCatalogOs(options);
      runtime.stdout.write(
        renderNodeResult(
          result,
          commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
        )
      );
    });

  command
    .command('plans')
    .description('List valid plan and image pairs for a selected OS row.')
    .requiredOption(
      '--display-category <displayCategory>',
      'Node display category, for example "Linux Virtual Node".'
    )
    .requiredOption(
      '--category <category>',
      'OS category, for example "Ubuntu".'
    )
    .requiredOption(
      '--os <os>',
      'Operating system family, for example "Ubuntu".'
    )
    .requiredOption('--os-version <osVersion>', 'Operating system version.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (options: NodeCatalogPlansOptions, commandInstance: Command) => {
        const result = await service.listCatalogPlans(options);
        runtime.stdout.write(
          renderNodeResult(
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

function registerSimpleNodeActionCommand(
  command: Command,
  service: NodeService,
  runtime: CliRuntime,
  options: {
    actionName: NodeActionCommandName;
    description: string;
    requestType: 'lock_vm' | 'power_off' | 'power_on';
  }
): void {
  command
    .command(`${options.actionName} <nodeId>`)
    .description(options.description)
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        commandOptions: NodeContextOptions,
        commandInstance: Command
      ) => {
        const result = await service.runNodeAction(
          nodeId,
          commandOptions,
          options.actionName,
          {
            type: options.requestType
          }
        );
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );
}

function normalizeRequiredString(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = value.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}
