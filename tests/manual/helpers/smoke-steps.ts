import type { SmokeEnv } from './smoke-env.js';
import { updateSmokeManifest } from './smoke-manifest.js';
import {
  discoverAvailableVolumeSize,
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
    id: number;
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
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFJlbGVhc2VTbW9rZUtleUZvckUyRUN0bA release-smoke@e2ectl';

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

  const vpcDelete = await runJsonCommand<VpcDeleteJson>(
    ['vpc', 'delete', String(vpcId), '--force'],
    context.smokeEnv
  );

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
    saveImage.node_id !== options.nodeId ||
    savedImageId.length === 0
  ) {
    throw new Error('Expected node save-image to return a saved image id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.saved_image_deleted = false;
    manifest.saved_image_id = savedImageId;
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
  const publicIp = nodeGet.node.public_ip_address?.trim();

  if (publicIp === undefined || publicIp.length === 0) {
    throw new Error(
      `Expected node ${nodeId} to expose a public IP for manual smoke.`
    );
  }

  return publicIp;
}
