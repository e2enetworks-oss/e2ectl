import { Command, Option } from 'commander';

import { formatCliCommand } from '../app/metadata.js';
import type { CliRuntime } from '../app/index.js';
import { renderNodeResult } from './formatter.js';
import {
  NodeService,
  type NodeCatalogPlansOptions,
  type NodeContextOptions,
  type NodeCreateOptions,
  type NodeDeleteOptions,
  type NodeSaveImageOptions,
  type NodeVolumeActionOptions,
  type NodeVpcActionOptions
} from './service.js';

interface GlobalOptions {
  json?: boolean;
}

interface NodeSshKeyAttachCommandOptions extends NodeContextOptions {
  sshKeyId: string[];
}

const NODE_CATALOG_BILLING_TYPE_CHOICES = [
  'hourly',
  'committed',
  'all'
] as const;
const NODE_CREATE_BILLING_TYPE_CHOICES = ['hourly', 'committed'] as const;

export function buildNodeCommand(runtime: CliRuntime): Command {
  const service = new NodeService({
    confirm: (message) => runtime.confirm(message),
    createNodeClient: (credentials) => runtime.createNodeClient(credentials),
    createSshKeyClient: (credentials) =>
      runtime.createSshKeyClient(credentials),
    createVolumeClient: (credentials) =>
      runtime.createVolumeClient(credentials),
    createVpcClient: (credentials) => runtime.createVpcClient(credentials),
    isInteractive: runtime.isInteractive,
    store: runtime.store
  });
  const command = new Command('node').description('Manage MyAccount nodes.');

  command.helpCommand('help [command]', 'Show help for a node command');
  command.addCommand(buildNodeCatalogCommand(service, runtime));
  command.addCommand(buildNodeActionCommand(service, runtime));

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
      `Create a new node from an exact catalog plan and image. Use committed billing only after selecting a committed plan id from \`${formatCliCommand('node catalog plans')}\`.`
    )
    .requiredOption('--name <name>', 'Node name.')
    .requiredOption('--plan <plan>', 'MyAccount node plan identifier.')
    .requiredOption('--image <image>', 'MyAccount image identifier.')
    .addOption(
      new Option(
        '--billing-type <billingType>',
        'Billing type for the create request.'
      )
        .choices(NODE_CREATE_BILLING_TYPE_CHOICES)
        .default('hourly')
    )
    .option(
      '--committed-plan-id <committedPlanId>',
      `Committed plan id returned by \`${formatCliCommand('node catalog plans')}\`.`
    )
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
    'Run non-interactive power, image, and attachment actions on a node.'
  );

  command.helpCommand('help [command]', 'Show help for a node action command');

  command
    .command('power-on <nodeId>')
    .description('Power on a node.')
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
        const result = await service.powerOnNode(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );

  command
    .command('power-off <nodeId>')
    .description('Power off a node.')
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
        const result = await service.powerOffNode(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );

  command
    .command('save-image <nodeId>')
    .description('Save a node as an image.')
    .requiredOption('--name <name>', 'Image name.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeSaveImageOptions,
        commandInstance: Command
      ) => {
        const result = await service.saveNodeImage(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );

  command.addCommand(buildNodeActionVpcCommand(service, runtime));
  command.addCommand(buildNodeActionVolumeCommand(service, runtime));
  command.addCommand(buildNodeActionSshKeyCommand(service, runtime));

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildNodeActionSshKeyCommand(
  service: NodeService,
  runtime: CliRuntime
): Command {
  const command = new Command('ssh-key').description(
    'Attach saved SSH keys to a node.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a node action ssh-key command'
  );

  command
    .command('attach <nodeId>')
    .description('Attach one or more saved SSH keys to a node.')
    .requiredOption(
      '--ssh-key-id <sshKeyId>',
      'Saved SSH key id to attach. Repeat to attach multiple keys.',
      collectOptionValue
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeSshKeyAttachCommandOptions,
        commandInstance: Command
      ) => {
        const result = await service.attachSshKeys(nodeId, {
          ...(options.alias === undefined ? {} : { alias: options.alias }),
          ...(options.location === undefined
            ? {}
            : {
                location: options.location
              }),
          ...(options.projectId === undefined
            ? {}
            : {
                projectId: options.projectId
              }),
          sshKeyIds: toOptionArray(options.sshKeyId)
        });
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

function buildNodeActionVolumeCommand(
  service: NodeService,
  runtime: CliRuntime
): Command {
  const command = new Command('volume').description(
    'Attach or detach volumes on a node.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a node action volume command'
  );

  command
    .command('attach <nodeId>')
    .description('Attach a volume to a node.')
    .requiredOption('--volume-id <volumeId>', 'Volume id to attach.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeVolumeActionOptions,
        commandInstance: Command
      ) => {
        const result = await service.attachVolume(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );

  command
    .command('detach <nodeId>')
    .description('Detach a volume from a node.')
    .requiredOption('--volume-id <volumeId>', 'Volume id to detach.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeVolumeActionOptions,
        commandInstance: Command
      ) => {
        const result = await service.detachVolume(nodeId, options);
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

function buildNodeActionVpcCommand(
  service: NodeService,
  runtime: CliRuntime
): Command {
  const command = new Command('vpc').description(
    'Attach or detach a VPC on a node.'
  );

  command.helpCommand(
    'help [command]',
    'Show help for a node action vpc command'
  );

  command
    .command('attach <nodeId>')
    .description('Attach a VPC to a node.')
    .requiredOption('--vpc-id <vpcId>', 'VPC id to attach.')
    .option('--subnet-id <subnetId>', 'Optional VPC subnet id to use.')
    .option('--private-ip <privateIp>', 'Optional private IP to request.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeVpcActionOptions,
        commandInstance: Command
      ) => {
        const result = await service.attachVpc(nodeId, options);
        runtime.stdout.write(
          renderNodeResult(
            result,
            commandInstance.optsWithGlobals<GlobalOptions>().json ?? false
          )
        );
      }
    );

  command
    .command('detach <nodeId>')
    .description('Detach a VPC from a node.')
    .requiredOption('--vpc-id <vpcId>', 'VPC id to detach.')
    .option('--subnet-id <subnetId>', 'Optional VPC subnet id to detach.')
    .option('--private-ip <privateIp>', 'Optional private IP to detach.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option(
      '--project-id <projectId>',
      'Override the project id for this command.'
    )
    .option('--location <location>', 'Override the location for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeVpcActionOptions,
        commandInstance: Command
      ) => {
        const result = await service.detachVpc(nodeId, options);
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
    .description(
      'List config-first plan and billing options for a selected OS row.'
    )
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
    .addOption(
      new Option(
        '--billing-type <billingType>',
        'Filter discovery output to hourly, committed, or both.'
      )
        .choices(NODE_CATALOG_BILLING_TYPE_CHOICES)
        .default('all')
    )
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

function collectOptionValue(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function toOptionArray(value: string[] | string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
