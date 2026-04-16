import type { SmokeEnv } from './smoke-env.js';
import { updateSmokeManifest } from './smoke-manifest.js';
import {
  discoverAvailableVolumeSize,
  normalizeObservedPublicIp,
  runJsonCommand,
  waitForNodeReadiness,
  waitForNodeStatus,
  waitForVolumeStatus,
  type NodeGetJson
} from './smoke-commands.js';

interface NodeCreateJson {
  action: 'create';
  nodes: Array<{
    id: number;
  }>;
}

interface SecurityGroupCreateJson {
  action: 'create';
  security_group: {
    id: number;
  };
}

interface SecurityGroupGetJson {
  action: 'get';
  security_group: {
    id: number;
    rules: unknown[];
  };
}

interface SecurityGroupUpdateJson {
  action: 'update';
  security_group: {
    id: number;
    name: string;
    rule_count: number;
  };
}

interface ReservedIpCreateJson {
  action: 'create';
  reserved_ip: {
    ip_address: string;
  };
}

interface ReservedIpReserveNodeJson {
  action: 'reserve-node';
  ip_address: string;
}

interface ReservedIpGetJson {
  action: 'get';
  reserved_ip: {
    ip_address: string;
  };
}

interface VolumeCreateJson {
  action: 'create';
  volume: {
    id: number;
  };
}

interface VolumeGetJson {
  action: 'get';
  volume: {
    id: number;
    status?: string;
  };
}

interface VolumeDeleteJson {
  action: 'delete';
  volume_id: number;
}

interface VolumeAttachDetachJson {
  action: 'volume-attach' | 'volume-detach';
  node_id: number;
  node_vm_id: number;
  result: {
    message: string;
  };
  volume: {
    id: number;
  };
}

interface VpcCreateJson {
  action: 'create';
  vpc: {
    id: number;
  };
}

interface VpcGetJson {
  action: 'get';
  vpc: {
    attached_vm_count?: number | null;
    id: number;
    state?: string;
  };
}

interface VpcDeleteJson {
  action: 'delete';
  vpc: {
    id: number;
  };
}

interface VpcAttachDetachJson {
  action: 'vpc-attach' | 'vpc-detach';
  node_id: number;
  result: {
    message: string;
    project_id: string;
  };
  vpc: {
    id: number;
    name: string;
    private_ip: string | null;
    subnet_id: number | null;
  };
}

interface SshKeyCreateJson {
  action: 'create';
  item: {
    id: number;
  };
}

interface SshKeyGetJson {
  action: 'get';
  item: {
    id: number;
  };
}

interface SshKeyDeleteJson {
  action: 'delete';
  id: number;
}

interface SshKeyAttachJson {
  action: 'ssh-key-attach';
  node_id: number;
  result: {
    action_id: number;
    created_at: string;
    image_id: string | null;
    status: string;
  };
  ssh_keys: Array<{
    id: number;
    label: string;
  }>;
}

interface NodePowerJson {
  action: 'power-off' | 'power-on';
  node_id: number;
  result: {
    action_id: number;
    created_at: string;
    image_id: string | null;
    status: string;
  };
}

interface NodePublicIpDetachJson {
  action: 'public-ip-detach';
  message: string;
  node_id: number;
  public_ip: string;
}

interface NodeSaveImageJson {
  action: 'save-image';
  image_name: string;
  node_id: number;
  result: {
    action_id: number;
    created_at: string;
    image_id: string | null;
    status: string;
  };
}

interface NodeUpgradeJson {
  action: 'upgrade';
  details: {
    location: string | null;
    new_node_image_id: number | null;
    old_node_image_id: number | null;
    vm_id: number | null;
  };
  message: string;
  node_id: number;
  requested: {
    image: string;
    plan: string;
  };
}

export interface SmokeStepContext {
  manifestPath: string;
  smokeEnv: SmokeEnv;
}

