import { Command } from 'commander';
import { resolveCredentials } from '../client/auth.js';
import {
  formatJson,
  formatNodeDetails,
  formatNodesTable
} from '../output/formatter.js';
import type { CliRuntime } from '../runtime.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

export function buildNodeCommand(runtime: CliRuntime): Command {
  const command = new Command('node').description('Manage MyAccount nodes.');

  command
    .command('list')
    .description(
      'List nodes for the selected profile or environment credentials.'
    )
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(async (options: { alias?: string }, commandInstance: Command) => {
      const client = await createNodeClient(runtime, options.alias);
      const response = await client.listNodes();

      if (commandInstance.optsWithGlobals<{ json?: boolean }>().json ?? false) {
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
    .command('get <nodeId>')
    .description('Get details for a node.')
    .option('--alias <alias>', 'Saved profile alias to use for this command.')
    .action(
      async (
        nodeId: string,
        options: { alias?: string },
        commandInstance: Command
      ) => {
        assertNodeId(nodeId);
        const client = await createNodeClient(runtime, options.alias);
        const response = await client.getNode(nodeId);

        if (
          commandInstance.optsWithGlobals<{ json?: boolean }>().json ??
          false
        ) {
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

function assertNodeId(nodeId: string): void {
  if (!/^\d+$/.test(nodeId)) {
    throw new CliError('Node ID must be numeric.', {
      code: 'INVALID_NODE_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric node id as the first argument.'
    });
  }
}
