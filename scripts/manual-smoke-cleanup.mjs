#!/usr/bin/env node

import { access, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  classifyCleanupError,
  classifyCleanupMessage,
  formatError,
  isMissingFileError,
  toDnsDeleteContent
} from './helpers/manual-smoke-cleanup.mjs';
import {
  loadSmokeManifest,
  updateSmokeManifest
} from './helpers/manual-smoke-manifest.mjs';
import { runProcess } from './helpers/process.mjs';

const CLI_ENTRYPOINT = path.resolve(process.cwd(), 'dist', 'app', 'index.js');
const BASE_URL_ENV_VAR = 'E2ECTL_MYACCOUNT_BASE_URL';
const CLEANUP_COMMAND_TIMEOUT_MS = 2 * 60 * 1000;

const manifestPath = parseManifestPath(process.argv.slice(2));
const cliEnv = readCleanupEnv(process.env);

await ensureBuiltCliExists();

console.log(`Using smoke manifest: ${manifestPath}`);

let hadFailures = false;
let fallbackClientsPromise;

await cleanupDnsRecords();
await cleanupAddonReservedIpAttachment();
await cleanupNode();
await cleanupReservedIp('addon_reserved_ip', 'addon_reserved_ip_deleted');
await cleanupReservedIp(
  'preserved_reserved_ip',
  'preserved_reserved_ip_deleted'
);
await cleanupVolume();
await cleanupVpc();
await cleanupSshKey();
await cleanupSecurityGroup();
await cleanupTempRulesFile();

process.exitCode = hadFailures ? 1 : 0;