const MANUAL_SMOKE_PUBLIC_KEY =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPFfnphs5u7PSX3ZEvaK+xprwm9X67kEKNV7uOXwmsPy release-smoke@e2ectl';

export function buildSecurityGroupRules() {
  return [
    {
      description: 'ssh',
      network: 'any',
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: '',
      network: 'any',
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound'
    }
  ];
}

export function buildUpdatedSecurityGroupRules() {
  return [
    {
      description: 'ssh',
      network: 'any',
      port_range: '22',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: 'https',
      network: 'any',
      port_range: '443',
      protocol_name: 'Custom_TCP',
      rule_type: 'Inbound'
    },
    {
      description: '',
      network: 'any',
      port_range: 'All',
      protocol_name: 'All',
      rule_type: 'Outbound'
    }
  ];
}

export async function createNodeStep(
  context: SmokeStepContext,
  options: {
    nodeName: string;
  }
): Promise<{
  nodeId: number;
}> {
  const nodeCreate = await runJsonCommand<NodeCreateJson>(
    [
      'node',
      'create',
      '--name',
      options.nodeName,
      '--plan',
      context.smokeEnv.nodePlan,
      '--image',
      context.smokeEnv.nodeImage
    ],
    context.smokeEnv
  );
  const nodeId = nodeCreate.nodes[0]?.id;

  if (!Number.isInteger(nodeId)) {
    throw new Error('Expected node create to return exactly one node id.');
  }
  const resolvedNodeId = nodeId as number;

  await updateManifest(context, (manifest) => {
    manifest.node_id = resolvedNodeId;
  });

  await waitForNodeReadiness(resolvedNodeId, context.smokeEnv, {
    requirePublicIp: false
  });

  return {
    nodeId: resolvedNodeId
  };
}

export async function runSecurityGroupSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
    rulesFilePath: string;
    securityGroupName: string;
    updatedSecurityGroupName: string;
  }
): Promise<{
  securityGroupId: number;
}> {
  const securityGroupCreate = await runJsonCommand<SecurityGroupCreateJson>(
    [
      'security-group',
      'create',
      '--name',
      options.securityGroupName,
      '--rules-file',
      options.rulesFilePath
    ],
    context.smokeEnv
  );
  const securityGroupId = securityGroupCreate.security_group.id;

  if (!Number.isInteger(securityGroupId)) {
    throw new Error(
      'Expected security-group create to return a security group id.'
    );
  }

  await updateManifest(context, (manifest) => {
    manifest.security_group_id = securityGroupId;
  });

  const securityGroupGet = await runJsonCommand<SecurityGroupGetJson>(
    ['security-group', 'get', String(securityGroupId)],
    context.smokeEnv
  );

  if (securityGroupGet.security_group.id !== securityGroupId) {
    throw new Error('Expected security-group get to return the created group.');
  }

  if (!Array.isArray(securityGroupGet.security_group.rules)) {
    throw new Error('Expected security-group get to expose rules.');
  }

  const securityGroupUpdate = await runJsonCommand<SecurityGroupUpdateJson>(
    [
      'security-group',
      'update',
      String(securityGroupId),
      '--name',
      options.updatedSecurityGroupName,
      '--description',
      'release smoke update',
      '--rules-file',
      '-'
    ],
    context.smokeEnv,
    {
      stdin: `${JSON.stringify(buildUpdatedSecurityGroupRules())}\n`
    }
  );

  if (securityGroupUpdate.security_group.id !== securityGroupId) {
    throw new Error('Expected security-group update to preserve the group id.');
  }

  if (
    securityGroupUpdate.security_group.name !== options.updatedSecurityGroupName
  ) {
    throw new Error('Expected security-group update to persist the new name.');
  }

  if (
    securityGroupUpdate.security_group.rule_count !==
    buildUpdatedSecurityGroupRules().length
  ) {
    throw new Error('Expected security-group update to persist every rule.');
  }

  await runJsonCommand(
    [
      'node',
      'action',
      'security-group',
      'attach',
      String(options.nodeId),
      '--security-group-id',
      String(securityGroupId)
    ],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.security_group_attached_node_id = options.nodeId;
  });

  await runJsonCommand(
    [
      'node',
      'action',
      'security-group',
      'detach',
      String(options.nodeId),
      '--security-group-id',
      String(securityGroupId)
    ],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.security_group_attached_node_id = null;
  });

  return {
    securityGroupId
  };
}

