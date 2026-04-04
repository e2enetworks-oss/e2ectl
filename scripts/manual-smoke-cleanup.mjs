#!/usr/bin/env node

import { access, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  classifyCleanupError,
  classifyCleanupMessage,
  formatError,
  runSmokeCleanup
} from './helpers/manual-smoke-cleanup.mjs';
import { deleteSavedImage as deleteSavedImageFallback } from './helpers/manual-smoke-image.mjs';
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

let fallbackClientsPromise;

const { hadFailures } = await runSmokeCleanup({
  deleteSavedImage: async (imageId) => {
    const clients = await getFallbackClients();

    await deleteSavedImageFallback(clients.transport, imageId);
  },
  getFallbackClients,
  loadManifest,
  logError: (message) => {
    console.error(message);
  },
  logInfo: (message) => {
    console.log(message);
  },
  removeFile: async (filePath) => {
    await unlink(filePath);
  },
  runCliCleanup,
  updateManifest
});

process.exitCode = hadFailures ? 1 : 0;

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
    transport,
    volume: new VolumeApiClient(transport),
    vpc: new VpcApiClient(transport)
  };
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
