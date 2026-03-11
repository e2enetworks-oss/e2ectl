import { Command } from 'commander';
import { resolveCredentials } from '../client/auth.js';
import {
  formatJson,
  formatNodeCatalogOsTable,
  formatNodeCatalogPlansTable,
  formatNodeCreateResult,
  formatNodeDetails,
  formatNodesTable,
  summarizeNodeCatalogOs
} from '../output/formatter.js';
import type { CliRuntime } from '../runtime.js';
import type {
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateRequest
} from '../types/node.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

interface GlobalOptions {
  json?: boolean;
}

interface NodeAliasOptions {
  alias?: string;
}

interface NodeCreateCommandOptions extends NodeAliasOptions {
  image: string;
  name: string;
  plan: string;
}

interface NodeDeleteCommandOptions extends NodeAliasOptions {
  force?: boolean;
}

interface NodeCatalogPlansCommandOptions extends NodeAliasOptions {
  category: string;
  displayCategory: string;
  os: string;
  osVersion: string;
}

// Keep the prototype create payload aligned with the public-node serializer:
// send only the explicit prototype choices here and let the backend apply
// defaults for SG, VPC, reserve IP, encryption, and volume fields.
const DEFAULT_NODE_CREATE_REQUEST = {
  backups: false,
  default_public_ip: false,
  disable_password: true,
  enable_bitninja: false,
  is_ipv6_availed: false,
  is_saved_image: false,
  label: 'default',
  number_of_instances: 1,
  ssh_keys: [],
  start_scripts: []
} as const satisfies Omit<NodeCreateRequest, 'image' | 'name' | 'plan'>;