export async function runAddonReservedIpSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
  }
): Promise<void> {
  const addonReservedIpCreate = await runJsonCommand<ReservedIpCreateJson>(
    ['reserved-ip', 'create'],
    context.smokeEnv
  );
  const addonReservedIp = addonReservedIpCreate.reserved_ip.ip_address;

  if (addonReservedIp.length === 0) {
    throw new Error('Expected reserved-ip create to return an IP address.');
  }

  await updateManifest(context, (manifest) => {
    manifest.addon_reserved_ip = addonReservedIp;
  });

  const addonReservedIpGet = await runJsonCommand<ReservedIpGetJson>(
    ['reserved-ip', 'get', addonReservedIp],
    context.smokeEnv
  );

  if (addonReservedIpGet.reserved_ip.ip_address !== addonReservedIp) {
    throw new Error('Expected reserved-ip get to return the created address.');
  }

  await runJsonCommand(
    [
      'reserved-ip',
      'attach',
      'node',
      addonReservedIp,
      '--node-id',
      String(options.nodeId)
    ],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.addon_reserved_ip_attached_node_id = options.nodeId;
  });

  await runJsonCommand(
    [
      'reserved-ip',
      'detach',
      'node',
      addonReservedIp,
      '--node-id',
      String(options.nodeId)
    ],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.addon_reserved_ip_attached_node_id = null;
  });

  await runJsonCommand(
    ['reserved-ip', 'delete', addonReservedIp, '--force'],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.addon_reserved_ip_deleted = true;
  });
}

export async function runVolumeSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
    volumeName: string;
  }
): Promise<{
  volumeId: number;
}> {
  const availableVolumeSize = await discoverAvailableVolumeSize(
    context.smokeEnv
  );
  const volumeCreate = await runJsonCommand<VolumeCreateJson>(
    [
      'volume',
      'create',
      '--name',
      options.volumeName,
      '--size',
      String(availableVolumeSize),
      '--billing-type',
      'hourly'
    ],
    context.smokeEnv
  );
  const volumeId = volumeCreate.volume.id;

  if (!Number.isInteger(volumeId)) {
    throw new Error('Expected volume create to return a volume id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.volume_id = volumeId;
  });

  const volumeGet = await runJsonCommand<VolumeGetJson>(
    ['volume', 'get', String(volumeId)],
    context.smokeEnv
  );

  if (volumeGet.volume.id !== volumeId) {
    throw new Error('Expected volume get to return the created volume.');
  }

  await waitForVolumeStatus(volumeId, context.smokeEnv, {
    acceptedStatuses: ['Available'],
    description: 'Available'
  });

  const volumeAttach = await runJsonCommand<VolumeAttachDetachJson>(
    [
      'node',
      'action',
      'volume',
      'attach',
      String(options.nodeId),
      '--volume-id',
      String(volumeId)
    ],
    context.smokeEnv
  );

  if (
    volumeAttach.action !== 'volume-attach' ||
    volumeAttach.node_id !== options.nodeId ||
    volumeAttach.volume.id !== volumeId
  ) {
    throw new Error(
      'Expected node volume attach to target the created volume.'
    );
  }

  await updateManifest(context, (manifest) => {
    manifest.volume_attached_node_id = options.nodeId;
  });

  await waitForVolumeStatus(volumeId, context.smokeEnv, {
    acceptedStatuses: ['Attached'],
    description: 'Attached'
  });

  const volumeDetach = await runJsonCommand<VolumeAttachDetachJson>(
    [
      'node',
      'action',
      'volume',
      'detach',
      String(options.nodeId),
      '--volume-id',
      String(volumeId)
    ],
    context.smokeEnv
  );

  if (
    volumeDetach.action !== 'volume-detach' ||
    volumeDetach.node_id !== options.nodeId ||
    volumeDetach.volume.id !== volumeId
  ) {
    throw new Error(
      'Expected node volume detach to target the created volume.'
    );
  }

  await updateManifest(context, (manifest) => {
    manifest.volume_attached_node_id = null;
  });

  await waitForVolumeStatus(volumeId, context.smokeEnv, {
    acceptedStatuses: ['Available'],
    description: 'Available'
  });

  const volumeDelete = await runJsonCommand<VolumeDeleteJson>(
    ['volume', 'delete', String(volumeId), '--force'],
    context.smokeEnv
  );

  if (volumeDelete.volume_id !== volumeId) {
    throw new Error('Expected volume delete to remove the created volume.');
  }

  await updateManifest(context, (manifest) => {
    manifest.volume_deleted = true;
  });

  return {
    volumeId
  };
}

