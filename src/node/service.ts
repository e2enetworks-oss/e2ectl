import {
  resolveCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import { buildDefaultNodeCreateRequest } from './defaults.js';
import type {
  NodeCatalogOsData,
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateRequest,
  NodeCreateResult,
  NodeDetails,
  NodeListResponse
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
  response: NodeListResponse;
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

interface NodeEnvelope<TData> {
  data: TData;
  message: string;
}

interface NodeClient {
  createNode(body: NodeCreateRequest): Promise<NodeEnvelope<NodeCreateResult>>;
  deleteNode(nodeId: string): Promise<NodeEnvelope<Record<string, never>>>;
  getNode(nodeId: string): Promise<NodeEnvelope<NodeDetails>>;
  listNodeCatalogOs(): Promise<NodeEnvelope<NodeCatalogOsData>>;
  listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<NodeEnvelope<NodeCatalogPlan[]>>;
  listNodes(): Promise<NodeListResponse>;
}

interface NodeStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface NodeServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createApiClient(credentials: ResolvedCredentials): NodeClient;
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
      result: result.data
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
    const response = await client.deleteNode(nodeId);

    return {
      action: 'delete',
      cancelled: false,
      message: response.message,
      node_id: Number(nodeId)
    };
  }

  async getNode(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodeGetCommandResult> {
    assertNodeId(nodeId);
    const client = await this.createClient(options);
    const response = await client.getNode(nodeId);

    return {
      action: 'get',
      node: response.data
    };
  }

  async listCatalogOs(
    options: NodeContextOptions
  ): Promise<NodeCatalogOsCommandResult> {
    const client = await this.createClient(options);
    const response = await client.listNodeCatalogOs();

    return {
      action: 'catalog-os',
      catalog: response.data
    };
  }

  async listCatalogPlans(
    options: NodeCatalogPlansOptions
  ): Promise<NodeCatalogPlansCommandResult> {
    const client = await this.createClient(options);
    const query = buildNodeCatalogQuery(options);
    const response = await client.listNodeCatalogPlans(query);

    return {
      action: 'catalog-plans',
      plans: response.data,
      query
    };
  }

  async listNodes(options: NodeContextOptions): Promise<NodeListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      response: await client.listNodes()
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

    return this.dependencies.createApiClient(credentials);
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
