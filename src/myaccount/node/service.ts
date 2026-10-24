import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../../config/index.js';
import { formatMyAccountCommand } from '../api.js';
import { confirmUnlessForced } from '../../core/confirm.js';
import { AppError, CliError, EXIT_CODES } from '../../core/errors.js';
import { pollUntilFound, type PollOptions } from '../../core/waiter.js';
import type { ReservedIpClient } from '../reserved-ip/index.js';
import type { SecurityGroupClient } from '../security-group/index.js';
import {
  normalizeSnapshotId,
  toSnapshotItem,
  type SnapshotItem
} from '../snapshot/index.js';
import type { SshKeyClient, SshKeySummary } from '../ssh-key/index.js';
import type { VolumeClient } from '../volume/index.js';
import type { VpcClient } from '../vpc/index.js';
import {
  buildNodeCatalogQuery,
  normalizeNodeCatalogBillingType,
  normalizeNodeCatalogPlanFilters,
  normalizeNodeCatalogPlanItems,
  summarizeNodeCatalogOs,
  summarizeNodeCatalogPlans
} from './catalog.js';
import type { NodeClient } from './client.js';
import {
  CUSTOM_STORAGE_DEFAULT_DISK_GB,
  CUSTOM_STORAGE_DOWNSIZE_STEP_GB,
  CUSTOM_STORAGE_MAX_DISK_GB,
  CUSTOM_STORAGE_MIN_DISK_GB,
  CUSTOM_STORAGE_UPSIZE_STEP_GB,
  formatCustomStorageDiskHint,
  isCustomStorageDiskSizeAllowed,
  isCustomStoragePlan
} from './custom-storage.js';
import { buildDefaultNodeCreateRequest } from './defaults.js';
import {
  normalizeBillingType,
  normalizeOptionalNumericId,
  normalizeOptionalString,
  normalizeRequiredNumericId,
  normalizeRequiredString
} from './normalizers.js';
import type {
  NodeActionSshKey,
  NodeActionResult,
  NodeCatalogOsEntry,
  NodeCatalogPlanItem,
  NodeCatalogPlansQuery,
  NodeCreateBillingType,
  NodeCreateRequest,
  NodeCreateResult,
  NodeDetails,
  NodeListResult,
  NodeCommittedCreateStatus,
  NodeUpgradeResult
} from './types.js';

export interface NodeContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface NodeCreateOptions extends NodeContextOptions {
  billingType?: string;
  wait?: boolean;
  committedPlanId?: string;
  disk?: string;
  image?: string;
  name: string;
  plan: string;
  savedImageTemplateId?: string;
  sshKeyIds?: string[];
}

export interface NodeDeleteOptions extends NodeContextOptions {
  force?: boolean;
  reservePublicIp?: boolean;
}

export interface NodeUpgradeOptions extends NodeContextOptions {
  force?: boolean;
  // Leave out to keep the image the node runs now.
  image?: string;
  plan: string;
}

export interface NodePublicIpDetachOptions extends NodeContextOptions {
  force?: boolean;
}

export interface NodeCatalogPlansOptions extends NodeContextOptions {
  billingType?: string;
  category: string;
  displayCategory: string;
  family?: string;
  gpuType?: string;
  minRam?: string;
  minVcpu?: string;
  os: string;
  osVersion: string;
}

export interface NodeSaveImageOptions extends NodeContextOptions {
  name: string;
}