export async function runVpcSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
    vpcName: string;
  }
): Promise<{
  vpcId: number;
}> {
  const vpcCreate = await runJsonCommand<VpcCreateJson>(
    [
      'vpc',
      'create',
      '--name',
      options.vpcName,
      '--billing-type',
      'hourly',
      '--cidr-source',
      'e2e'
    ],
    context.smokeEnv
  );
  const vpcId = vpcCreate.vpc.id;

  if (!Number.isInteger(vpcId)) {
    throw new Error('Expected vpc create to return a VPC id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.vpc_id = vpcId;
  });

  const vpcGet = await runJsonCommand<VpcGetJson>(
    ['vpc', 'get', String(vpcId)],
    context.smokeEnv
  );

  if (vpcGet.vpc.id !== vpcId) {
    throw new Error('Expected vpc get to return the created VPC.');
  }

  await waitForVpcState(context, vpcId, {
    acceptedStates: ['Active'],
    description: 'Active'
  });

  const vpcAttach = await runJsonCommand<VpcAttachDetachJson>(
    [
      'node',
      'action',
      'vpc',
      'attach',
      String(options.nodeId),
      '--vpc-id',
      String(vpcId)
    ],
    context.smokeEnv
  );

  if (
    vpcAttach.action !== 'vpc-attach' ||
    vpcAttach.node_id !== options.nodeId ||
    vpcAttach.vpc.id !== vpcId
  ) {
    throw new Error('Expected node VPC attach to target the created VPC.');
  }

  await updateManifest(context, (manifest) => {
    manifest.vpc_attached_node_id = options.nodeId;
  });

  await waitForNodeVpcAttachmentState(
    context,
    options.nodeId,
    true,
    'attached to the created VPC'
  );

  const vpcDetach = await runJsonCommand<VpcAttachDetachJson>(
    [
      'node',
      'action',
      'vpc',
      'detach',
      String(options.nodeId),
      '--vpc-id',
      String(vpcId)
    ],
    context.smokeEnv
  );

  if (
    vpcDetach.action !== 'vpc-detach' ||
    vpcDetach.node_id !== options.nodeId ||
    vpcDetach.vpc.id !== vpcId
  ) {
    throw new Error('Expected node VPC detach to target the created VPC.');
  }

  await updateManifest(context, (manifest) => {
    manifest.vpc_attached_node_id = null;
  });

  const vpcDelete = await deleteVpcWithRetry(context, vpcId);

  if (vpcDelete.vpc.id !== vpcId) {
    throw new Error('Expected vpc delete to remove the created VPC.');
  }

  await updateManifest(context, (manifest) => {
    manifest.vpc_deleted = true;
  });

  return {
    vpcId
  };
}

export async function runSshKeyCreateAndAttachSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
    sshKeyLabel: string;
  }
): Promise<{
  sshKeyId: number;
}> {
  const sshKeyCreate = await runJsonCommand<SshKeyCreateJson>(
    [
      'ssh-key',
      'create',
      '--label',
      options.sshKeyLabel,
      '--public-key-file',
      '-'
    ],
    context.smokeEnv,
    {
      stdin: `${MANUAL_SMOKE_PUBLIC_KEY}\n`
    }
  );
  const sshKeyId = sshKeyCreate.item.id;

  if (!Number.isInteger(sshKeyId)) {
    throw new Error('Expected ssh-key create to return an SSH key id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.ssh_key_id = sshKeyId;
  });

  const sshKeyGet = await runJsonCommand<SshKeyGetJson>(
    ['ssh-key', 'get', String(sshKeyId)],
    context.smokeEnv
  );

  if (sshKeyGet.item.id !== sshKeyId) {
    throw new Error('Expected ssh-key get to return the created SSH key.');
  }

  const sshKeyAttach = await runJsonCommand<SshKeyAttachJson>(
    [
      'node',
      'action',
      'ssh-key',
      'attach',
      String(options.nodeId),
      '--ssh-key-id',
      String(sshKeyId)
    ],
    context.smokeEnv
  );

  if (
    sshKeyAttach.action !== 'ssh-key-attach' ||
    sshKeyAttach.node_id !== options.nodeId ||
    sshKeyAttach.ssh_keys.every((item) => item.id !== sshKeyId)
  ) {
    throw new Error('Expected node SSH key attach to include the created key.');
  }

  await updateManifest(context, (manifest) => {
    manifest.ssh_key_attached_node_id = options.nodeId;
  });

  return {
    sshKeyId
  };
}

export async function runNodeLifecycleActionSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
    saveImageName: string;
  }
): Promise<{
  publicIp: string;
}> {
  let nodeGet = await waitForNodeReadiness(options.nodeId, context.smokeEnv, {
    requirePublicIp: true
  });
  let publicIp = requirePublicIp(nodeGet, options.nodeId);

  const powerOff = await runJsonCommand<NodePowerJson>(
    ['node', 'action', 'power-off', String(options.nodeId)],
    context.smokeEnv
  );

  if (powerOff.action !== 'power-off' || powerOff.node_id !== options.nodeId) {
    throw new Error('Expected node power-off to target the created node.');
  }

  await waitForNodeStatus(options.nodeId, context.smokeEnv, {
    acceptedStatuses: ['Powered Off', 'Stopped'],
    description: 'Powered Off or Stopped'
  });

  const powerOn = await runJsonCommand<NodePowerJson>(
    ['node', 'action', 'power-on', String(options.nodeId)],
    context.smokeEnv
  );

  if (powerOn.action !== 'power-on' || powerOn.node_id !== options.nodeId) {
    throw new Error('Expected node power-on to target the created node.');
  }

  nodeGet = await waitForNodeReadiness(options.nodeId, context.smokeEnv, {
    requirePublicIp: true
  });
  publicIp = requirePublicIp(nodeGet, options.nodeId);

  const saveImage = await runJsonCommand<NodeSaveImageJson>(
    [
      'node',
      'action',
      'save-image',
      String(options.nodeId),
      '--name',
      options.saveImageName
    ],
    context.smokeEnv
  );
  const savedImageId = saveImage.result.image_id?.trim() ?? '';

  if (
    saveImage.action !== 'save-image' ||
    saveImage.node_id !== options.nodeId
  ) {
    throw new Error('Expected node save-image to target the created node.');
  }

  await updateManifest(context, (manifest) => {
    manifest.saved_image_deleted = savedImageId.length === 0;
    manifest.saved_image_id = savedImageId.length === 0 ? null : savedImageId;
  });

  await waitForNodeReadiness(options.nodeId, context.smokeEnv, {
    requirePublicIp: false
  });

  const upgrade = await runJsonCommand<NodeUpgradeJson>(
    [
      'node',
      'upgrade',
      String(options.nodeId),
      '--plan',
      context.smokeEnv.upgradePlan,
      '--image',
      context.smokeEnv.upgradeImage,
      '--force'
    ],
    context.smokeEnv
  );

  if (
    upgrade.action !== 'upgrade' ||
    upgrade.node_id !== options.nodeId ||
    upgrade.requested.plan !== context.smokeEnv.upgradePlan ||
    upgrade.requested.image !== context.smokeEnv.upgradeImage
  ) {
    throw new Error('Expected node upgrade to preserve the requested target.');
  }

  nodeGet = await waitForNodeReadiness(options.nodeId, context.smokeEnv, {
    requirePublicIp: true
  });
  publicIp = requirePublicIp(nodeGet, options.nodeId);

  return {
    publicIp
  };
}

