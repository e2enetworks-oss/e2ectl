// NOTE: First per-resource destructive test suite with VPC/network support.
// Creates and destroys VPC and DBaaS cluster.
// TODO: Add destructive tests for other resources following this pattern:
// - tests/manual/destructive/node/destructive.test.ts (extract from smoke/)
// - tests/manual/destructive/volume/destructive.test.ts
// - tests/manual/destructive/reserved-ip/destructive.test.ts
// - tests/manual/destructive/ssh-key/destructive.test.ts
// See: docs/maintainers/maintaining.md#dbaas-destructive-lane

import { access, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { runBuiltCli } from '../../../helpers/process.js';
import {
  readDbaasManualEnv,
  type DbaasManualEnv
} from '../../helpers/dbaas-env.js';
import {
  createEmptyDbaasManifest,
  type DbaasCreateJson,
  type DbaasDeleteJson,
  type DbaasGetJson,
  type DbaasResetPasswordJson,
  type DbaasSmokeManifest,
  waitForDbaasStatus
} from '../../helpers/dbaas-helpers.js';

const runManualSuite = process.env.E2ECTL_RUN_MANUAL_E2E === '1';
const describeManual = runManualSuite ? describe : describe.skip;

const MANUAL_DESTRUCTIVE_COMMAND_TIMEOUT_MS = 120 * 1000; // 2 minutes
const MANUAL_DESTRUCTIVE_TEST_TIMEOUT_MS = 40 * 60 * 1000; // 40 minutes

interface DbaasTestContext {
  manifestPath: string;
  dbaasEnv: DbaasManualEnv;
}

interface DbaasConfig {
  type: string;
  version: string;
  plan: string;
  databaseName: string;
  password: string;
}

function readDbaasConfig(): DbaasConfig {
  const type = process.env.E2ECTL_MANUAL_DBAAS_TYPE;
  const version = process.env.E2ECTL_MANUAL_DBAAS_VERSION;
  const plan = process.env.E2ECTL_MANUAL_DBAAS_PLAN;
  const databaseName = process.env.E2ECTL_MANUAL_DBAAS_DATABASE_NAME;
  const password = process.env.E2ECTL_MANUAL_DBAAS_PASSWORD;

  if (!type || !version || !plan || !databaseName || !password) {
    const missing: string[] = [];
    if (!type) missing.push('E2ECTL_MANUAL_DBAAS_TYPE');
    if (!version) missing.push('E2ECTL_MANUAL_DBAAS_VERSION');
    if (!plan) missing.push('E2ECTL_MANUAL_DBAAS_PLAN');
    if (!databaseName) missing.push('E2ECTL_MANUAL_DBAAS_DATABASE_NAME');
    if (!password) missing.push('E2ECTL_MANUAL_DBAAS_PASSWORD');

    throw new Error(
      `Missing required DBaaS environment variables: ${missing.join(', ')}`
    );
  }

  return { type, version, plan, databaseName, password };
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
    state: string;
  };
}

interface VpcDeleteJson {
  action: 'delete';
  vpc: {
    id: number;
  };
}

interface DbaasNetworkAttachJson {
  action: 'vpc-attach' | 'public-ip-attach';
  dbaas_id: number;
}

interface DbaasNetworkDetachJson {
  action: 'vpc-detach' | 'public-ip-detach';
  dbaas_id: number;
}