export interface NodeSecurityGroupActionOptions extends NodeContextOptions {
  securityGroupIds: string[];
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

export interface NodeCreateBillingSummary {
  billing_type: NodeCreateBillingType;
  committed_plan_id?: number;
  post_commit_behavior?: NodeCommittedCreateStatus;
}

export interface NodeCreateCommandResult {
  action: 'create';
  billing: NodeCreateBillingSummary;
  // With --wait: the node once it is running.
  node?: NodeDetails;
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
  reserve_public_ip_requested: boolean;
}

export interface NodeUpgradeRequestSummary {
  image: string;
  plan: string;
}

export interface NodeUpgradeDetailsSummary {
  location: string | null;
  new_node_image_id: number | null;
  old_node_image_id: number | null;
  vm_id: number | null;
}

export interface NodeUpgradeCancelledCommandResult {
  action: 'upgrade';
  cancelled: true;
  image_kept: boolean;
  node_id: number;
  requested: NodeUpgradeRequestSummary;
}

export interface NodeUpgradeCompletedCommandResult {
  action: 'upgrade';
  details: NodeUpgradeDetailsSummary;
  // True when --image was left out and the node's own image was kept.
  image_kept: boolean;
  message: string;
  node_id: number;
  requested: NodeUpgradeRequestSummary;
}

export type NodeUpgradeCommandResult =
  NodeUpgradeCancelledCommandResult | NodeUpgradeCompletedCommandResult;

export interface NodeCatalogOsCommandResult {
  action: 'catalog-os';
  entries: NodeCatalogOsEntry[];
}

export interface NodeCatalogPlansCommandResult {
  action: 'catalog-plans';
  items: NodeCatalogPlanItem[];
  query: NodeCatalogPlansQuery;
  summary?: NodeCatalogPlansSummary;
}

export type NodeCatalogPlansEmptyReason =
  | 'no_committed'
  | 'no_committed_for_family'
  | 'no_family_match'
  | 'no_filter_match'
  | 'no_plans';

export interface NodeCatalogPlansSummary {
  available_families: string[];
  empty_reason: NodeCatalogPlansEmptyReason | null;
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

export interface NodeRebootCommandResult {
  action: 'reboot';
  node_id: number;
  result: NodeActionStatusSummary;
}

export interface NodeProtectionCommandResult {
  action: 'protect' | 'unprotect';
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

export interface NodeSecurityGroupAttachCommandResult {
  action: 'security-group-attach';
  node_id: number;
  result: {
    message: string;
  };
  security_group_ids: number[];
}

export interface NodeSecurityGroupDetachCommandResult {
  action: 'security-group-detach';
  node_id: number;
  result: {
    message: string;
  };
  security_group_ids: number[];
}

export interface NodePublicIpDetachCancelledCommandResult {
  action: 'public-ip-detach';
  cancelled: true;
  node_id: number;
  public_ip: string;
}

export interface NodePublicIpDetachCompletedCommandResult {
  action: 'public-ip-detach';
  message: string;
  node_id: number;
  public_ip: string;
}

export type NodePublicIpDetachCommandResult =
  | NodePublicIpDetachCancelledCommandResult
  | NodePublicIpDetachCompletedCommandResult;

export interface NodeSnapshotDeleteOptions extends NodeContextOptions {
  force?: boolean;
}

export type NodeSnapshotCommandResult =
  | { action: 'snapshot-list'; items: SnapshotItem[]; node_id: number }
  | {
      action: 'snapshot-create';
      message: string;
      name: string;
      node_id: number;
    }
  | {
      action: 'snapshot-delete';
      cancelled: boolean;
      message?: string;
      node_id: number;
      snapshot_id: string;
    }
  | {
      action: 'snapshot-save-image';
      image_name: string;
      message: string;
      node_id: number;
      snapshot_id: string;
    };

export type NodeCommandResult =
  | NodeCatalogOsCommandResult
  | NodeCatalogPlansCommandResult
  | NodeCreateCommandResult
  | NodeDeleteCommandResult
  | NodeGetCommandResult
  | NodeListCommandResult
  | NodePowerOffCommandResult
  | NodePowerOnCommandResult
  | NodeProtectionCommandResult
  | NodePublicIpDetachCommandResult
  | NodeRebootCommandResult
  | NodeSaveImageCommandResult
  | NodeSecurityGroupAttachCommandResult
  | NodeSecurityGroupDetachCommandResult
  | NodeSshKeyAttachCommandResult
  | NodeUpgradeCommandResult
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
  createReservedIpClient(credentials: ResolvedCredentials): ReservedIpClient;
  createSecurityGroupClient(
    credentials: ResolvedCredentials
  ): SecurityGroupClient;
  createSshKeyClient(credentials: ResolvedCredentials): SshKeyClient;
  createVolumeClient(credentials: ResolvedCredentials): VolumeClient;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  isInteractive: boolean;
  // How long create --wait keeps checking; tests shorten it.
  nodeReadyPoll?: PollOptions;
  store: NodeStore;
}

interface ResolvedSshKey {
  id: number;
  label: string;
  ssh_key: string;
}

interface NormalizedNodeCreateBilling {
  billingType: NodeCreateBillingType;
  committedPlanId: number | null;
}

interface NodeCreatePayloadInput {
  committedPlanId: number | null;
  disk: number | null;
  image: string;
  name: string;
  savedImageTemplateId?: number;
  plan: string;
}

const DEFAULT_NODE_CREATE_BILLING_TYPE: NodeCreateBillingType = 'hourly';
// create --wait checks every 10 seconds for up to 20 minutes.
const NODE_READY_POLL: PollOptions = { attempts: 120, intervalMs: 10_000 };
const NODE_READY_STATUS = 'Running';
const COMMITTED_NODE_CREATE_STATUS: NodeCommittedCreateStatus = 'auto_renew';

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
      mapResolvedSshKeysToActionPayload(resolvedKeys)
    );