export async function runNodePublicIpDetachStep(
  context: SmokeStepContext,
  options: {
    nodeId: number;
  }
): Promise<{
  publicIp: string;
}> {
  const nodeGet = await waitForNodeReadiness(options.nodeId, context.smokeEnv, {
    requirePublicIp: true
  });
  const publicIp = requirePublicIp(nodeGet, options.nodeId);
  const detachResult = await runJsonCommand<NodePublicIpDetachJson>(
    [
      'node',
      'action',
      'public-ip',
      'detach',
      String(options.nodeId),
      '--force'
    ],
    context.smokeEnv
  );

  if (
    detachResult.action !== 'public-ip-detach' ||
    detachResult.node_id !== options.nodeId ||
    detachResult.public_ip !== publicIp
  ) {
    throw new Error(
      'Expected node public-ip detach to target the created node and current public IP.'
    );
  }

  await waitForNodeStatus(options.nodeId, context.smokeEnv, {
    acceptedStatuses: ['Running'],
    description: 'Running without a public IP',
    requireMissingPublicIp: true
  });

  return {
    publicIp
  };
}

export async function runNodeDeleteSteps(
  context: SmokeStepContext,
  options: {
    nodeId: number;
  }
): Promise<void> {
  await waitForNodeReadiness(options.nodeId, context.smokeEnv, {
    requirePublicIp: true
  });

  const preserveNodeIp = await runJsonCommand<ReservedIpReserveNodeJson>(
    ['reserved-ip', 'reserve', 'node', String(options.nodeId)],
    context.smokeEnv
  );
  const preservedReservedIp = preserveNodeIp.ip_address;

  if (preservedReservedIp.length === 0) {
    throw new Error(
      'Expected reserved-ip reserve node to return a preserved IP address.'
    );
  }

  await updateManifest(context, (manifest) => {
    manifest.preserved_reserved_ip = preservedReservedIp;
  });

  await runJsonCommand(
    ['node', 'delete', String(options.nodeId), '--force'],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.addon_reserved_ip_attached_node_id = null;
    manifest.node_deleted = true;
    manifest.security_group_attached_node_id = null;
    manifest.ssh_key_attached_node_id = null;
    manifest.volume_attached_node_id = null;
    manifest.vpc_attached_node_id = null;
  });

  const preservedIpGet = await runJsonCommand<ReservedIpGetJson>(
    ['reserved-ip', 'get', preservedReservedIp],
    context.smokeEnv
  );

  if (preservedIpGet.reserved_ip.ip_address !== preservedReservedIp) {
    throw new Error(
      'Expected reserved-ip get to return the preserved node address.'
    );
  }

  await runJsonCommand(
    ['reserved-ip', 'delete', preservedReservedIp, '--force'],
    context.smokeEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.preserved_reserved_ip_deleted = true;
  });
}

export async function runSshKeyDeleteStep(
  context: SmokeStepContext,
  options: {
    sshKeyId: number;
  }
): Promise<void> {
  const sshKeyDelete = await runJsonCommand<SshKeyDeleteJson>(
    ['ssh-key', 'delete', String(options.sshKeyId), '--force'],
    context.smokeEnv
  );

  if (sshKeyDelete.id !== options.sshKeyId) {
    throw new Error('Expected ssh-key delete to remove the created key.');
  }

  await updateManifest(context, (manifest) => {
    manifest.ssh_key_attached_node_id = null;
    manifest.ssh_key_deleted = true;
  });
}

