import { isIPv4 } from 'node:net';

import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { NodeClient, NodeDetails } from '../node/index.js';
import type { ReservedIpClient } from './client.js';
import type {
  ReservedIpFloatingAttachmentNode,
  ReservedIpNodeActionResult,
  ReservedIpSummary
} from './types.js';

export interface ReservedIpContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface ReservedIpDeleteOptions extends ReservedIpContextOptions {
  force?: boolean;
}

export interface ReservedIpNodeTargetOptions extends ReservedIpContextOptions {
  nodeId: string;
}

export type ReservedIpNodeActionOptions = ReservedIpNodeTargetOptions;

export interface ReservedIpAttachmentNodeItem {
  id: number | null;
  ip_address_private: string | null;
  ip_address_public: string | null;
  name: string | null;
  security_group_status: string | null;
  status_name: string | null;
  vm_id: number | null;
}

export interface ReservedIpItem {
  appliance_type: string | null;
  bought_at: string | null;
  floating_ip_attached_nodes: ReservedIpAttachmentNodeItem[];
  ip_address: string;
  project_name: string | null;
  reserve_id: number | null;
  reserved_type: string | null;
  status: string | null;
  vm_id: number | null;
  vm_name: string | null;
}

export interface ReservedIpListCommandResult {
  action: 'list';
  items: ReservedIpItem[];
}

export interface ReservedIpGetCommandResult {
  action: 'get';
  reserved_ip: ReservedIpItem;
}

export interface ReservedIpCreateCommandResult {
  action: 'create';
  reserved_ip: ReservedIpItem;
  source: 'default-network';
}

export interface ReservedIpDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  ip_address: string;
  message?: string;
}

export interface ReservedIpNodeActionCommandResult {
  action: 'attach-node' | 'detach-node';
  message: string;
  node_id: number;
  reserved_ip: {
    ip_address: string;
    status: string | null;
    vm_id: number | null;
    vm_name: string | null;
  };
}

export interface ReservedIpReserveNodeCommandResult {
  action: 'reserve-node';
  ip_address: string;
  message: string;
  node_id: number;
  status: string | null;
}

export type ReservedIpCommandResult =
  | ReservedIpCreateCommandResult
  | ReservedIpDeleteCommandResult
  | ReservedIpGetCommandResult
  | ReservedIpListCommandResult
  | ReservedIpNodeActionCommandResult
  | ReservedIpReserveNodeCommandResult;

interface ReservedIpStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface ReservedIpServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createNodeClient(credentials: ResolvedCredentials): NodeClient;
  createReservedIpClient(credentials: ResolvedCredentials): ReservedIpClient;
  isInteractive: boolean;
  store: ReservedIpStore;
}

const RESERVED_IP_POLL_ATTEMPTS = 8;
const RESERVED_IP_POLL_INTERVAL_MS = 1_500;

export class ReservedIpService {
  constructor(private readonly dependencies: ReservedIpServiceDependencies) {}

  async attachReservedIpToNode(
    ipAddress: string,
    options: ReservedIpNodeTargetOptions
  ): Promise<ReservedIpNodeActionCommandResult> {
    const normalizedIpAddress = assertReservedIpAddress(ipAddress);
    const normalizedNodeId = assertNodeId(options.nodeId);
    const credentials = await this.resolveContext(options);
    const reservedIpClient =
      this.dependencies.createReservedIpClient(credentials);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const nodeVmId = await resolveNodeVmId(nodeClient, normalizedNodeId);
    const result = await reservedIpClient.attachReservedIpToNode(
      normalizedIpAddress,
      {
        type: 'attach',
        vm_id: nodeVmId
      }
    );

    return summarizeReservedIpNodeAction(
      'attach-node',
      normalizedNodeId,
      result
    );
  }

  async createReservedIp(
    options: ReservedIpContextOptions
  ): Promise<ReservedIpCreateCommandResult> {
    const client = await this.createClient(options);
    const createdReservedIp = normalizeReservedIpItem(
      await client.createReservedIp()
    );
    const reservedIp = await findReservedIpInInventoryWithRetry(
      client,
      createdReservedIp.ip_address
    );

    if (reservedIp === undefined) {
      throw new CliError(
        `Reserved IP ${createdReservedIp.ip_address} did not appear in inventory after the create request succeeded.`,
        {
          code: 'RESERVED_IP_INVENTORY_TIMEOUT',
          exitCode: EXIT_CODES.network,
          suggestion: `Run ${formatCliCommand('reserved-ip list')} to confirm the latest inventory, then retry if needed.`
        }
      );
    }

    return {
      action: 'create',
      reserved_ip: reservedIp,
      source: 'default-network'
    };
  }