    return {
      action: 'ssh-key-attach',
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result),
      ssh_keys: summarizeResolvedSshKeys(resolvedKeys)
    };
  }

  async attachSecurityGroups(
    nodeId: string,
    options: NodeSecurityGroupActionOptions
  ): Promise<NodeSecurityGroupAttachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const securityGroupIds = normalizeDistinctNumericIds(
      options.securityGroupIds,
      'Security group ID',
      '--security-group-id'
    );
    const credentials = await this.resolveContext(options);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const client = this.dependencies.createSecurityGroupClient(credentials);
    const nodeVmId = await this.resolveNodeVmId(nodeClient, normalizedNodeId);
    const result = await client.attachNodeSecurityGroups(nodeVmId, {
      security_group_ids: securityGroupIds
    });

    return {
      action: 'security-group-attach',
      node_id: normalizedNodeId,
      result: {
        message: result.message
      },
      security_group_ids: securityGroupIds
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
    const billing = normalizeNodeCreateBilling(
      options.billingType,
      options.committedPlanId
    );
    const payloadInput = normalizeNodeCreatePayloadInput(
      options,
      billing.committedPlanId
    );
    const sshKeyIds = options.sshKeyIds ?? [];
    const normalizedSshKeyIds =
      sshKeyIds.length === 0
        ? []
        : normalizeDistinctNumericIds(sshKeyIds, 'SSH key ID', '--ssh-key-id');
    const credentials = await this.resolveContext(options);
    const resolvedKeys = await this.resolveCreateSshKeys(
      credentials,
      normalizedSshKeyIds
    );
    const request = buildNodeCreatePayload(payloadInput, resolvedKeys);
    const client = this.dependencies.createNodeClient(credentials);
    const result = await client.createNode(request);

    return {
      action: 'create',
      billing: summarizeNodeCreateBilling(billing),
      ...(options.wait === true
        ? { node: await this.waitForNodeReady(client, result) }
        : {}),
      result
    };
  }

  async deleteNode(
    nodeId: string,
    options: NodeDeleteOptions
  ): Promise<NodeDeleteCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const reservePublicIp = options.reservePublicIp ?? false;

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete node ${normalizedNodeId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          node_id: normalizedNodeId,
          reserve_public_ip_requested: reservePublicIp
        };
      }
    }

    const client = await this.createNodeClient(options);
    const result = await client
      .deleteNode(
        String(normalizedNodeId),
        reservePublicIp ? { reserve_ip_required: 'true' } : undefined
      )
      .catch((error: unknown) => {
        throw explainProtectedDelete(error, normalizedNodeId);
      });

    return {
      action: 'delete',
      cancelled: false,
      message: result.message,
      node_id: normalizedNodeId,
      reserve_public_ip_requested: reservePublicIp
    };
  }

  async detachSecurityGroups(
    nodeId: string,
    options: NodeSecurityGroupActionOptions
  ): Promise<NodeSecurityGroupDetachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const securityGroupIds = normalizeDistinctNumericIds(
      options.securityGroupIds,
      'Security group ID',
      '--security-group-id'
    );
    const credentials = await this.resolveContext(options);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const client = this.dependencies.createSecurityGroupClient(credentials);
    const nodeDetails = await this.getNodeDetails(nodeClient, normalizedNodeId);

    assertCanDetachSecurityGroups(
      nodeDetails,
      normalizedNodeId,
      securityGroupIds.length
    );

    const nodeVmId = assertNodeVmId(nodeDetails, normalizedNodeId);
    const result = await client.detachNodeSecurityGroups(nodeVmId, {
      security_group_ids: securityGroupIds
    });

    return {
      action: 'security-group-detach',
      node_id: normalizedNodeId,
      result: {
        message: result.message
      },
      security_group_ids: securityGroupIds
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
      entries: summarizeNodeCatalogOs(await client.listNodeCatalogOs())
    };
  }

  async listCatalogPlans(
    options: NodeCatalogPlansOptions
  ): Promise<NodeCatalogPlansCommandResult> {
    const client = await this.createNodeClient(options);
    const billingType = normalizeNodeCatalogBillingType(options.billingType);
    const filters = normalizeNodeCatalogPlanFilters(options);
    const query = buildNodeCatalogQuery(options);
    const plans = await client.listNodeCatalogPlans(query);
    const items = normalizeNodeCatalogPlanItems(plans, billingType, filters);

    return {
      action: 'catalog-plans',
      items,
      query: {
        billing_type: billingType,
        ...query,
        ...filters
      },
      summary: summarizeNodeCatalogPlans(plans, items, billingType, filters)
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

  async rebootNode(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodeRebootCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const client = await this.createNodeClient(options);
    const result = await client.rebootNode(String(normalizedNodeId));

    return {
      action: 'reboot',
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result)
    };
  }

  async setDeletionProtection(
    nodeId: string,
    enabled: boolean,
    options: NodeContextOptions
  ): Promise<NodeProtectionCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const client = await this.createNodeClient(options);
    const result = await client.setDeletionProtection(
      String(normalizedNodeId),
      enabled
    );

    return {
      action: enabled ? 'protect' : 'unprotect',
      node_id: normalizedNodeId,
      result: summarizeNodeAction(result)
    };
  }

  async listSnapshots(
    nodeId: string,
    options: NodeContextOptions
  ): Promise<NodeSnapshotCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const client = await this.createNodeClient(options);
    const items = await client.listSnapshots(String(normalizedNodeId));

    return {
      action: 'snapshot-list',
      items: items.map((item) => toSnapshotItem(item, 'snapshot_uuid')),
      node_id: normalizedNodeId
    };
  }

  async createSnapshot(
    nodeId: string,
    options: NodeContextOptions & { name: string }
  ): Promise<NodeSnapshotCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const client = await this.createNodeClient(options);
    const result = await client.createSnapshot(String(normalizedNodeId), name);

    return {
      action: 'snapshot-create',
      message: result.message,
      name,
      node_id: normalizedNodeId
    };
  }

  async deleteSnapshot(
    nodeId: string,
    snapshotId: string,
    options: NodeSnapshotDeleteOptions
  ): Promise<NodeSnapshotCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const normalizedSnapshotId = normalizeSnapshotId(
      snapshotId,
      'snapshot_uuid'
    );
    const client = await this.createNodeClient(options);
    await assertSnapshotExists(client, normalizedNodeId, normalizedSnapshotId);

    const confirmed = await confirmUnlessForced(
      this.dependencies,
      options.force,
      `Delete snapshot ${normalizedSnapshotId} of node ${normalizedNodeId}? This cannot be undone.`
    );
    if (!confirmed) {
      return {
        action: 'snapshot-delete',
        cancelled: true,
        node_id: normalizedNodeId,
        snapshot_id: normalizedSnapshotId
      };
    }

    const result = await client.deleteSnapshot(
      String(normalizedNodeId),
      normalizedSnapshotId
    );

    return {
      action: 'snapshot-delete',
      cancelled: false,
      message: result.message,
      node_id: normalizedNodeId,
      snapshot_id: normalizedSnapshotId
    };
  }

  // The safe restore: the snapshot becomes a new saved image and the node
  // is left as it is. A node is then created from that image.
  async saveSnapshotAsImage(
    nodeId: string,
    snapshotId: string,
    options: NodeContextOptions & { name: string }
  ): Promise<NodeSnapshotCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const normalizedSnapshotId = normalizeSnapshotId(
      snapshotId,
      'snapshot_uuid'
    );
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const client = await this.createNodeClient(options);
    await assertSnapshotExists(client, normalizedNodeId, normalizedSnapshotId);
    const result = await client.saveSnapshotAsImage(
      String(normalizedNodeId),
      normalizedSnapshotId,
      name
    );

    return {
      action: 'snapshot-save-image',
      image_name: name,
      message: result.message,
      node_id: normalizedNodeId,
      snapshot_id: normalizedSnapshotId
    };
  }

  async detachPublicIp(
    nodeId: string,
    options: NodePublicIpDetachOptions
  ): Promise<NodePublicIpDetachCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const credentials = await this.resolveContext(options);
    const nodeClient = this.dependencies.createNodeClient(credentials);
    const nodeDetails = await this.getNodeDetails(nodeClient, normalizedNodeId);
    const nodeVmId = assertNodeVmId(nodeDetails, normalizedNodeId);
    const nodePublicIp = assertNodePublicIpForDetach(
      nodeDetails,
      normalizedNodeId
    );

    if (!(options.force ?? false)) {
      assertCanDetachPublicIp(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Detach public IP ${nodePublicIp} from node ${normalizedNodeId}? The node may no longer be publicly reachable.`
      );

      if (!confirmed) {
        return {
          action: 'public-ip-detach',
          cancelled: true,
          node_id: normalizedNodeId,
          public_ip: nodePublicIp
        };
      }
    }

    const reservedIpClient =
      this.dependencies.createReservedIpClient(credentials);
    const result = await reservedIpClient.detachNodePublicIp({
      public_ip: nodePublicIp,
      type: 'detach',
      vm_id: nodeVmId
    });

    return {
      action: 'public-ip-detach',
      message: result.message,
      node_id: normalizedNodeId,
      public_ip: result.ip_address
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

  async upgradeNode(
    nodeId: string,
    options: NodeUpgradeOptions
  ): Promise<NodeUpgradeCommandResult> {
    const normalizedNodeId = assertNodeId(nodeId);
    const plan = normalizeRequiredString(options.plan, 'Plan', '--plan');
    if (!(options.force ?? false)) {
      assertCanUpgrade(this.dependencies.isInteractive);
    }

    const client = await this.createNodeClient(options);
    const imageKept = options.image === undefined;
    const requested = {
      image:
        options.image === undefined
          ? await findCurrentImage(client, normalizedNodeId, plan)
          : normalizeRequiredString(options.image, 'Image', '--image'),
      plan
    };

    if (!(options.force ?? false)) {
      const confirmed = await this.dependencies.confirm(
        `Upgrade node ${normalizedNodeId} to plan ${requested.plan} with image ${requested.image}? This is disruptive.`
      );

      if (!confirmed) {
        return {
          action: 'upgrade',
          cancelled: true,
          image_kept: imageKept,
          node_id: normalizedNodeId,
          requested
        };
      }
    }

    const result = await client.upgradeNode(
      String(normalizedNodeId),
      requested
    );

    return {
      action: 'upgrade',
      details: summarizeNodeUpgradeDetails(result),
      image_kept: imageKept,
      message: result.message,
      node_id: normalizedNodeId,
      requested
    };
  }

  // Polls until the new node is running. Every failure names the node,
  // because it exists and is billed even when the wait gives up.
  private async waitForNodeReady(
    client: NodeClient,
    result: NodeCreateResult
  ): Promise<NodeDetails> {
    const nodeId = result.node_create_response?.[0]?.id;
    if (nodeId === undefined) {
      throw new CliError(
        'E2E did not return the new node, so the CLI cannot wait for it.',
        {
          code: 'NODE_WAIT_FAILED',
          exitCode: EXIT_CODES.network,
          suggestion: `Run ${formatMyAccountCommand('node list')} to find the node and check its status.`
        }
      );
    }

    const poll = this.dependencies.nodeReadyPoll ?? NODE_READY_POLL;
    const ready = await pollUntilFound(
      () => checkNodeReady(client, nodeId),
      poll
    ).catch((error: unknown) => {
      throw toNodeWaitError(error, nodeId);
    });

    if (ready === undefined) {
      const minutes = Math.round((poll.attempts * poll.intervalMs) / 60_000);
      throw new CliError(
        `Node ${nodeId} is not running after ${minutes} minutes.`,
        {
          code: 'NODE_WAIT_TIMEOUT',
          exitCode: EXIT_CODES.general,
          suggestion: `The node exists and is billed. Check it with ${formatMyAccountCommand(`node get ${nodeId}`)}, or delete it with ${formatMyAccountCommand(`node delete ${nodeId}`)}.`
        }
      );
    }

    return ready;
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
    return await resolveStoredCredentials(this.dependencies.store, options);
  }

  private async resolveCreateSshKeys(
    credentials: ResolvedCredentials,
    requestedIds: number[]
  ): Promise<ResolvedSshKey[]> {
    if (requestedIds.length === 0) {
      return [];
    }

    const sshKeyClient = this.dependencies.createSshKeyClient(credentials);
    return resolveSavedSshKeys(await sshKeyClient.listSshKeys(), requestedIds);
  }

  private async resolveNodeVmId(
    nodeClient: NodeClient,
    nodeId: number
  ): Promise<number> {
    return assertNodeVmId(
      await this.getNodeDetails(nodeClient, nodeId),
      nodeId
    );
  }

  private async getNodeDetails(
    nodeClient: NodeClient,
    nodeId: number
  ): Promise<NodeDetails> {
    return await nodeClient.getNode(String(nodeId));
  }
}

// E2E refuses to delete a node with deletion protection on; say how to
// turn it off instead of the generic API hint.
function explainProtectedDelete(error: unknown, nodeId: number): unknown {
  // The wording can arrive in the API's message or in its errors field.
  if (
    !(error instanceof AppError) ||
    ![error.message, ...error.details].some((text) =>
      /accidental protection/i.test(text)
    )
  ) {
    return error;
  }

  return new CliError(`Node ${nodeId} has deletion protection on.`, {
    cause: error,
    code: 'NODE_DELETE_PROTECTED',
    exitCode: EXIT_CODES.usage,
    suggestion: `Run ${formatMyAccountCommand(`node action unprotect ${nodeId}`)}, then delete it again.`
  });
}

async function checkNodeReady(
  client: NodeClient,
  nodeId: number
): Promise<NodeDetails | undefined> {
  const node = await client.getNode(String(nodeId));

  if (/fail|error/i.test(node.status)) {
    throw new CliError(
      `Node ${nodeId} failed to start (status: ${node.status}).`,
      {
        code: 'NODE_CREATE_FAILED',
        exitCode: EXIT_CODES.general,
        suggestion: `Delete it with ${formatMyAccountCommand(`node delete ${nodeId}`)} and create it again, or contact support if it keeps failing.`
      }
    );
  }

  return node.status === NODE_READY_STATUS ? node : undefined;
}

function toNodeWaitError(error: unknown, nodeId: number): CliError {
  if (error instanceof CliError && error.code === 'NODE_CREATE_FAILED') {
    return error;
  }

  return new CliError(
    `Node ${nodeId} was created, but checking whether it is running failed.`,
    {
      cause: error,
      code: 'NODE_WAIT_FAILED',
      details: error instanceof Error ? [`Reason: ${error.message}`] : [],
      // Keep the exit code of what went wrong, for example 3 for a revoked
      // token; anything else counts as a network failure.
      exitCode: error instanceof AppError ? error.exitCode : EXIT_CODES.network,
      suggestion: `The node exists and is billed. Check it with ${formatMyAccountCommand(`node get ${nodeId}`)}.`
    }
  );
}

// E2E answers an unknown snapshot id with a web page instead of an error,
// so check the id against the node's snapshots first.
async function assertSnapshotExists(
  client: NodeClient,
  nodeId: number,
  snapshotId: string
): Promise<void> {
  const snapshots = await client.listSnapshots(String(nodeId));
  if (snapshots.some((snapshot) => snapshot.snapshot_uuid === snapshotId)) {
    return;
  }

  throw new CliError(
    `Snapshot ${snapshotId} was not found on node ${nodeId}.`,
    {
      code: 'SNAPSHOT_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatMyAccountCommand(`node snapshot list ${nodeId}`)} and pass an ID from it.`
    }
  );
}