async function updateManifest(
  context: SmokeStepContext,
  mutate: Parameters<typeof updateSmokeManifest>[1]
): Promise<void> {
  await updateSmokeManifest(context.manifestPath, mutate);
}

function requirePublicIp(nodeGet: NodeGetJson, nodeId: number): string {
  const publicIp = normalizeObservedPublicIp(nodeGet.node.public_ip_address);

  if (publicIp === null) {
    throw new Error(
      `Expected node ${nodeId} to expose a public IP for manual smoke.`
    );
  }

  return publicIp;
}

async function waitForNodeVpcAttachmentState(
  context: SmokeStepContext,
  nodeId: number,
  expectedAttached: boolean,
  description: string
): Promise<NodeGetJson> {
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastNode: NodeGetJson['node'] | undefined;
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      const nodeGet = await runJsonCommand<NodeGetJson>(
        ['node', 'get', String(nodeId)],
        context.smokeEnv
      );

      lastNode = nodeGet.node;
      lastError = undefined;

      if ((nodeGet.node.is_vpc_attached ?? false) === expectedAttached) {
        return nodeGet;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  const lastObservedState =
    lastNode === undefined
      ? (lastError?.message ?? 'No successful node get response was observed.')
      : `is_vpc_attached=${String(lastNode.is_vpc_attached ?? false)}`;

  throw new Error(
    `Timed out waiting for node ${nodeId} to become ${description}. Last observed state: ${lastObservedState}`
  );
}

async function deleteVpcWithRetry(
  context: SmokeStepContext,
  vpcId: number
): Promise<VpcDeleteJson> {
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      return await runJsonCommand<VpcDeleteJson>(
        ['vpc', 'delete', String(vpcId), '--force'],
        context.smokeEnv
      );
    } catch (error: unknown) {
      const resolvedError = toError(error);

      if (!shouldRetryVpcDeleteError(resolvedError.message)) {
        throw resolvedError;
      }

      lastError = resolvedError;
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  throw new Error(
    `Timed out deleting VPC ${vpcId} after detach. Last observed error: ${
      lastError?.message ?? 'No retryable delete error was captured.'
    }`
  );
}

async function waitForVpcState(
  context: SmokeStepContext,
  vpcId: number,
  options: {
    acceptedStates: string[];
    description: string;
    requireNoAttachedVmCount?: boolean;
  }
): Promise<VpcGetJson> {
  const deadline = Date.now() + 10 * 60 * 1000;
  const accepted = new Set(
    options.acceptedStates.map((state) => normalizeLifecycleState(state))
  );
  let lastVpc: VpcGetJson['vpc'] | undefined;
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      const vpcGet = await runJsonCommand<VpcGetJson>(
        ['vpc', 'get', String(vpcId)],
        context.smokeEnv
      );
      const normalizedState = normalizeLifecycleState(vpcGet.vpc.state);
      const attachedVmCount = vpcGet.vpc.attached_vm_count ?? 0;

      lastVpc = vpcGet.vpc;
      lastError = undefined;

      if (
        accepted.has(normalizedState) &&
        (!options.requireNoAttachedVmCount || attachedVmCount === 0)
      ) {
        return vpcGet;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  const lastObservedState =
    lastVpc === undefined
      ? (lastError?.message ?? 'No successful VPC get response was observed.')
      : `state=${lastVpc.state ?? '<missing>'}`;

  throw new Error(
    `Timed out waiting for VPC ${vpcId} to become ${
      options.description
    }. Last observed state: ${lastObservedState}`
  );
}

function shouldRetryVpcDeleteError(message: string): boolean {
  return (
    /you have running servers on this vpc/i.test(message) ||
    /vpc is in creating state/i.test(message) ||
    /please try again later/i.test(message)
  );
}

function normalizeLifecycleState(state: string | undefined): string {
  return (state ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
