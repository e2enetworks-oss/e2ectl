#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const CLI_ENTRYPOINT = path.resolve(process.cwd(), 'dist', 'app', 'index.js');
const BASE_URL_ENV_VAR = 'E2ECTL_MYACCOUNT_BASE_URL';

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
      console.log(
        `Fallback-cleaned DNS record ${record.type} ${record.name} ${record.current_value}.`
      );
    } catch (error) {
      if (isAlreadyGoneError(error)) {
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
    if (isAlreadyGoneError(error)) {
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
    if (isAlreadyGoneError(error)) {
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
    if (isAlreadyGoneError(error)) {
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
    if (isAlreadyGoneError(error)) {
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
  const contents = await readFile(manifestPath, 'utf8');
  return JSON.parse(contents);
}

async function updateManifest(mutate) {
  const manifest = await loadManifest();

  mutate(manifest);
  manifest.updated_at = new Date().toISOString();

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

async function runCliCleanup(args) {
  const result = await runProcess(
    process.execPath,
    [CLI_ENTRYPOINT, '--json', ...args],
    cliEnv
  );

  if (result.exitCode === 0) {
    return {
      status: 'ok'
    };
  }

  const output = `${result.stderr}\n${result.stdout}`.trim();

  if (isAlreadyGoneMessage(output)) {
    return {
      status: 'already-gone'
    };
  }

  console.error(`CLI cleanup failed: e2ectl ${args.join(' ')}`);
  if (output.length > 0) {
    console.error(output);
  }

  return {
    status: 'failed'
  };
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
    { SecurityGroupApiClient }
  ] = await Promise.all([
    import('../dist/dns/index.js'),
    import('../dist/myaccount/index.js'),
    import('../dist/node/index.js'),
    import('../dist/reserved-ip/index.js'),
    import('../dist/security-group/index.js')
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
    securityGroup: new SecurityGroupApiClient(transport)
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

function toDnsDeleteContent(recordType, value) {
  return recordType === 'TXT' ? stripEnclosingDoubleQuotes(value) : value;
}

function stripEnclosingDoubleQuotes(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
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
      const manifestPath = args[index + 1];

      if (manifestPath !== undefined && manifestPath.trim().length > 0) {
        return path.resolve(manifestPath);
      }
    }
  }

  throw new Error(
    'Usage: npm run test:manual:smoke:cleanup -- --manifest <path>'
  );
}

async function runProcess(command, args, env) {
  const child = spawn(command, args, {
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stderr,
        stdout
      });
    });
  });
}

function isAlreadyGoneError(error) {
  return isAlreadyGoneMessage(formatError(error));
}

function isAlreadyGoneMessage(message) {
  return /\bnot found\b/i.test(message) || /\balready gone\b/i.test(message);
}

function isMissingFileError(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  );
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
