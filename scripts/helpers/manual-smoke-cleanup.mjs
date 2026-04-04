import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const VOLUME_READY_TIMEOUT_MS = 10 * 60 * 1000;
const VOLUME_READY_POLL_INTERVAL_MS = 10 * 1000;

export async function runSmokeCleanup(context) {
  let hadFailures = false;

  const fail = (message) => {
    hadFailures = true;
    context.logError(message);
  };

  await cleanupDnsRecords(context, fail);
  await cleanupCreatedDnsDomain(context, fail);
  await cleanupAddonReservedIpAttachment(context, fail);
  await cleanupVolumeAttachment(context, fail);
  await cleanupVpcAttachment(context, fail);
  await cleanupNode(context, fail);
  await cleanupReservedIp(
    context,
    fail,
    'addon_reserved_ip',
    'addon_reserved_ip_deleted'
  );
  await cleanupReservedIp(
    context,
    fail,
    'preserved_reserved_ip',
    'preserved_reserved_ip_deleted'
  );
  await cleanupVolume(context, fail);
  await cleanupVpc(context, fail);
  await cleanupSavedImage(context, fail);
  await cleanupSshKey(context, fail);
  await cleanupSecurityGroup(context, fail);
  await cleanupTempRulesFile(context, fail);

  return {
    hadFailures
  };
}

export function classifyCleanupMessage(message) {
  return isAlreadyGoneMessage(message) ? 'already-gone' : 'retryable';
}

export function classifyCleanupError(error) {
  return classifyCleanupMessage(formatError(error));
}

export function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isAlreadyGoneMessage(message) {
  return /\bnot found\b/i.test(message) || /\balready gone\b/i.test(message);
}

export function isMissingFileError(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  );
}

export function toDnsDeleteContent(recordType, value) {
  return recordType === 'TXT' ? stripEnclosingDoubleQuotes(value) : value;
}

async function cleanupDnsRecords(context, fail) {
  const manifest = await context.loadManifest();

  for (const record of manifest.dns_records ?? []) {
    if (record.deleted) {
      continue;
    }

    const cliResult = await context.runCliCleanup([
      'dns',
      'record',
      'delete',
      record.domain_name,
      '--type',
      record.type,
      '--name',
      record.name,
      '--value',
      record.current_value,
      '--force'
    ]);

    if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
      await markDnsRecordDeleted(context, record);
      context.logInfo(
        `Cleaned DNS record ${record.type} ${record.name} ${record.current_value}.`
      );
      continue;
    }

    try {
      const clients = await context.getFallbackClients();

      await clients.dns.deleteRecord(record.domain_name, {
        content: toDnsDeleteContent(record.type, record.current_value),
        record_name: record.name,
        record_type: record.type,
        zone_name: record.domain_name
      });

      await markDnsRecordDeleted(context, record);
      context.logInfo(
        `Fallback-cleaned DNS record ${record.type} ${record.name} ${record.current_value}.`
      );
    } catch (error) {
      if (classifyCleanupError(error) === 'already-gone') {
        await markDnsRecordDeleted(context, record);
        context.logInfo(
          `DNS record ${record.type} ${record.name} ${record.current_value} was already gone.`
        );
        continue;
      }

      fail(
        `Failed to clean DNS record ${record.type} ${record.name}: ${formatError(error)}`
      );
    }
  }
}

async function cleanupCreatedDnsDomain(context, fail) {
  const manifest = await context.loadManifest();

  if (
    manifest.created_dns_domain === null ||
    manifest.created_dns_domain_deleted === true
  ) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'dns',
    'delete',
    manifest.created_dns_domain,
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.created_dns_domain_deleted = true;
    });
    context.logInfo(`Deleted DNS domain ${manifest.created_dns_domain}.`);
    return;
  }

  if (manifest.created_dns_domain_id === null) {
    fail(
      `Failed to delete DNS domain ${manifest.created_dns_domain}: missing created_dns_domain_id for cleanup fallback.`
    );
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await clients.dns.deleteDomain(manifest.created_dns_domain_id);

    await context.updateManifest((draft) => {
      draft.created_dns_domain_deleted = true;
    });
    context.logInfo(
      `Fallback-deleted DNS domain ${manifest.created_dns_domain}.`
    );
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.created_dns_domain_deleted = true;
      });
      context.logInfo(
        `DNS domain ${manifest.created_dns_domain} was already gone.`
      );
      return;
    }

    fail(
      `Failed to delete DNS domain ${manifest.created_dns_domain}: ${formatError(error)}`
    );
  }
}