// Upgrading needs an image. To keep the node's own image, find the one
// catalog row that matches its OS exactly and that row's image for the new
// plan. Anything less than an exact match fails rather than guessing.
async function findCurrentImage(
  client: NodeClient,
  nodeId: number,
  plan: string
): Promise<string> {
  const [node, catalog] = await Promise.all([
    client.getNode(String(nodeId)),
    client.listNodeCatalogOs()
  ]);
  const os = node.os_info;
  const rows = summarizeNodeCatalogOs(catalog).filter(
    (row) =>
      row.display_category === os?.category &&
      row.os === os.name &&
      row.os_version === os.version
  );
  const row = rows.length === 1 ? rows[0] : undefined;
  if (row === undefined) {
    throw currentImageError(
      `Could not tell which image node ${nodeId} runs, so it cannot be kept.`,
      nodeId
    );
  }

  const images = new Set(
    (
      await client.listNodeCatalogPlans({
        category: row.category,
        display_category: row.display_category,
        os: row.os,
        osversion: row.os_version
      })
    )
      .filter((candidate) => candidate.plan === plan)
      .map((candidate) => candidate.image)
  );
  const [image] = images;
  if (images.size !== 1 || image === undefined) {
    throw currentImageError(
      `Plan ${plan} is not offered for the image node ${nodeId} runs (${row.os} ${row.os_version}).`,
      nodeId,
      row
    );
  }

  return image;
}