describeManual('manual DBaaS destructive built CLI checks', () => {
  beforeAll(async () => {
    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'exercises full DBaaS lifecycle with VPC through the built CLI',
    { timeout: MANUAL_DESTRUCTIVE_TEST_TIMEOUT_MS },
    async () => {
      const dbaasConfig = readDbaasConfig();
      const manualEnv = readDbaasManualEnv();
      const runPrefix = `${manualEnv.prefix}-dbaas-${Date.now().toString(36)}`;
      const context = await prepareDbaasContext(runPrefix);
      let vpcId: number | undefined;
      let dbaasId: number | undefined;
      let cleanupError: Error | undefined;
      let workflowError: unknown;

      try {
        // 1. Create VPC
        const vpcResult = await createVpcStep(context, {
          name: `${runPrefix}-vpc`
        });
        vpcId = vpcResult.vpcId;

        // 2. Create DBaaS with VPC attached
        const dbaasResult = await createDbaasStep(context, {
          name: `${runPrefix}-db`,
          type: dbaasConfig.type,
          version: dbaasConfig.version,
          plan: dbaasConfig.plan,
          databaseName: dbaasConfig.databaseName,
          password: dbaasConfig.password,
          vpcId
        });
        dbaasId = dbaasResult.dbaasId;

        await waitForDbaasRunningStep(context, dbaasId);

        // 3. Detach public IP (must be detached first)
        await detachPublicIpStep(context, { dbaasId });
        await waitForDbaasRunningStep(context, dbaasId);

        // 4. Re-attach public IP (required before VPC detach)
        await attachPublicIpStep(context, { dbaasId });
        await waitForDbaasRunningStep(context, dbaasId);

        // 5. Reset password (with compliant 16+ char password)
        await resetPasswordStep(context, {
          dbaasId,
          password: 'NewPassword12345!@#' // 19 chars
        });
        await waitForDbaasRunningStep(context, dbaasId);

        // 6. Detach VPC (requires public IP to be attached)
        await detachVpcStep(context, { dbaasId, vpcId });

        // 7. Delete DBaaS
        await deleteDbaasStep(context, { dbaasId });
        dbaasId = undefined; // Mark as deleted

        // 8. Delete VPC
        await deleteVpcStep(context, { vpcId });
        vpcId = undefined; // Mark as deleted
      } catch (error: unknown) {
        workflowError = error;
        console.error(`DBaaS test manifest: ${context.manifestPath}`);
        if (dbaasId) console.error(`DBaaS ID for manual cleanup: ${dbaasId}`);
        if (vpcId) console.error(`VPC ID for manual cleanup: ${vpcId}`);
      } finally {
        // Cleanup on failure
        const cleanupResult = await runCleanup(context, dbaasId, vpcId);

        if (cleanupResult.exitCode !== 0) {
          console.error(`DBaaS test manifest: ${context.manifestPath}`);
          console.error(cleanupResult.stdout);
          console.error(cleanupResult.stderr);

          if (workflowError === undefined) {
            cleanupError = new Error(
              `DBaaS cleanup failed for manifest ${context.manifestPath}.`
            );
          }
        }
      }

      if (workflowError !== undefined) {
        throw toError(workflowError);
      }

      if (cleanupError !== undefined) {
        throw cleanupError;
      }
    }
  );
});

async function prepareDbaasContext(
  runPrefix: string
): Promise<DbaasTestContext> {
  const manifestDir = path.resolve(process.cwd(), '.manual-dbaas');
  await mkdir(manifestDir, { recursive: true });

  const manifestPath = path.join(manifestDir, `${runPrefix}-manifest.json`);
  const manifest = createEmptyDbaasManifest();

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    manifestPath,
    dbaasEnv: readDbaasManualEnv()
  };
}

async function createVpcStep(
  context: DbaasTestContext,
  options: {
    name: string;
  }
): Promise<{ vpcId: number }> {
  const vpcCreate = await runJsonCommand<VpcCreateJson>(
    [
      'vpc',
      'create',
      '--name',
      options.name,
      '--billing-type',
      'hourly',
      '--cidr-source',
      'e2e'
    ],
    context.dbaasEnv
  );

  const vpcId = vpcCreate.vpc.id;

  if (!Number.isInteger(vpcId)) {
    throw new Error('Expected VPC create to return a valid VPC id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.vpc_id = vpcId;
  });

  // Wait for VPC to be Active
  await waitForVpcState(context, vpcId, 'Active');

  return { vpcId };
}

async function waitForVpcState(
  context: DbaasTestContext,
  vpcId: number,
  targetState: string,
  timeoutMs: number = 10 * 60 * 1000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const vpcGet = await runJsonCommand<VpcGetJson>(
        ['vpc', 'get', String(vpcId)],
        context.dbaasEnv
      );

      if (vpcGet.vpc.state === targetState) {
        return;
      }
    } catch {
      // Ignore errors and retry
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  throw new Error(
    `Timed out waiting for VPC ${vpcId} to become ${targetState}`
  );
}

