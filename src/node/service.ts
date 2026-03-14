import {
  resolveCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { SshKeyClient, SshKeySummary } from '../ssh-key/index.js';
import type { VolumeClient } from '../volume/index.js';
import type { VpcClient } from '../vpc/index.js';
import type { NodeClient } from './client.js';
import { buildDefaultNodeCreateRequest } from './defaults.js';
import type {
  NodeActionResult,
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

export interface NodeSaveImageOptions extends NodeContextOptions {
  name: string;
}

export interface NodeVpcActionOptions extends NodeContextOptions {
  privateIp?: string;
  subnetId?: string;
  vpcId: string;
}

export interface NodeVolumeActionOptions extends NodeContextOptions {
  volumeId: string;
}

export interface NodeSshKeyAttachOptions extends NodeContextOptions {
  sshKeyIds: string[];
}

export interface NodeActionStatusSummary {
  action_id: number;
  created_at: string;
  image_id: string | null;
  status: string;
}

export interface NodeResolvedSshKeySummary {
  id: number;
  label: string;
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

export interface NodePowerOnCommandResult {
  action: 'power-on';
  node_id: number;
  result: NodeActionStatusSummary;
}

export interface NodePowerOffCommandResult {
  action: 'power-off';
  node_id: number;
  result: NodeActionStatusSummary;
}

export interface NodeSaveImageCommandResult {
  action: 'save-image';
  image_name: string;
  node_id: number;
  result: NodeActionStatusSummary;
}

export interface NodeVpcAttachCommandResult {
  action: 'vpc-attach';
  node_id: number;
  result: {
    message: string;
    project_id: string | null;
  };
  vpc: {
    id: number;
    name: string;
    private_ip: string | null;
    subnet_id: number | null;
  };
}

export interface NodeVpcDetachCommandResult {
  action: 'vpc-detach';
  node_id: number;
  result: {
    message: string;
    project_id: string | null;
  };
  vpc: {
    id: number;
    name: string;
    private_ip: string | null;
    subnet_id: number | null;
  };
}

export interface NodeVolumeAttachCommandResult {
  action: 'volume-attach';
  node_id: number;
  node_vm_id: number;
  result: {
    message: string;
  };
  volume: {
    id: number;
  };
}

export interface NodeVolumeDetachCommandResult {
  action: 'volume-detach';
  node_id: number;
  node_vm_id: number;
  result: {
    message: string;
  };
  volume: {
    id: number;
  };
}

export interface NodeSshKeyAttachCommandResult {
  action: 'ssh-key-attach';
  node_id: number;
  result: NodeActionStatusSummary;
  ssh_keys: NodeResolvedSshKeySummary[];
}

export type NodeCommandResult =
  | NodeCatalogOsCommandResult
  | NodeCatalogPlansCommandResult
  | NodeCreateCommandResult
  | NodeDeleteCommandResult
  | NodeGetCommandResult
  | NodeListCommandResult
  | NodePowerOffCommandResult
  | NodePowerOnCommandResult
  | NodeSaveImageCommandResult
  | NodeSshKeyAttachCommandResult
  | NodeVolumeAttachCommandResult
  | NodeVolumeDetachCommandResult
  | NodeVpcAttachCommandResult
  | NodeVpcDetachCommandResult;

interface NodeStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface NodeServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
  createSshKeyClient(credentials: ResolvedCredentials): SshKeyClient;
  createVolumeClient(credentials: ResolvedCredentials): VolumeClient;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  isInteractive: boolean;
  store: NodeStore;
}

interface ResolvedSshKey {
  id: number;
  label: string;
  ssh_key: string;
}

export class NodeService {
  constructor(private readonly dependencies: NodeServiceDependencies) {}

  async attachSshKeys(
    nodeId: string,
    options: NodeSshKeyAttachOptions
  ): Promise<NodeSshKeyAttachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const credentials = await this.resolveContext(options);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const sshKeyClient = this.dependencies.createSshKeyClient(credentials);
    const sshKeyIds = normalizeDistinctNumericIds(
      options.sshKeyIds,
      'SSH key ID',
      '--ssh-key-id'
    );
    const resolvedKeys = resolveSavedSshKeys(
      await sshKeyClient.listSshKeys(),
      sshKeyIds
    );
    const result = await nodeClient.attachSshKeys(
      String(normalizedNodeId),
      resolvedKeys.map((key) => ({
        label: key.label,
        ssh_key: key.ssh_key
      }))
    );

    return {
      action: 'ssh-key-attach',
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result),
      ssh_keys: resolvedKeys.map(({ id, label }) => ({
        id,
        label
      }))
    };
  }

  async attachVpc(
    nodeId: string,
    options: NodeVpcActionOptions
  ): Promise<NodeVpcAttachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const vpcId = normalizeRequiredNumericId(
      options.vpcId,
      'VPC ID',
      '--vpc-id'
    );
    const subnetId = normalizeOptionalNumericId(
      options.subnetId,
      'Subnet ID',
      '--subnet-id'
    );
    const privateIp = normalizeOptionalString(
      options.privateIp,
      'Private IP',
      '--private-ip'
    );
    const credentials = await this.resolveContext(options);
    const client = this.dependencies.createVpcClient(credentials);
    const result = await client.attachNodeVpc({
      action: 'attach',
      ...(privateIp === null ? {} : { input_ip: privateIp }),
      network_id: vpcId,
      node_id: normalizedNodeId,
      ...(subnetId === null ? {} : { subnet_id: subnetId })
    });

    return {
      action: 'vpc-attach',
      node_id: normalizedNodeId,
      result: {
        message: result.message,
        project_id: result.project_id ?? null
      },
      vpc: {
        id: vpcId,
        name: result.vpc_name,
        private_ip: privateIp,
        subnet_id: subnetId
      }
    };
  }

  async attachVolume(
    nodeId: string,
    options: NodeVolumeActionOptions
  ): Promise<NodeVolumeAttachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const volumeId = normalizeRequiredNumericId(
      options.volumeId,
      'Volume ID',
      '--volume-id'
    );
    const credentials = await this.resolveContext(options);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const volumeClient = this.dependencies.createVolumeClient(credentials);
    const nodeVmId = await this.resolveNodeVmId(nodeClient, normalizedNodeId);
    const result = await volumeClient.attachVolumeToNode(volumeId, {
      vm_id: nodeVmId
    });

    return {
      action: 'volume-attach',
      node_id: normalizedNodeId,
      node_vm_id: nodeVmId,
      result: {
        message: result.message
      },
      volume: {
        id: volumeId
      }
    };
  }

  async createNode(
    options: NodeCreateOptions
  ): Promise<NodeCreateCommandResult> {
    const client = await this.createNodeClient(options);
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
    const normalizedNodeId = assertNodeId(nodeId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete node ${normalizedNodeId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          node_id: normalizedNodeId
        };
      }
    }

    const client = await this.createNodeClient(options);
    const result = await client.deleteNode(String(normalizedNodeId));

    return {
      action: 'delete',
      cancelled: false,
      message: result.message,
      node_id: normalizedNodeId
    };
  }

  async detachVpc(
    nodeId: string,
    options: NodeVpcActionOptions
  ): Promise<NodeVpcDetachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const vpcId = normalizeRequiredNumericId(
      options.vpcId,
      'VPC ID',
      '--vpc-id'
    );
    const subnetId = normalizeOptionalNumericId(
      options.subnetId,
      'Subnet ID',
      '--subnet-id'
    );
    const privateIp = normalizeOptionalString(
      options.privateIp,
      'Private IP',
      '--private-ip'
    );
    const credentials = await this.resolveContext(options);
    const client = this.dependencies.createVpcClient(credentials);
    const result = await client.detachNodeVpc({
      action: 'detach',
      ...(privateIp === null ? {} : { input_ip: privateIp }),
      network_id: vpcId,
      node_id: normalizedNodeId,
      ...(subnetId === null ? {} : { subnet_id: subnetId })
    });

    return {
      action: 'vpc-detach',
      node_id: normalizedNodeId,
      result: {
        message: result.message,
        project_id: result.project_id ?? null
      },
      vpc: {
        id: vpcId,
        name: result.vpc_name,
        private_ip: privateIp,
        subnet_id: subnetId
      }
    };
  }

  async detachVolume(
    nodeId: string,
    options: NodeVolumeActionOptions
  ): Promise<NodeVolumeDetachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const volumeId = normalizeRequiredNumericId(
      options.volumeId,
      'Volume ID',
      '--volume-id'
    );
    const credentials = await this.resolveContext(options);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const volumeClient = this.dependencies.createVolumeClient(credentials);
    const nodeVmId = await this.resolveNodeVmId(nodeClient, normalizedNodeId);
    const result = await volumeClient.detachVolumeFromNode(volumeId, {
      vm_id: nodeVmId
    });

    return {
      action: 'volume-detach',
      node_id: normalizedNodeId,
      node_vm_id: nodeVmId,
      result: {
        message: result.message
      },
      volume: {
        id: volumeId
      }
    };
  }

  async getNode(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodeGetCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const client = await this.createNodeClient(options);

    return {
      action: 'get',
      node: await client.getNode(String(normalizedNodeId))
    };
  }

  async listCatalogOs(
    options: NodeContextOptions
  ): Promise<NodeCatalogOsCommandResult> {
    const client = await this.createNodeClient(options);

    return {
      action: 'catalog-os',
      catalog: await client.listNodeCatalogOs()
    };
  }

  async listCatalogPlans(
    options: NodeCatalogPlansOptions
  ): Promise<NodeCatalogPlansCommandResult> {
    const client = await this.createNodeClient(options);
    const query = buildNodeCatalogQuery(options);

    return {
      action: 'catalog-plans',
      plans: await client.listNodeCatalogPlans(query),
      query
    };
  }

  async listNodes(options: NodeContextOptions): Promise<NodeListCommandResult> {
    const client = await this.createNodeClient(options);
    const result = await client.listNodes();

    return {
      action: 'list',
      ...result
    };
  }

  async powerOffNode(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodePowerOffCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const client = await this.createNodeClient(options);
    const result = await client.powerOffNode(String(normalizedNodeId));

    return {
      action: 'power-off',
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result)
    };
  }

  async powerOnNode(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodePowerOnCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const client = await this.createNodeClient(options);
    const result = await client.powerOnNode(String(normalizedNodeId));

    return {
      action: 'power-on',
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result)
    };
  }

  async saveNodeImage(
    nodeId: string,
    options: NodeSaveImageOptions
  ): Promise<NodeSaveImageCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const imageName = normalizeRequiredString(options.name, 'Name', '--name');
    const client = await this.createNodeClient(options);
    const result = await client.saveNodeImage(
      String(normalizedNodeId),
      imageName
    );

    return {
      action: 'save-image',
      image_name: imageName,
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result)
    };
  }

  private async createNodeClient(
    options: NodeContextOptions
  ): Promise<NodeClient> {
    return this.dependencies.createNodeClient(
      await this.resolveContext(options)
    );
  }

  private async resolveContext(
    options: NodeContextOptions
  ): Promise<ResolvedCredentials> {
    const config = await this.dependencies.store.read();

    return resolveCredentials({
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
  }

  private async resolveNodeVmId(
    nodeClient: NodeClient,
    nodeId: number
  ): Promise<number> {
    const node = await nodeClient.getNode(String(nodeId));
    const vmId = node.vm_id;

    if (vmId !== undefined && Number.isInteger(vmId) && vmId > 0) {
      return vmId;
    }

    throw new CliError(
      'The MyAccount API did not return a VM ID for this node.',
      {
        code: 'INVALID_NODE_DETAILS',
        details: [`Node ID: ${nodeId}`],
        exitCode: EXIT_CODES.network,
        suggestion:
          'Retry the command. If the problem persists, inspect the node details response.'
      }
    );
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

function assertNodeId(nodeId: string): number {
  if (!/^\d+$/.test(nodeId)) {
    throw new CliError('Node ID must be numeric.', {
      code: 'INVALID_NODE_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric node id as the first argument.'
    });
  }

  return Number(nodeId);
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

function normalizeDistinctNumericIds(
  values: string[],
  label: string,
  flag: string
): number[] {
  if (values.length === 0) {
    throw new CliError(`At least one ${label} is required.`, {
      code: 'MISSING_REQUIRED_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass one or more values with ${flag}.`
    });
  }

  const seen = new Set<number>();
  const normalizedValues: number[] = [];

  for (const value of values) {
    const normalizedValue = normalizeRequiredNumericId(value, label, flag);
    if (!seen.has(normalizedValue)) {
      seen.add(normalizedValue);
      normalizedValues.push(normalizedValue);
    }
  }

  return normalizedValues;
}

function normalizeOptionalNumericId(
  value: string | undefined,
  label: string,
  flag: string
): number | null {
  return value === undefined
    ? null
    : normalizeRequiredNumericId(value, label, flag);
}

function normalizeOptionalString(
  value: string | undefined,
  label: string,
  flag: string
): string | null {
  return value === undefined
    ? null
    : normalizeRequiredString(value, label, flag);
}

function normalizeRequiredNumericId(
  value: string,
  label: string,
  flag: string
): number {
  const normalized = normalizeRequiredString(value, label, flag);

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  throw new CliError(`${label} must be numeric.`, {
    code: 'INVALID_NUMERIC_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass the numeric ${label.toLowerCase()} with ${flag}.`
  });
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

function resolveSavedSshKeys(
  availableKeys: SshKeySummary[],
  requestedIds: number[]
): ResolvedSshKey[] {
  const keyMap = new Map<number, SshKeySummary>();

  for (const key of availableKeys) {
    keyMap.set(key.pk, key);
  }

  const missingIds = requestedIds.filter((id) => !keyMap.has(id));
  if (missingIds.length > 0) {
    throw new CliError(
      missingIds.length === 1
        ? `Unknown SSH key ID: ${missingIds[0]}.`
        : `Unknown SSH key IDs: ${missingIds.join(', ')}.`,
      {
        code: 'SSH_KEY_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Run e2ectl ssh-key list to inspect saved SSH key ids, then retry with one or more listed ids.'
      }
    );
  }

  return requestedIds.map((id) => {
    const key = keyMap.get(id);

    if (key === undefined) {
      throw new Error(`Expected SSH key ${id} to exist after validation.`);
    }

    return {
      id: key.pk,
      label: key.label,
      ssh_key: key.ssh_key
    };
  });
}

function summarizeNodeAction(
  result: NodeActionResult
): NodeActionStatusSummary {
  return {
    action_id: result.id,
    created_at: result.created_at,
    image_id: result.image_id ?? null,
    status: result.status
  };
}