function currentImageError(
  message: string,
  nodeId: number,
  row?: NodeCatalogOsEntry
): CliError {
  const catalogCommand =
    row === undefined
      ? 'node catalog os'
      : `node catalog plans --display-category "${row.display_category}" --category "${row.category}" --os "${row.os}" --os-version "${row.os_version}"`;

  return new CliError(message, {
    code: 'NODE_IMAGE_UNKNOWN',
    details: [`Node ID: ${nodeId}`],
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass --image with a plan and image pair from ${formatMyAccountCommand(catalogCommand)}.`
  });
}

function assertCanDelete(isInteractive: boolean): void {
  assertConfirmationAllowed(
    isInteractive,
    'Deleting a node requires confirmation in an interactive terminal.'
  );
}

function assertCanUpgrade(isInteractive: boolean): void {
  assertConfirmationAllowed(
    isInteractive,
    'Upgrading a node requires confirmation in an interactive terminal.'
  );
}

function assertCanDetachPublicIp(isInteractive: boolean): void {
  assertConfirmationAllowed(
    isInteractive,
    'Detaching a node public IP requires confirmation in an interactive terminal.'
  );
}

function assertConfirmationAllowed(
  isInteractive: boolean,
  message: string
): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(message, {
    code: 'CONFIRMATION_REQUIRED',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Re-run the command with --force to skip the prompt.'
  });
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

function assertCanDetachSecurityGroups(
  node: NodeDetails,
  nodeId: number,
  requestedDetachCount: number
): void {
  const securityGroupCount = node.security_group_count;

  if (
    securityGroupCount === undefined ||
    !Number.isInteger(securityGroupCount) ||
    securityGroupCount <= 0 ||
    requestedDetachCount < securityGroupCount
  ) {
    return;
  }

  throw new CliError(
    `Node ${nodeId} must keep at least one attached security group.`,
    {
      code: 'LAST_SECURITY_GROUP_DETACH_BLOCKED',
      details: [
        `Attached security groups: ${securityGroupCount}`,
        `Requested detach count: ${requestedDetachCount}`
      ],
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Detach fewer security groups, or attach another security group before retrying.'
    }
  );
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

function assertNodePublicIpForDetach(
  node: NodeDetails,
  nodeId: number
): string {
  const publicIp = node.public_ip_address?.trim();

  if (publicIp !== undefined && publicIp.length > 0) {
    return publicIp;
  }

  throw new CliError('This node does not have a current public IP to detach.', {
    code: 'NODE_PUBLIC_IP_UNAVAILABLE',
    details: [`Node ID: ${nodeId}`],
    exitCode: EXIT_CODES.network,
    suggestion:
      'Pick a node with an assigned public IP, then retry the public-ip detach command.'
  });
}

function normalizeNodeCreateBillingType(
  value: string | undefined
): NodeCreateBillingType {
  return normalizeBillingType(
    value,
    ['committed', 'hourly'],
    DEFAULT_NODE_CREATE_BILLING_TYPE
  );
}

function normalizeNodeCreateBilling(
  billingType: string | undefined,
  committedPlanId: string | undefined
): NormalizedNodeCreateBilling {
  const normalizedBillingType = normalizeNodeCreateBillingType(billingType);

  return {
    billingType: normalizedBillingType,
    committedPlanId: normalizeCommittedPlanId(
      normalizedBillingType,
      committedPlanId
    )
  };
}

function normalizeNodeCreatePayloadInput(
  options: NodeCreateOptions,
  committedPlanId: number | null
): NodeCreatePayloadInput {
  const plan = normalizeRequiredString(options.plan, 'Plan', '--plan');
  const disk = normalizeOptionalNodeDiskSize(options.disk);
  if (options.image === undefined) {
    throw new CliError(
      '--image is required for node create, including saved-image launches.',
      {
        code: 'MISSING_IMAGE_FLAG',
        exitCode: EXIT_CODES.usage,
        suggestion: `Pass the catalog image with --image. For saved-image launches, keep --image and add --saved-image-template-id. Run ${formatMyAccountCommand('node catalog plans')} to find a valid plan/image pair.`
      }
    );
  }
  const image = normalizeRequiredString(options.image, 'Image', '--image');
  const savedImageTemplateId =
    options.savedImageTemplateId !== undefined
      ? normalizeRequiredNumericId(
          options.savedImageTemplateId,
          'Saved image template ID',
          '--saved-image-template-id'
        )
      : undefined;

  assertNodeCreateDiskCompatibility(plan, disk);

  return {
    committedPlanId,
    disk,
    image,
    ...(savedImageTemplateId !== undefined ? { savedImageTemplateId } : {}),
    name: normalizeRequiredString(options.name, 'Name', '--name'),
    plan
  };
}

function normalizeCommittedPlanId(
  billingType: NodeCreateBillingType,
  committedPlanId: string | undefined
): number | null {
  if (billingType === 'committed') {
    if (committedPlanId === undefined) {
      throw new CliError(
        'Committed plan ID is required when --billing-type committed is used.',
        {
          code: 'MISSING_COMMITTED_PLAN_ID',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatMyAccountCommand('node catalog plans')} first, then pass one plan id with --committed-plan-id.`
        }
      );
    }

    return normalizeRequiredNumericId(
      committedPlanId,
      'Committed plan ID',
      '--committed-plan-id'
    );
  }

  if (committedPlanId !== undefined) {
    throw new CliError(
      'Committed plan ID can only be used with --billing-type committed.',
      {
        code: 'UNEXPECTED_COMMITTED_PLAN_ID',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Remove --committed-plan-id, or switch to --billing-type committed.'
      }
    );
  }

  return null;
}