  async deleteReservedIp(
    ipAddress: string,
    options: ReservedIpDeleteOptions
  ): Promise<ReservedIpDeleteCommandResult> {
    const normalizedIpAddress = assertReservedIpAddress(ipAddress);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete reserved IP ${normalizedIpAddress}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          ip_address: normalizedIpAddress
        };
      }
    }

    const client = await this.createClient(options);
    const result = await client.deleteReservedIp(normalizedIpAddress);

    return {
      action: 'delete',
      cancelled: false,
      ip_address: normalizedIpAddress,
      message: result.message
    };
  }

  async detachReservedIpFromNode(
    ipAddress: string,
    options: ReservedIpNodeTargetOptions
  ): Promise<ReservedIpNodeActionCommandResult> {
    const normalizedIpAddress = assertReservedIpAddress(ipAddress);
    const normalizedNodeId = assertNodeId(options.nodeId);
    const credentials = await this.resolveContext(options);
    const reservedIpClient =
      this.dependencies.createReservedIpClient(credentials);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const nodeVmId = await resolveNodeVmId(nodeClient, normalizedNodeId);
    const result = await reservedIpClient.detachReservedIpFromNode(
      normalizedIpAddress,
      {
        type: 'detach',
        vm_id: nodeVmId
      }
    );

    return summarizeReservedIpNodeAction(
      'detach-node',
      normalizedNodeId,
      result
    );
  }

  async reserveNodePublicIp(
    options: ReservedIpNodeTargetOptions
  ): Promise<ReservedIpReserveNodeCommandResult> {
    const normalizedNodeId = assertNodeId(options.nodeId, '<nodeId>');
    const credentials = await this.resolveContext(options);
    const reservedIpClient =
      this.dependencies.createReservedIpClient(credentials);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const nodeDetails = await getNodeDetails(nodeClient, normalizedNodeId);
    const nodeVmId = assertNodeVmId(nodeDetails, normalizedNodeId);
    const nodePublicIp = assertNodePublicIp(nodeDetails, normalizedNodeId);
    const result = await reservedIpClient.reserveNodePublicIp(nodePublicIp, {
      type: 'live-reserve',
      vm_id: nodeVmId
    });

    return {
      action: 'reserve-node',
      ip_address: result.ip_address,
      message: result.message,
      node_id: normalizedNodeId,
      status: result.status
    };
  }

  async getReservedIp(
    ipAddress: string,
    options: ReservedIpContextOptions
  ): Promise<ReservedIpGetCommandResult> {
    const normalizedIpAddress = assertReservedIpAddress(ipAddress);
    const client = await this.createClient(options);
    const item = await findReservedIpInInventoryWithRetry(
      client,
      normalizedIpAddress
    );

    if (item === undefined) {
      throw buildReservedIpNotFoundError(normalizedIpAddress);
    }

    return {
      action: 'get',
      reserved_ip: item
    };
  }

  async listReservedIps(
    options: ReservedIpContextOptions
  ): Promise<ReservedIpListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      items: (await client.listReservedIps()).map((item) =>
        normalizeReservedIpItem(item)
      )
    };
  }

  private async createClient(
    options: ReservedIpContextOptions
  ): Promise<ReservedIpClient> {
    return this.dependencies.createReservedIpClient(
      await this.resolveContext(options)
    );
  }

  private async resolveContext(
    options: ReservedIpContextOptions
  ): Promise<ResolvedCredentials> {
    return await resolveStoredCredentials(this.dependencies.store, options);
  }
}

function summarizeReservedIpNodeAction(
  action: 'attach-node' | 'detach-node',
  nodeId: number,
  result: ReservedIpNodeActionResult
): ReservedIpNodeActionCommandResult {
  return {
    action,
    message: result.message,
    node_id: nodeId,
    reserved_ip: {
      ip_address: result.ip_address,
      status: result.status,
      vm_id: result.vm_id,
      vm_name: result.vm_name
    }
  };
}

function normalizeReservedIpItem(item: ReservedIpSummary): ReservedIpItem {
  return {
    appliance_type: normalizeOptionalString(item.appliance_type),
    bought_at: normalizeOptionalString(item.bought_at),
    floating_ip_attached_nodes: normalizeFloatingAttachmentNodes(
      item.floating_ip_attached_nodes ?? []
    ),
    ip_address: item.ip_address,
    project_name: normalizeOptionalString(item.project_name),
    reserve_id: normalizeOptionalInteger(item.reserve_id),
    reserved_type: normalizeOptionalString(item.reserved_type),
    status: normalizeOptionalString(item.status),
    vm_id: normalizeOptionalInteger(item.vm_id),
    vm_name: normalizeOptionalString(item.vm_name)
  };
}