async function cleanupDnsRecords() {
  const manifest = await loadManifest();

  for (const record of manifest.dns_records ?? []) {
    if (record.deleted) {
      continue;
    }

    const cliResult = await runCliCleanup([
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
      await markDnsRecordDeleted(record);
      console.log(
        `Cleaned DNS record ${record.type} ${record.name} ${record.current_value}.`
      );
      continue;
    }

    try {
      const clients = await getFallbackClients();

      await clients.dns.deleteRecord(record.domain_name, {
        content: toDnsDeleteContent(record.type, record.current_value),
        record_name: record.name,
        record_type: record.type,
        zone_name: record.domain_name
      });

      await markDnsRecordDeleted(record);
      console.log(
        `Fallback-cleaned DNS record ${record.type} ${record.name} ${record.current_value}.`
      );
    } catch (error) {
      if (classifyCleanupError(error) === 'already-gone') {
        await markDnsRecordDeleted(record);
        console.log(
          `DNS record ${record.type} ${record.name} ${record.current_value} was already gone.`
        );
        continue;
      }

      hadFailures = true;
      console.error(
        `Failed to clean DNS record ${record.type} ${record.name}: ${formatError(error)}`
      );
    }
  }
}

async function cleanupAddonReservedIpAttachment() {
  const manifest = await loadManifest();

  if (
    manifest.addon_reserved_ip === null ||
    manifest.node_deleted ||
    manifest.addon_reserved_ip_deleted ||
    manifest.addon_reserved_ip_attached_node_id === null
  ) {
    return;
  }

  const cliResult = await runCliCleanup([
    'reserved-ip',
    'detach',
    'node',
    manifest.addon_reserved_ip,
    '--node-id',
    String(manifest.addon_reserved_ip_attached_node_id)
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft.addon_reserved_ip_attached_node_id = null;
    });
    console.log(`Detached addon reserved IP ${manifest.addon_reserved_ip}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();
    const inventoryItem = await findReservedIp(
      clients,
      manifest.addon_reserved_ip
    );

    if (inventoryItem?.vm_id === null || inventoryItem?.vm_id === undefined) {
      await updateManifest((draft) => {
        draft.addon_reserved_ip_attached_node_id = null;
      });
      console.log(
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

    await updateManifest((draft) => {
      draft.addon_reserved_ip_attached_node_id = null;
    });
    console.log(
      `Fallback-detached addon reserved IP ${manifest.addon_reserved_ip}.`
    );
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft.addon_reserved_ip_attached_node_id = null;
      });
      console.log(
        `Addon reserved IP ${manifest.addon_reserved_ip} was already detached.`
      );
      return;
    }

    hadFailures = true;
    console.error(
      `Failed to detach addon reserved IP ${manifest.addon_reserved_ip}: ${formatError(error)}`
    );
  }
}

async function cleanupNode() {
  const manifest = await loadManifest();

  if (manifest.node_id === null || manifest.node_deleted) {
    return;
  }

  const cliResult = await runCliCleanup([
    'node',
    'delete',
    String(manifest.node_id),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft.node_deleted = true;
    });
    console.log(`Deleted node ${manifest.node_id}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();

    await clients.node.deleteNode(String(manifest.node_id));

    await updateManifest((draft) => {
      draft.node_deleted = true;
    });
    console.log(`Fallback-deleted node ${manifest.node_id}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft.node_deleted = true;
      });
      console.log(`Node ${manifest.node_id} was already gone.`);
      return;
    }

    hadFailures = true;
    console.error(
      `Failed to delete node ${manifest.node_id}: ${formatError(error)}`
    );
  }
}

async function cleanupReservedIp(ipField, deletedField) {
  const manifest = await loadManifest();
  const ipAddress = manifest[ipField];

  if (ipAddress === null || manifest[deletedField]) {
    return;
  }

  const cliResult = await runCliCleanup([
    'reserved-ip',
    'delete',
    ipAddress,
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft[deletedField] = true;
      if (ipField === 'addon_reserved_ip') {
        draft.addon_reserved_ip_attached_node_id = null;
      }
    });
    console.log(`Deleted reserved IP ${ipAddress}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();

    await ensureReservedIpDetached(clients, ipAddress);
    await clients.reservedIp.deleteReservedIp(ipAddress);

    await updateManifest((draft) => {
      draft[deletedField] = true;
      if (ipField === 'addon_reserved_ip') {
        draft.addon_reserved_ip_attached_node_id = null;
      }
    });
    console.log(`Fallback-deleted reserved IP ${ipAddress}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft[deletedField] = true;
        if (ipField === 'addon_reserved_ip') {
          draft.addon_reserved_ip_attached_node_id = null;
        }
      });
      console.log(`Reserved IP ${ipAddress} was already gone.`);
      return;
    }

    hadFailures = true;
    console.error(
      `Failed to delete reserved IP ${ipAddress}: ${formatError(error)}`
    );
  }
}

async function cleanupVolume() {
  const manifest = await loadManifest();
  const volumeId = manifest.volume_id ?? null;

  if (volumeId === null || manifest.volume_deleted === true) {
    return;
  }

  const cliResult = await runCliCleanup([
    'volume',
    'delete',
    String(volumeId),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft.volume_deleted = true;
    });
    console.log(`Deleted volume ${volumeId}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();

    await clients.volume.deleteVolume(volumeId);

    await updateManifest((draft) => {
      draft.volume_deleted = true;
    });
    console.log(`Fallback-deleted volume ${volumeId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft.volume_deleted = true;
      });
      console.log(`Volume ${volumeId} was already gone.`);
      return;
    }

    hadFailures = true;
    console.error(`Failed to delete volume ${volumeId}: ${formatError(error)}`);
  }
}

async function cleanupVpc() {
  const manifest = await loadManifest();
  const vpcId = manifest.vpc_id ?? null;

  if (vpcId === null || manifest.vpc_deleted === true) {
    return;
  }

  const cliResult = await runCliCleanup([
    'vpc',
    'delete',
    String(vpcId),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft.vpc_deleted = true;
    });
    console.log(`Deleted VPC ${vpcId}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();

    await clients.vpc.deleteVpc(vpcId);

    await updateManifest((draft) => {
      draft.vpc_deleted = true;
    });
    console.log(`Fallback-deleted VPC ${vpcId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft.vpc_deleted = true;
      });
      console.log(`VPC ${vpcId} was already gone.`);
      return;
    }

    hadFailures = true;
    console.error(`Failed to delete VPC ${vpcId}: ${formatError(error)}`);
  }
}

async function cleanupSshKey() {
  const manifest = await loadManifest();
  const sshKeyId = manifest.ssh_key_id ?? null;

  if (sshKeyId === null || manifest.ssh_key_deleted === true) {
    return;
  }

  const cliResult = await runCliCleanup([
    'ssh-key',
    'delete',
    String(sshKeyId),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft.ssh_key_deleted = true;
    });
    console.log(`Deleted SSH key ${sshKeyId}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();

    await clients.sshKey.deleteSshKey(sshKeyId);

    await updateManifest((draft) => {
      draft.ssh_key_deleted = true;
    });
    console.log(`Fallback-deleted SSH key ${sshKeyId}.`);
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft.ssh_key_deleted = true;
      });
      console.log(`SSH key ${sshKeyId} was already gone.`);
      return;
    }

    hadFailures = true;
    console.error(
      `Failed to delete SSH key ${sshKeyId}: ${formatError(error)}`
    );
  }
}

async function cleanupSecurityGroup() {
  const manifest = await loadManifest();

  if (manifest.security_group_id === null || manifest.security_group_deleted) {
    return;
  }

  const cliResult = await runCliCleanup([
    'security-group',
    'delete',
    String(manifest.security_group_id),
    '--force'
  ]);

  if (cliResult.status === 'ok' || cliResult.status === 'already-gone') {
    await updateManifest((draft) => {
      draft.security_group_deleted = true;
    });
    console.log(`Deleted security group ${manifest.security_group_id}.`);
    return;
  }

  try {
    const clients = await getFallbackClients();

    await clients.securityGroup.deleteSecurityGroup(manifest.security_group_id);

    await updateManifest((draft) => {
      draft.security_group_deleted = true;
    });
    console.log(
      `Fallback-deleted security group ${manifest.security_group_id}.`
    );
  } catch (error) {
    if (classifyCleanupError(error) === 'already-gone') {
      await updateManifest((draft) => {
        draft.security_group_deleted = true;
      });
      console.log(
        `Security group ${manifest.security_group_id} was already gone.`
      );
      return;
    }

    hadFailures = true;
    console.error(
      `Failed to delete security group ${manifest.security_group_id}: ${formatError(error)}`
    );
  }
}

async function cleanupTempRulesFile() {
  const manifest = await loadManifest();

  if (manifest.temp_rules_file_path === null) {
    return;
  }

  try {
    await unlink(path.resolve(manifest.temp_rules_file_path));
  } catch (error) {
    if (!isMissingFileError(error)) {
      hadFailures = true;
      console.error(
        `Failed to remove temp rules file ${manifest.temp_rules_file_path}: ${formatError(error)}`
      );
      return;
    }
  }

  await updateManifest((draft) => {
    draft.temp_rules_file_path = null;
  });
}

async function ensureBuiltCliExists() {
  try {
    await access(CLI_ENTRYPOINT);
  } catch {
    throw new Error(
      'Build the CLI first with make build before running manual smoke cleanup.'
    );
  }
}

async function loadManifest() {
  return await loadSmokeManifest(manifestPath);
}

async function updateManifest(mutate) {
  return await updateSmokeManifest(manifestPath, mutate);
}

async function markDnsRecordDeleted(record) {
  await updateManifest((draft) => {
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

async function runCliCleanup(args) {
  try {
    const result = await runProcess(
      process.execPath,
      [CLI_ENTRYPOINT, '--json', ...args],
      {
        env: cliEnv,
        timeoutMs: CLEANUP_COMMAND_TIMEOUT_MS
      }
    );

    if (result.exitCode === 0) {
      return {
        status: 'ok'
      };
    }

    const output = `${result.stderr}\n${result.stdout}`.trim();
    const classifiedStatus = classifyCleanupMessage(output);

    if (classifiedStatus === 'already-gone') {
      return {
        status: classifiedStatus
      };
    }

    console.error(`CLI cleanup failed: e2ectl ${args.join(' ')}`);
    if (output.length > 0) {
      console.error(output);
    }

    return {
      status: classifiedStatus
    };
  } catch (error) {
    console.error(`CLI cleanup failed: e2ectl ${args.join(' ')}`);
    console.error(formatError(error));

    return {
      status: classifyCleanupError(error)
    };
  }
}

async function getFallbackClients() {
  if (fallbackClientsPromise === undefined) {
    fallbackClientsPromise = createFallbackClients();
  }

  return await fallbackClientsPromise;
}

async function createFallbackClients() {
  const [
    { DnsApiClient },
    { MyAccountApiTransport },
    { NodeApiClient },
    { ReservedIpApiClient },
    { SecurityGroupApiClient },
    { SshKeyApiClient },
    { VolumeApiClient },
    { VpcApiClient }
  ] = await Promise.all([
    import('../dist/dns/index.js'),
    import('../dist/myaccount/index.js'),
    import('../dist/node/index.js'),
    import('../dist/reserved-ip/index.js'),
    import('../dist/security-group/index.js'),
    import('../dist/ssh-key/index.js'),
    import('../dist/volume/index.js'),
    import('../dist/vpc/index.js')
  ]);

  const transport = new MyAccountApiTransport(
    {
      api_key: cliEnv.E2E_API_KEY,
      auth_token: cliEnv.E2E_AUTH_TOKEN,
      location: cliEnv.E2E_LOCATION,
      project_id: cliEnv.E2E_PROJECT_ID,
      source: 'env'
    },
    cliEnv[BASE_URL_ENV_VAR] === undefined
      ? {}
      : {
          baseUrl: cliEnv[BASE_URL_ENV_VAR]
        }
  );

  return {
    dns: new DnsApiClient(transport),
    node: new NodeApiClient(transport),
    reservedIp: new ReservedIpApiClient(transport),
    securityGroup: new SecurityGroupApiClient(transport),
    sshKey: new SshKeyApiClient(transport),
    volume: new VolumeApiClient(transport),
    vpc: new VpcApiClient(transport)
  };
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

function readCleanupEnv(env) {
  const required = [
    'E2E_API_KEY',
    'E2E_AUTH_TOKEN',
    'E2E_PROJECT_ID',
    'E2E_LOCATION'
  ];
  const missing = required.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Manual smoke cleanup requires ${required.join(', ')}. Missing: ${missing.join(', ')}.`
    );
  }

  return {
    E2E_API_KEY: env.E2E_API_KEY.trim(),
    E2E_AUTH_TOKEN: env.E2E_AUTH_TOKEN.trim(),
    E2E_LOCATION: env.E2E_LOCATION.trim(),
    E2E_PROJECT_ID: env.E2E_PROJECT_ID.trim(),
    ...(env[BASE_URL_ENV_VAR] === undefined ||
    env[BASE_URL_ENV_VAR].trim().length === 0
      ? {}
      : {
          [BASE_URL_ENV_VAR]: env[BASE_URL_ENV_VAR].trim()
        })
  };
}

function parseManifestPath(args) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--manifest') {
      const candidate = args[index + 1];

      if (candidate !== undefined && candidate.trim().length > 0) {
        return path.resolve(candidate);
      }
    }
  }

  throw new Error(
    'Usage: npm run test:manual:smoke:cleanup -- --manifest <path>'
  );
}