function normalizeOptionalNodeDiskSize(
  value: string | undefined
): number | null {
  if (value === undefined) {
    return null;
  }

  const normalizedValue = normalizeRequiredString(value, 'Disk size', '--disk');

  if (!/^\d+$/.test(normalizedValue)) {
    throw new CliError('Disk size must be a whole number of GB.', {
      code: 'INVALID_DISK_SIZE',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass a positive integer with --disk, for example --disk 100.'
    });
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isSafeInteger(parsedValue)) {
    throw new CliError('Disk size is too large to represent safely.', {
      code: 'INVALID_DISK_SIZE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass a smaller positive integer with --disk, for example --disk 100.'
    });
  }

  if (!isCustomStorageDiskSizeAllowed(parsedValue)) {
    throw new CliError(buildInvalidCustomStorageDiskMessage(parsedValue), {
      code: 'INVALID_DISK_SIZE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass --disk with an allowed size. ${formatCustomStorageDiskHint()}`
    });
  }

  return parsedValue;
}

function assertNodeCreateDiskCompatibility(
  plan: string,
  disk: number | null
): void {
  const usesCustomStorage = isCustomStoragePlan(plan);

  if (!usesCustomStorage && disk !== null) {
    throw new CliError('Disk size can only be used with E1 or E1WC plans.', {
      code: 'UNEXPECTED_DISK_SIZE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Remove --disk, or retry with an E1 or E1WC plan from node catalog plans.'
    });
  }

  if (usesCustomStorage && disk === null) {
    throw new CliError('Disk size is required for E1 and E1WC plans.', {
      code: 'MISSING_DISK_SIZE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatMyAccountCommand('node catalog plans')} first, then retry with --disk <size-gb>. ${formatCustomStorageDiskHint()}`
    });
  }
}