async function cleanupAddonReservedIpAttachment(context, fail) {
  const manifest = await context.loadManifest();

  if (
    manifest.addon_reserved_ip === null ||
    manifest.node_deleted ||
    manifest.addon_reserved_ip_deleted ||
    manifest.addon_reserved_ip_attached_node_id === null
  ) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'reserved-ip',
    'detach',
    'node',
    manifest.addon_reserved_ip,
    '--node-id',
    String(manifest.addon_reserved_ip_attached_node_id)
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.addon_reserved_ip_attached_node_id = null;
    });
    context.logInfo(
      `Detached addon reserved IP ${manifest.addon_reserved_ip}.`
    );
    return;
  }

  try {
    const clients = await context.getFallbackClients();
    const inventoryItem = await findReservedIp(
      clients,
      manifest.addon_reserved_ip
    );

    if (inventoryItem?.vm_id === null || inventoryItem?.vm_id === undefined) {
      await context.updateManifest((draft) => {
        draft.addon_reserved_ip_attached_node_id = null;
      });
      context.logInfo(
        `Addon reserved IP ${manifest.addon_reserved_ip} was already detached.`
      );
      return;
    }

    await clients.reservedIp.detachReservedIpFromNode(
      manifest.addon_reserved_ip,
      {
        type: 'detach',
        vm_id: inventoryItem.vm_id
      }
    );

    await context.updateManifest((draft) => {
      draft.addon_reserved_ip_attached_node_id = null;
    });
    context.logInfo(
      `Fallback-detached addon reserved IP ${manifest.addon_reserved_ip}.`
    );
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.addon_reserved_ip_attached_node_id = null;
      });
      context.logInfo(
        `Addon reserved IP ${manifest.addon_reserved_ip} was already detached.`
      );
      return;
    }

    fail(
      `Failed to detach addon reserved IP ${manifest.addon_reserved_ip}: ${formatError(error)}`
    );
  }
}

