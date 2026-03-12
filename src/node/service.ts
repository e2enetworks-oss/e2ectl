import {
  resolveCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { NodeClient } from './client.js';
import { buildDefaultNodeCreateRequest } from './defaults.js';
import type {
  NodeCatalogOsData,
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateResult,
  NodeDetails,
  NodeListResult
} from './types.js';

export interface NodeContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface NodeCreateOptions extends NodeContextOptions {
  image: string;
  name: string;
  plan: string;
}

export interface NodeDeleteOptions extends NodeContextOptions {
  force?: boolean;
}

export interface NodeCatalogPlansOptions extends NodeContextOptions {
  category: string;
  displayCategory: string;
  os: string;
  osVersion: string;
}

export interface NodeListCommandResult {
  action: 'list';
  nodes: NodeListResult['nodes'];
  total_count?: number;
  total_page_number?: number;
}

export interface NodeCreateCommandResult {
  action: 'create';
  result: NodeCreateResult;
}

export interface NodeGetCommandResult {
  action: 'get';
  node: NodeDetails;
}

export interface NodeDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  message?: string;
  node_id: number;
}

export interface NodeCatalogOsCommandResult {
  action: 'catalog-os';
  catalog: NodeCatalogOsData;
}

export interface NodeCatalogPlansCommandResult {
  action: 'catalog-plans';
  plans: NodeCatalogPlan[];
  query: NodeCatalogQuery;
}

export type NodeCommandResult =
  | NodeCatalogOsCommandResult
  | NodeCatalogPlansCommandResult
  | NodeCreateCommandResult
  | NodeDeleteCommandResult
  | NodeGetCommandResult
  | NodeListCommandResult;

interface NodeStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface NodeServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
  isInteractive: boolean;
  store: NodeStore;
}

export class NodeService {
  constructor(private readonly dependencies: NodeServiceDependencies) {}

  async createNode(
    options: NodeCreateOptions
  ): Promise<NodeCreateCommandResult> {
    const client = await this.createClient(options);
    const result = await client.createNode(
      buildDefaultNodeCreateRequest({
        image: normalizeRequiredString(options.image, 'Image', '--image'),
        name: normalizeRequiredString(options.name, 'Name', '--name'),
        plan: normalizeRequiredString(options.plan, 'Plan', '--plan')
      })
    );

    return {
      action: 'create',
      result
    };
  }

  async deleteNode(
    nodeId: string,
    options: NodeDeleteOptions
  ): Promise<NodeDeleteCommandResult> {
    assertNodeId(nodeId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete node ${nodeId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          node_id: Number(nodeId)
        };
      }
    }

    const client = await this.createClient(options);
    const result = await client.deleteNode(nodeId);

    return {
      action: 'delete',
      cancelled: false,
      message: result.message,
      node_id: Number(nodeId)
    };
  }

  async getNode(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodeGetCommandResult> {
    assertNodeId(nodeId);
    const client = await this.createClient(options);

    return {
      action: 'get',
      node: await client.getNode(nodeId)
    };
  }

  async listCatalogOs(
    options: NodeContextOptions
  ): Promise<NodeCatalogOsCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'catalog-os',
      catalog: await client.listNodeCatalogOs()
    };
  }

  async listCatalogPlans(
    options: NodeCatalogPlansOptions
  ): Promise<NodeCatalogPlansCommandResult> {
    const client = await this.createClient(options);
    const query = buildNodeCatalogQuery(options);

    return {
      action: 'catalog-plans',
      plans: await client.listNodeCatalogPlans(query),
      query
    };
  }

  async listNodes(options: NodeContextOptions): Promise<NodeListCommandResult> {
    const client = await this.createClient(options);
    const result = await client.listNodes();

    return {
      action: 'list',
      ...result
    };
  }

  private async createClient(options: NodeContextOptions): Promise<NodeClient> {
    const config = await this.dependencies.store.read();
    const credentials = resolveCredentials({
      ...(options.alias === undefined ? {} : { alias: options.alias }),
      config,
      configPath: this.dependencies.store.configPath,
      ...(options.projectId === undefined
        ? {}
        : {
            projectId: options.projectId
          }),
      ...(options.location === undefined
        ? {}
        : {
            location: options.location
          })
    });

    return this.dependencies.createNodeClient(credentials);
  }
}

function assertCanDelete(isInteractive: boolean): void {
  if (isInteractive) {
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

function buildNodeCatalogQuery(
  options: NodeCatalogPlansOptions
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