function buildInvalidCustomStorageDiskMessage(value: number): string {
  if (
    value < CUSTOM_STORAGE_MIN_DISK_GB ||
    value > CUSTOM_STORAGE_MAX_DISK_GB
  ) {
    return (
      `Disk size must be in the range ${CUSTOM_STORAGE_MIN_DISK_GB} GB ` +
      `to ${CUSTOM_STORAGE_MAX_DISK_GB} GB.`
    );
  }

  if (value < CUSTOM_STORAGE_DEFAULT_DISK_GB) {
    return (
      `Disk size below ${CUSTOM_STORAGE_DEFAULT_DISK_GB} GB must be a multiple of ` +
      `${CUSTOM_STORAGE_DOWNSIZE_STEP_GB} GB.`
    );
  }

  return (
    `Disk size at or above ${CUSTOM_STORAGE_DEFAULT_DISK_GB} GB must be a multiple of ` +
    `${CUSTOM_STORAGE_UPSIZE_STEP_GB} GB.`
  );
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

function summarizeNodeUpgradeDetails(
  result: NodeUpgradeResult
): NodeUpgradeDetailsSummary {
  return {
    location: result.location ?? null,
    new_node_image_id: result.new_node_image_id ?? null,
    old_node_image_id: result.old_node_image_id ?? null,
    vm_id: result.vm_id ?? null
  };
}

function buildNodeCreatePayload(
  input: NodeCreatePayloadInput,
  resolvedKeys: ResolvedSshKey[]
): NodeCreateRequest {
  const isSavedImage = input.savedImageTemplateId !== undefined;
  const baseRequest = buildDefaultNodeCreateRequest({
    ...(input.committedPlanId === null
      ? {}
      : {
          cn_id: input.committedPlanId,
          cn_status: COMMITTED_NODE_CREATE_STATUS
        }),
    image: input.image,
    name: input.name,
    plan: input.plan
  });

  return {
    ...baseRequest,
    ...(input.disk === null ? {} : { disk: input.disk }),
    image: input.image,
    is_saved_image: isSavedImage,
    ...(isSavedImage
      ? { saved_image_template_id: String(input.savedImageTemplateId) }
      : {}),
    ssh_keys: mapResolvedSshKeysToCreatePayload(resolvedKeys)
  };
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
        suggestion: `Run ${formatMyAccountCommand('ssh-key list')} to inspect saved SSH key ids, then retry with one or more listed ids.`
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

function mapResolvedSshKeysToActionPayload(
  resolvedKeys: ResolvedSshKey[]
): NodeActionSshKey[] {
  return resolvedKeys.map((key) => ({
    label: key.label,
    ssh_key: key.ssh_key
  }));
}

function mapResolvedSshKeysToCreatePayload(
  resolvedKeys: ResolvedSshKey[]
): string[] {
  return resolvedKeys.map((key) => key.ssh_key);
}

function summarizeResolvedSshKeys(
  resolvedKeys: ResolvedSshKey[]
): NodeResolvedSshKeySummary[] {
  return resolvedKeys.map(({ id, label }) => ({
    id,
    label
  }));
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

function summarizeNodeCreateBilling(
  billing: NormalizedNodeCreateBilling
): NodeCreateBillingSummary {
  return billing.committedPlanId === null
    ? {
        billing_type: billing.billingType
      }
    : {
        billing_type: billing.billingType,
        committed_plan_id: billing.committedPlanId,
        post_commit_behavior: COMMITTED_NODE_CREATE_STATUS
      };
}