async function cleanupVolumeAttachment(context, fail) {
  const manifest = await context.loadManifest();
  const volumeId = manifest.volume_id ?? null;
  const nodeId = manifest.volume_attached_node_id ?? null;

  if (
    volumeId === null ||
    nodeId === null ||
    manifest.node_deleted ||
    manifest.volume_deleted
  ) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'node',
    'action',
    'volume',
    'detach',
    String(nodeId),
    '--volume-id',
    String(volumeId)
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.volume_attached_node_id = null;
    });
    context.logInfo(`Detached volume ${volumeId} from node ${nodeId}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();
    const node = await clients.node.getNode(String(nodeId));
    const vmId = assertNodeVmId(node.vm_id, nodeId);

    await clients.volume.detachVolumeFromNode(volumeId, {
      vm_id: vmId
    });

    await context.updateManifest((draft) => {
      draft.volume_attached_node_id = null;
    });
    context.logInfo(
      `Fallback-detached volume ${volumeId} from node ${nodeId}.`
    );
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.volume_attached_node_id = null;
      });
      context.logInfo(`Volume ${volumeId} was already detached.`);
      return;
    }

    fail(
      `Failed to detach volume ${volumeId} from node ${nodeId}: ${formatError(error)}`
    );
  }
}

async function cleanupVpcAttachment(context, fail) {
  const manifest = await context.loadManifest();
  const vpcId = manifest.vpc_id ?? null;
  const nodeId = manifest.vpc_attached_node_id ?? null;

  if (
    vpcId === null ||
    nodeId === null ||
    manifest.node_deleted ||
    manifest.vpc_deleted
  ) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'node',
    'action',
    'vpc',
    'detach',
    String(nodeId),
    '--vpc-id',
    String(vpcId)
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.vpc_attached_node_id = null;
    });
    context.logInfo(`Detached VPC ${vpcId} from node ${nodeId}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await clients.vpc.detachNodeVpc({
      action: 'detach',
      network_id: vpcId,
      node_id: nodeId
    });

    await context.updateManifest((draft) => {
      draft.vpc_attached_node_id = null;
    });
    context.logInfo(`Fallback-detached VPC ${vpcId} from node ${nodeId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.vpc_attached_node_id = null;
      });
      context.logInfo(`VPC ${vpcId} was already detached.`);
      return;
    }

    fail(
      `Failed to detach VPC ${vpcId} from node ${nodeId}: ${formatError(error)}`
    );
  }
}

async function cleanupNode(context, fail) {
  const manifest = await context.loadManifest();

  if (manifest.node_id === null || manifest.node_deleted) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'node',
    'delete',
    String(manifest.node_id),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await markNodeDeleted(context);
    context.logInfo(`Deleted node ${manifest.node_id}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await clients.node.deleteNode(String(manifest.node_id));

    await markNodeDeleted(context);
    context.logInfo(`Fallback-deleted node ${manifest.node_id}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await markNodeDeleted(context);
      context.logInfo(`Node ${manifest.node_id} was already gone.`);
      return;
    }

    fail(`Failed to delete node ${manifest.node_id}: ${formatError(error)}`);
  }
}

async function cleanupReservedIp(context, fail, ipField, deletedField) {
  const manifest = await context.loadManifest();
  const ipAddress = manifest[ipField];

  if (ipAddress === null || manifest[deletedField]) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'reserved-ip',
    'delete',
    ipAddress,
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft[deletedField] = true;
      if (ipField === 'addon_reserved_ip') {
        draft.addon_reserved_ip_attached_node_id = null;
      }
    });
    context.logInfo(`Deleted reserved IP ${ipAddress}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await ensureReservedIpDetached(clients, ipAddress);
    await clients.reservedIp.deleteReservedIp(ipAddress);

    await context.updateManifest((draft) => {
      draft[deletedField] = true;
      if (ipField === 'addon_reserved_ip') {
        draft.addon_reserved_ip_attached_node_id = null;
      }
    });
    context.logInfo(`Fallback-deleted reserved IP ${ipAddress}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft[deletedField] = true;
        if (ipField === 'addon_reserved_ip') {
          draft.addon_reserved_ip_attached_node_id = null;
        }
      });
      context.logInfo(`Reserved IP ${ipAddress} was already gone.`);
      return;
    }

    fail(`Failed to delete reserved IP ${ipAddress}: ${formatError(error)}`);
  }
}

async function cleanupVolume(context, fail) {
  const manifest = await context.loadManifest();
  const volumeId = manifest.volume_id ?? null;

  if (volumeId === null || manifest.volume_deleted === true) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'volume',
    'delete',
    String(volumeId),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.volume_deleted = true;
    });
    context.logInfo(`Deleted volume ${volumeId}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();
    const readiness = await waitForVolumeDeletionReady(
      clients.volume,
      volumeId
    );

    if (readiness === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.volume_deleted = true;
      });
      context.logInfo(`Volume ${volumeId} was already gone.`);
      return;
    }

    await clients.volume.deleteVolume(volumeId);

    await context.updateManifest((draft) => {
      draft.volume_deleted = true;
    });
    context.logInfo(`Fallback-deleted volume ${volumeId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.volume_deleted = true;
      });
      context.logInfo(`Volume ${volumeId} was already gone.`);
      return;
    }

    fail(`Failed to delete volume ${volumeId}: ${formatError(error)}`);
  }
}

async function cleanupVpc(context, fail) {
  const manifest = await context.loadManifest();
  const vpcId = manifest.vpc_id ?? null;

  if (vpcId === null || manifest.vpc_deleted === true) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'vpc',
    'delete',
    String(vpcId),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.vpc_deleted = true;
    });
    context.logInfo(`Deleted VPC ${vpcId}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await clients.vpc.deleteVpc(vpcId);

    await context.updateManifest((draft) => {
      draft.vpc_deleted = true;
    });
    context.logInfo(`Fallback-deleted VPC ${vpcId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.vpc_deleted = true;
      });
      context.logInfo(`VPC ${vpcId} was already gone.`);
      return;
    }

    fail(`Failed to delete VPC ${vpcId}: ${formatError(error)}`);
  }
}

async function waitForVolumeDeletionReady(volumeClient, volumeId) {
  const deadline = Date.now() + VOLUME_READY_TIMEOUT_MS;
  let lastStatus = null;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      const volume = await volumeClient.getVolume(volumeId);
      const normalizedStatus = normalizeLifecycleStatus(volume.status);

      lastStatus = volume.status;
      lastError = null;

      if (normalizedStatus === 'available') {
        return 'ready';
      }
    } catch (error) {
      if (classifyCleanupError(error) === 'already-gone') {
        return 'already-gone';
      }

      lastError = formatError(error);
    }

    if (Date.now() < deadline) {
      await delay(VOLUME_READY_POLL_INTERVAL_MS);
    }
  }

  const lastObservedState =
    lastStatus === null
      ? (lastError ?? 'No successful volume get response was observed.')
      : `status=${lastStatus}`;

  throw new Error(
    `Timed out waiting for volume ${volumeId} to become Available before cleanup delete. Last observed state: ${lastObservedState}`
  );
}

async function cleanupSavedImage(context, fail) {
  const manifest = await context.loadManifest();

  if (
    manifest.saved_image_id === null ||
    manifest.saved_image_deleted === true
  ) {
    return;
  }

  try {
    await context.deleteSavedImage(manifest.saved_image_id);

    await context.updateManifest((draft) => {
      draft.saved_image_deleted = true;
    });
    context.logInfo(`Deleted saved image ${manifest.saved_image_id}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.saved_image_deleted = true;
      });
      context.logInfo(
        `Saved image ${manifest.saved_image_id} was already gone.`
      );
      return;
    }

    fail(
      `Failed to delete saved image ${manifest.saved_image_id}: ${formatError(error)}`
    );
  }
}