function normalizeFloatingAttachmentNodes(
  items: ReservedIpFloatingAttachmentNode[]
): ReservedIpAttachmentNodeItem[] {
  return items.map((item) => ({
    id: normalizeOptionalInteger(item.id),
    ip_address_private: normalizeOptionalString(item.ip_address_private),
    ip_address_public: normalizeOptionalString(item.ip_address_public),
    name: normalizeOptionalString(item.name),
    security_group_status: normalizeOptionalString(item.security_group_status),
    status_name: normalizeOptionalString(item.status_name),
    vm_id: normalizeOptionalInteger(item.vm_id)
  }));
}

function assertCanDelete(isInteractive: boolean): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(
    'Deleting a reserved IP requires confirmation in an interactive terminal.',
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}

function assertNodeId(nodeId: string, flagName = '--node-id'): number {
  if (!/^\d+$/.test(nodeId)) {
    throw new CliError('Node ID must be numeric.', {
      code: 'INVALID_NODE_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: flagName.startsWith('--')
        ? `Pass the numeric e2ectl node id with ${flagName}.`
        : `Pass the numeric e2ectl node id as ${flagName}.`
    });
  }

  return Number(nodeId);
}

function assertReservedIpAddress(ipAddress: string): string {
  const normalized = ipAddress.trim();

  if (isIPv4(normalized)) {
    return normalized;
  }

  throw new CliError('Reserved IP address must be a valid IPv4 address.', {
    code: 'INVALID_RESERVED_IP_ADDRESS',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass a valid IPv4 address like 164.52.198.54 as the first argument.'
  });
}

function buildReservedIpNotFoundError(ipAddress: string): CliError {
  return new CliError(`Reserved IP ${ipAddress} was not found.`, {
    code: 'RESERVED_IP_NOT_FOUND',
    exitCode: EXIT_CODES.network,
    suggestion: `Run ${formatCliCommand('reserved-ip list')} to inspect available reserved IPs, then retry with an exact ip_address.`
  });
}

async function findReservedIpInInventoryWithRetry(
  client: ReservedIpClient,
  ipAddress: string
): Promise<ReservedIpItem | undefined> {
  for (let attempt = 1; attempt <= RESERVED_IP_POLL_ATTEMPTS; attempt += 1) {
    const item = await findReservedIpInInventory(client, ipAddress);

    if (item !== undefined) {
      return item;
    }

    if (attempt < RESERVED_IP_POLL_ATTEMPTS) {
      await wait(RESERVED_IP_POLL_INTERVAL_MS);
    }
  }

  return undefined;
}

async function findReservedIpInInventory(
  client: ReservedIpClient,
  ipAddress: string
): Promise<ReservedIpItem | undefined> {
  const items = (await client.listReservedIps()).map((item) =>
    normalizeReservedIpItem(item)
  );

  return items.find((candidate) => candidate.ip_address === ipAddress);
}

async function resolveNodeVmId(
  nodeClient: NodeClient,
  nodeId: number
): Promise<number> {
  return assertNodeVmId(await getNodeDetails(nodeClient, nodeId), nodeId);
}

async function getNodeDetails(
  nodeClient: NodeClient,
  nodeId: number
): Promise<NodeDetails> {
  return await nodeClient.getNode(String(nodeId));
}

function assertNodeVmId(node: NodeDetails, nodeId: number): number {
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

function assertNodePublicIp(node: NodeDetails, nodeId: number): string {
  const publicIp = node.public_ip_address?.trim();

  if (publicIp !== undefined && publicIp.length > 0 && isIPv4(publicIp)) {
    return publicIp;
  }

  throw new CliError(
    'This node does not have a current public IP to reserve.',
    {
      code: 'NODE_PUBLIC_IP_UNAVAILABLE',
      details: [`Node ID: ${nodeId}`],
      exitCode: EXIT_CODES.network,
      suggestion:
        'Pick a node with an assigned public IP, then retry the reserve command.'
    }
  );
}

function normalizeOptionalInteger(
  value: number | null | undefined
): number | null {
  return value !== undefined && Number.isInteger(value) ? value : null;
}

function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return value;
}

async function wait(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