export function buildNodeCommand(runtime: CliRuntime): Command {
  const command = new Command('node').description('Manage MyAccount nodes.');
  const catalogCommand = buildNodeCatalogCommand(runtime);

  command.helpCommand('help [command]', 'Show help for a node command');
  command.addCommand(catalogCommand);

  command
    .command('list')
    .description(
      'List nodes for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(async (options: NodeAliasOptions, commandInstance: Command) => {
      const client = await createNodeClient(runtime, options.alias);
      const response = await client.listNodes();

      if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
        runtime.stdout.write(
          formatJson({
            action: 'list',
            nodes: response.data,
            total_count: response.total_count ?? null,
            total_page_number: response.total_page_number ?? null
          })
        );
        return;
      }

      runtime.stdout.write(
        response.data.length === 0
          ? 'No nodes found.\n'
          : `${formatNodesTable(response.data)}\n`
      );
    });

  command
    .command('create')
    .description(
      'Create a new node with the prototype defaults. Discover valid plan and image pairs with `e2ectl node catalog` first.'
    )
    .requiredOption('--name <name>', 'Node name.')
    .requiredOption('--plan <plan>', 'MyAccount node plan identifier.')
    .requiredOption('--image <image>', 'MyAccount image identifier.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(
      async (options: NodeCreateCommandOptions, commandInstance: Command) => {
        const client = await createNodeClient(runtime, options.alias);
        const request = buildNodeCreateRequest(options);
        const response = await client.createNode(request);

        if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'create',
              created: response.data.total_number_of_node_created,
              nodes: response.data.node_create_response,
              requested: response.data.total_number_of_node_requested
            })
          );
          return;
        }

        runtime.stdout.write(`${formatNodeCreateResult(response.data)}\n`);
      }
    );

  command
    .command('get <nodeId>')
    .description('Get details for a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(
      async (
        nodeId: string,
        options: NodeAliasOptions,
        commandInstance: Command
      ) => {
        assertNodeId(nodeId);
        const client = await createNodeClient(runtime, options.alias);
        const response = await client.getNode(nodeId);

        if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'get',
              node: response.data
            })
          );
          return;
        }

        runtime.stdout.write(`${formatNodeDetails(response.data)}\n`);
      }
    );

  command
    .command('delete <nodeId>')
    .description('Delete a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .option('--force', 'Skip the interactive confirmation prompt.')
    .action(
      async (
        nodeId: string,
        options: NodeDeleteCommandOptions,
        commandInstance: Command
      ) => {
        assertNodeId(nodeId);
        const globalOptions = commandInstance.optsWithGlobals<GlobalOptions>();

        if (!(options.force ?? false)) {
          assertCanDelete(runtime);
          const confirmed = await runtime.confirm(
            `Delete node ${nodeId}? This cannot be undone.`
          );

          if (!confirmed) {
            writeDeleteCancelled(runtime, globalOptions, nodeId);
            return;
          }
        }

        const client = await createNodeClient(runtime, options.alias);
        const response = await client.deleteNode(nodeId);

        if (globalOptions.json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'delete',
              cancelled: false,
              message: response.message,
              node_id: Number(nodeId)
            })
          );
          return;
        }

        runtime.stdout.write(`Deleted node ${nodeId}.\n`);
      }
    );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function buildNodeCatalogCommand(runtime: CliRuntime): Command {
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
    .action(async (options: NodeAliasOptions, commandInstance: Command) => {
      const client = await createNodeClient(runtime, options.alias);
      const response = await client.listNodeCatalogOs();
      const entries = summarizeNodeCatalogOs(response.data);

      if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
        runtime.stdout.write(
          formatJson({
            action: 'catalog-os',
            entries
          })
        );
        return;
      }

      if (entries.length === 0) {
        runtime.stdout.write('No OS catalog rows found.\n');
        return;
      }

      runtime.stdout.write(
        `${formatNodeCatalogOsTable(entries)}\n\nUse one row with:\n` +
          'e2ectl node catalog plans --display-category <value> --category <value> --os <value> --os-version <value>\n'
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
    .action(
      async (
        options: NodeCatalogPlansCommandOptions,
        commandInstance: Command
      ) => {
        const client = await createNodeClient(runtime, options.alias);
        const query = buildNodeCatalogQuery(options);
        const response = await client.listNodeCatalogPlans(query);
        const plans = sortNodeCatalogPlans(response.data);

        if (commandInstance.optsWithGlobals<GlobalOptions>().json ?? false) {
          runtime.stdout.write(
            formatJson({
              action: 'catalog-plans',
              plans,
              query
            })
          );
          return;
        }

        if (plans.length === 0) {
          runtime.stdout.write('No plans found for the selected OS row.\n');
          return;
        }

        runtime.stdout.write(
          `${formatNodeCatalogPlansTable(plans)}\n\nUse the exact plan and image values from a row with:\n` +
            'e2ectl node create --name <name> --plan <plan> --image <image>\n'
        );
      }
    );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

async function createNodeClient(runtime: CliRuntime, alias?: string) {
  const config = await runtime.store.read();
  const credentials = resolveCredentials({
    ...(alias === undefined ? {} : { alias }),
    config,
    configPath: runtime.store.configPath
  });

  return runtime.createApiClient(credentials);
}

function assertCanDelete(runtime: CliRuntime): void {
  if (runtime.isInteractive) {
    return;
  }

  throw new CliError(
    'Deleting a node requires confirmation in an interactive terminal.',
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}

function assertNodeId(nodeId: string): void {
  if (!/^\d+$/.test(nodeId)) {
    throw new CliError('Node ID must be numeric.', {
      code: 'INVALID_NODE_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric node id as the first argument.'
    });
  }
}

function buildNodeCreateRequest(
  options: NodeCreateCommandOptions
): NodeCreateRequest {
  return {
    ...DEFAULT_NODE_CREATE_REQUEST,
    image: normalizeRequiredString(options.image, 'Image', '--image'),
    name: normalizeRequiredString(options.name, 'Name', '--name'),
    plan: normalizeRequiredString(options.plan, 'Plan', '--plan')
  };
}

function buildNodeCatalogQuery(
  options: NodeCatalogPlansCommandOptions
): NodeCatalogQuery {
  return {
    category: normalizeRequiredString(
      options.category,
      'Category',
      '--category'
    ),
    display_category: normalizeRequiredString(
      options.displayCategory,
      'Display category',
      '--display-category'
    ),
    os: normalizeRequiredString(options.os, 'OS', '--os'),
    osversion: normalizeRequiredString(
      options.osVersion,
      'OS version',
      '--os-version'
    )
  };
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

function writeDeleteCancelled(
  runtime: CliRuntime,
  globalOptions: GlobalOptions,
  nodeId: string
): void {
  if (globalOptions.json ?? false) {
    runtime.stdout.write(
      formatJson({
        action: 'delete',
        cancelled: true,
        node_id: Number(nodeId)
      })
    );
    return;
  }

  runtime.stdout.write('Deletion cancelled.\n');
}

function sortNodeCatalogPlans(plans: NodeCatalogPlan[]): NodeCatalogPlan[] {
  return [...plans].sort((left, right) => {
    const leftKey = [
      left.name,
      left.plan,
      left.image,
      left.location ?? '',
      left.specs?.series ?? ''
    ].join('\u0000');
    const rightKey = [
      right.name,
      right.plan,
      right.image,
      right.location ?? '',
      right.specs?.series ?? ''
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}