async function cleanupSshKey(context, fail) {
  const manifest = await context.loadManifest();
  const sshKeyId = manifest.ssh_key_id ?? null;

  if (sshKeyId === null || manifest.ssh_key_deleted === true) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'ssh-key',
    'delete',
    String(sshKeyId),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.ssh_key_attached_node_id = null;
      draft.ssh_key_deleted = true;
    });
    context.logInfo(`Deleted SSH key ${sshKeyId}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await clients.sshKey.deleteSshKey(sshKeyId);

    await context.updateManifest((draft) => {
      draft.ssh_key_attached_node_id = null;
      draft.ssh_key_deleted = true;
    });
    context.logInfo(`Fallback-deleted SSH key ${sshKeyId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.ssh_key_attached_node_id = null;
        draft.ssh_key_deleted = true;
      });
      context.logInfo(`SSH key ${sshKeyId} was already gone.`);
      return;
    }

    fail(`Failed to delete SSH key ${sshKeyId}: ${formatError(error)}`);
  }
}

async function cleanupSecurityGroup(context, fail) {
  const manifest = await context.loadManifest();

  if (manifest.security_group_id === null || manifest.security_group_deleted) {
    return;
  }

  const cliResult = await context.runCliCleanup([
    'security-group',
    'delete',
    String(manifest.security_group_id),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await context.updateManifest((draft) => {
      draft.security_group_deleted = true;
    });
    context.logInfo(`Deleted security group ${manifest.security_group_id}.`);
    return;
  }

  try {
    const clients = await context.getFallbackClients();

    await clients.securityGroup.deleteSecurityGroup(manifest.security_group_id);

    await context.updateManifest((draft) => {
      draft.security_group_deleted = true;
    });
    context.logInfo(
      `Fallback-deleted security group ${manifest.security_group_id}.`
    );
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await context.updateManifest((draft) => {
        draft.security_group_deleted = true;
      });
      context.logInfo(
        `Security group ${manifest.security_group_id} was already gone.`
      );
      return;
    }

    fail(
      `Failed to delete security group ${manifest.security_group_id}: ${formatError(error)}`
    );
  }
}

async function cleanupTempRulesFile(context, fail) {
  const manifest = await context.loadManifest();

  if (manifest.temp_rules_file_path === null) {
    return;
  }

  try {
    await context.removeFile(path.resolve(manifest.temp_rules_file_path));
  } catch (error) {
    if (!isMissingFileError(error)) {
      fail(
        `Failed to remove temp rules file ${manifest.temp_rules_file_path}: ${formatError(error)}`
      );
      return;
    }
  }

  await context.updateManifest((draft) => {
    draft.temp_rules_file_path = null;
  });
}

async function ensureReservedIpDetached(clients, ipAddress) {
  const inventoryItem = await findReservedIp(clients, ipAddress);

  if (inventoryItem?.vm_id === null || inventoryItem?.vm_id === undefined) {
    return;
  }

  await clients.reservedIp.detachReservedIpFromNode(ipAddress, {
    type: 'detach',
    vm_id: inventoryItem.vm_id
  });
}

async function findReservedIp(clients, ipAddress) {
  const items = await clients.reservedIp.listReservedIps();

  return items.find((candidate) => candidate.ip_address === ipAddress);
}

async function markDnsRecordDeleted(context, record) {
  await context.updateManifest((draft) => {
    const target = draft.dns_records.find(
      (candidate) =>
        candidate.domain_name === record.domain_name &&
        candidate.name === record.name &&
        candidate.type === record.type
    );

    if (target !== undefined) {
      target.deleted = true;
    }
  });
}

async function markNodeDeleted(context) {
  await context.updateManifest((draft) => {
    draft.addon_reserved_ip_attached_node_id = null;
    draft.node_deleted = true;
    draft.security_group_attached_node_id = null;
    draft.ssh_key_attached_node_id = null;
    draft.volume_attached_node_id = null;
    draft.vpc_attached_node_id = null;
  });
}

function assertNodeVmId(vmId, nodeId) {
  if (!Number.isInteger(vmId)) {
    throw new Error(`Node ${nodeId} does not expose a valid vm_id.`);
  }

  return vmId;
}

function stripEnclosingDoubleQuotes(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeLifecycleStatus(status) {
  return String(status)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