async function createDbaasStep(
  context: DbaasTestContext,
  options: {
    name: string;
    type: string;
    version: string;
    plan: string;
    databaseName: string;
    password: string;
    vpcId: number;
  }
): Promise<{ dbaasId: number }> {
  const dbaasCreate = await runJsonCommand<DbaasCreateJson>(
    [
      'dbaas',
      'create',
      '--name',
      options.name,
      '--type',
      options.type,
      '--db-version',
      options.version,
      '--plan',
      options.plan,
      '--database-name',
      options.databaseName,
      '--password',
      options.password,
      '--vpc-id',
      String(options.vpcId),
      '--public-ip'
    ],
    context.dbaasEnv
  );

  const dbaasId = dbaasCreate.dbaas.id;

  if (!Number.isInteger(dbaasId)) {
    throw new Error('Expected dbaas create to return a valid dbaas id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.dbaas_id = dbaasId;
    manifest.dbaas_name = options.name;
    manifest.database_name = options.databaseName;
    manifest.vpc_attached = true;
    manifest.public_ip_attached = true;
  });

  // Verify creation with get
  const dbaasGet = await runJsonCommand<DbaasGetJson>(
    ['dbaas', 'get', String(dbaasId)],
    context.dbaasEnv
  );

  if (dbaasGet.dbaas.id !== dbaasId) {
    throw new Error('Expected dbaas get to return the created cluster.');
  }

  return { dbaasId };
}

async function waitForDbaasRunningStep(
  context: DbaasTestContext,
  dbaasId: number
): Promise<void> {
  await waitForDbaasStatus(
    (args) => runJsonCommand<DbaasGetJson>(args, context.dbaasEnv),
    dbaasId,
    'Running'
  );
}

async function attachPublicIpStep(
  context: DbaasTestContext,
  options: {
    dbaasId: number;
  }
): Promise<void> {
  await runJsonCommand<DbaasNetworkAttachJson>(
    ['dbaas', 'network', 'attach-public-ip', String(options.dbaasId)],
    context.dbaasEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.public_ip_attached = true;
  });
}

async function detachPublicIpStep(
  context: DbaasTestContext,
  options: {
    dbaasId: number;
  }
): Promise<void> {
  await runJsonCommand<DbaasNetworkDetachJson>(
    [
      'dbaas',
      'network',
      'detach-public-ip',
      String(options.dbaasId),
      '--force'
    ],
    context.dbaasEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.public_ip_attached = false;
  });
}

async function detachVpcStep(
  context: DbaasTestContext,
  options: {
    dbaasId: number;
    vpcId: number;
  }
): Promise<void> {
  await runJsonCommand<DbaasNetworkDetachJson>(
    [
      'dbaas',
      'network',
      'detach-vpc',
      String(options.dbaasId),
      '--vpc-id',
      String(options.vpcId)
    ],
    context.dbaasEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.vpc_attached = false;
  });
}

async function resetPasswordStep(
  context: DbaasTestContext,
  options: {
    dbaasId: number;
    password: string;
  }
): Promise<void> {
  const resetResult = await runJsonCommand<DbaasResetPasswordJson>(
    [
      'dbaas',
      'reset-password',
      String(options.dbaasId),
      '--password',
      options.password
    ],
    context.dbaasEnv
  );

  if (resetResult.dbaas.id !== options.dbaasId) {
    throw new Error('Expected password reset to target the correct dbaas.');
  }
}

async function deleteDbaasStep(
  context: DbaasTestContext,
  options: {
    dbaasId: number;
  }
): Promise<void> {
  await runJsonCommand<DbaasDeleteJson>(
    ['dbaas', 'delete', String(options.dbaasId), '--force'],
    context.dbaasEnv
  );

  await updateManifest(context, (manifest) => {
    manifest.dbaas_deleted = true;
    manifest.dbaas_id = null;
  });
}

async function deleteVpcStep(
  context: DbaasTestContext,
  options: {
    vpcId: number;
  }
): Promise<void> {
  // VPC delete may need retry if resources are still detaching
  const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
  let lastError: Error | undefined;

  while (Date.now() <= deadline) {
    try {
      await runJsonCommand<VpcDeleteJson>(
        ['vpc', 'delete', String(options.vpcId), '--force'],
        context.dbaasEnv
      );

      await updateManifest(context, (manifest) => {
        manifest.vpc_deleted = true;
        manifest.vpc_id = null;
      });

      return;
    } catch (error: unknown) {
      lastError = toError(error);

      if (!shouldRetryVpcDeleteError(lastError.message)) {
        throw lastError;
      }
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  throw new Error(
    `Timed out deleting VPC ${options.vpcId}. Last error: ${lastError?.message ?? 'Unknown'}`
  );
}

function shouldRetryVpcDeleteError(message: string): boolean {
  return (
    /you have running servers on this vpc/i.test(message) ||
    /vpc is in creating state/i.test(message) ||
    /please try again later/i.test(message) ||
    /resource is in use/i.test(message)
  );
}

async function runCleanup(
  context: DbaasTestContext,
  dbaasId: number | undefined,
  vpcId: number | undefined
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  // Read manifest for any additional cleanup info
  let manifest: DbaasSmokeManifest | undefined;
  try {
    const content = await readFile(context.manifestPath, 'utf8');
    manifest = JSON.parse(content) as DbaasSmokeManifest;
  } catch {
    // Ignore manifest read errors
  }

  const dbaasToDelete = dbaasId ?? manifest?.dbaas_id;
  const vpcToDelete = vpcId ?? manifest?.vpc_id;

  // Cleanup DBaaS if exists and not deleted
  if (dbaasToDelete && !manifest?.dbaas_deleted) {
    try {
      // Try to detach VPC first if attached
      if (vpcToDelete && manifest?.vpc_attached) {
        try {
          await runJsonCommand<DbaasNetworkDetachJson>(
            [
              'dbaas',
              'network',
              'detach-vpc',
              String(dbaasToDelete),
              '--vpc-id',
              String(vpcToDelete)
            ],
            context.dbaasEnv
          );
        } catch {
          // Ignore detach errors
        }
      }

      // Try to detach public IP if attached
      if (manifest?.public_ip_attached) {
        try {
          await runJsonCommand<DbaasNetworkDetachJson>(
            [
              'dbaas',
              'network',
              'detach-public-ip',
              String(dbaasToDelete),
              '--force'
            ],
            context.dbaasEnv
          );
        } catch {
          // Ignore detach errors
        }
      }

      // Delete DBaaS
      await runJsonCommand<DbaasDeleteJson>(
        ['dbaas', 'delete', String(dbaasToDelete), '--force'],
        context.dbaasEnv
      );
    } catch {
      // Ignore cleanup errors - we tried
    }
  }

  // Cleanup VPC if exists and not deleted
  if (vpcToDelete && !manifest?.vpc_deleted) {
    try {
      await runJsonCommand<VpcDeleteJson>(
        ['vpc', 'delete', String(vpcToDelete), '--force'],
        context.dbaasEnv
      );
    } catch {
      // Ignore cleanup errors - we tried
    }
  }

  // Clean up manifest file
  try {
    await rm(context.manifestPath);
  } catch {
    // Ignore
  }

  return { exitCode: 0, stdout: '', stderr: '' };
}

async function runJsonCommand<T>(
  args: string[],
  dbaasEnv: DbaasManualEnv
): Promise<T> {
  const result = await runBuiltCli(['--json', ...args], {
    env: dbaasEnv.cliEnv,
    timeoutMs: MANUAL_DESTRUCTIVE_COMMAND_TIMEOUT_MS
  });

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Command failed: e2ectl ${args.join(' ')}`,
        result.stderr.trim().length === 0
          ? 'STDERR: <empty>'
          : `STDERR: ${result.stderr.trim()}`,
        result.stdout.trim().length === 0
          ? 'STDOUT: <empty>'
          : `STDOUT: ${result.stdout.trim()}`
      ].join('\n')
    );
  }

  return parseJsonCommandResult<T>(args, result.stdout);
}

function parseJsonCommandResult<T>(args: string[], stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (error: unknown) {
    throw new Error(
      `Command returned invalid JSON for e2ectl ${args.join(' ')}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function updateManifest(
  context: DbaasTestContext,
  mutate: (manifest: DbaasSmokeManifest) => void
): Promise<void> {
  const content = await readFile(context.manifestPath, 'utf8');
  const manifest = JSON.parse(content) as DbaasSmokeManifest;
  mutate(manifest);
  await writeFile(
    context.manifestPath,
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
