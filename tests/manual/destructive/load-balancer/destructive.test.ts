import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runBuiltCli } from '../../../helpers/process.js';
import {
  readRequiredEnvValues,
  REQUIRED_MANUAL_BASE_ENV_VARS,
  toManualCliEnv,
  normalizeOptionalEnvValue
} from '../../helpers/manual-env.js';

const runManualSuite = process.env.E2ECTL_RUN_MANUAL_E2E === '1';
const describeManual = runManualSuite ? describe : describe.skip;

const MANUAL_DESTRUCTIVE_TEST_TIMEOUT_MS = 40 * 60 * 1000;
const MANUAL_LB_GET_TIMEOUT_MS = 60 * 1000;

interface LbManualEnv {
  apiKey: string;
  authToken: string;
  cliEnv: NodeJS.ProcessEnv;
  location: string;
  prefix: string;
  projectId: string;
}

interface LbConfig {
  plan: string;
  backendGroupName: string;
  backendServer: string;
  vpcId?: string;
}

interface LbTestContext {
  manifestPath: string;
  lbEnv: LbManualEnv;
}

interface LbCreateJson {
  action: string;
  result: {
    appliance_id: number;
    id: number;
  };
  requested: {
    name: string;
    plan_name: string;
    mode: string;
    type: string;
  };
}

interface LbGetJson {
  action: string;
  item: {
    id: number;
    lb_mode: string;
    status: string;
    public_ip: string;
    context: Array<{
      vpc_list: Array<{
        network_id: string;
        vpc_name: string;
      }>;
      backends: Array<{
        name: string;
        servers: Array<{
          backend_name: string;
          backend_ip: string;
          backend_port: number;
        }>;
      }>;
      tcp_backend: Array<unknown>;
      plan_name: string;
      node_list_type: string;
      lb_port: string;
    }>;
    lb_status: {
      status: string;
    };
  };
}

interface LbAttachVpcJson {
  action: string;
  lb_id: string;
  message: string;
}

interface LbDetachVpcJson {
  action: string;
  lb_id: string;
  message: string;
}

interface LbBackendGroupAddJson {
  action: string;
  lb_id: string;
  group: {
    name: string;
    servers: Array<{
      backend_name: string;
      backend_ip: string;
      backend_port: number;
    }>;
  };
  message: string;
}

interface LbBackendGroupListJson {
  action: string;
  lb_id: string;
  backends: Array<{ name: string }>;
}

interface LbBackendGroupUpdateJson {
  action: string;
  lb_id: string;
  group_name: string;
  message: string;
}

interface LbBackendGroupRemoveJson {
  action: string;
  lb_id: string;
  group_name: string;
  message: string;
}

interface LbBackendServerAddJson {
  action: string;
  lb_id: string;
  server_name: string;
  group_name: string;
  message: string;
}

interface LbBackendServerRemoveJson {
  action: string;
  lb_id: string;
  group_name: string;
  server_name: string;
  message: string;
}

interface LbUpdateJson {
  action: string;
  lb_id: string;
  message: string;
}

interface LbReserveIpJson {
  action: string;
  lb_id: string;
  message: string;
}

interface LbDeleteJson {
  action: string;
  lb_id: string;
  message: string;
  cancelled: boolean;
}

interface VpcListJson {
  action: string;
  items: Array<{
    id: number;
    name: string;
    state: string;
  }>;
}

interface LbSmokeManifest {
  lb_id: number | null;
  lb_name: string | null;
  vpc_id: number | null;
  vpc_created: boolean;
  lb_deleted: boolean;
  vpc_deleted: boolean;
}

function readLbConfig(): LbConfig {
  const plan = process.env.E2ECTL_LB_PLAN ?? 'E2E-LB-2';
  const backendGroupName = process.env.E2ECTL_LB_BACKEND_GROUP_NAME ?? 'web';
  const backendServer = process.env.E2ECTL_LB_BACKEND_SERVER;

  if (!backendServer) {
    throw new Error(
      'E2ECTL_LB_BACKEND_SERVER is required. Format: name:ip:port (e.g. srv-1:10.0.0.1:8080)'
    );
  }

  const vpcId = normalizeOptionalEnvValue(process.env.E2ECTL_LB_VPC_ID);

  return {
    plan,
    backendGroupName,
    backendServer,
    ...(vpcId ? { vpcId } : {})
  };
}

function readLbManualEnv(env: NodeJS.ProcessEnv = process.env): LbManualEnv {
  const requiredValues = readRequiredEnvValues({
    env,
    purpose: 'Manual LB destructive',
    requiredVars: REQUIRED_MANUAL_BASE_ENV_VARS
  });

  const apiKey = requiredValues.E2E_API_KEY!;
  const authToken = requiredValues.E2E_AUTH_TOKEN!;
  const projectId = requiredValues.E2E_PROJECT_ID!;
  const location = requiredValues.E2E_LOCATION!;
  const prefix = normalizeOptionalEnvValue(env.E2ECTL_LB_PREFIX) ?? 'manual-lb';

  return {
    apiKey,
    authToken,
    cliEnv: toManualCliEnv(requiredValues, env),
    location,
    prefix,
    projectId
  };
}

function createEmptyLbManifest(): LbSmokeManifest {
  return {
    lb_id: null,
    lb_name: null,
    vpc_id: null,
    vpc_created: false,
    lb_deleted: false,
    vpc_deleted: false
  };
}

describeManual('manual LB destructive built CLI checks', () => {
  beforeAll(async () => {
    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'exercises full load balancer lifecycle through the built CLI',
    { timeout: MANUAL_DESTRUCTIVE_TEST_TIMEOUT_MS },
    async () => {
      const lbConfig = readLbConfig();
      const manualEnv = readLbManualEnv();
      const runPrefix = `${manualEnv.prefix}-${Date.now().toString(36)}`;
      const context = await prepareLbContext(runPrefix);
      let lbId: number | undefined;
      let vpcIdToUse: string | undefined;
      let cleanupError: Error | undefined;
      let workflowError: unknown;

      try {
        // 1. Resolve VPC ID
        vpcIdToUse =
          lbConfig.vpcId ?? (await findAvailableVpc(context));

        // 2. Create load balancer
        const lbResult = await createLbStep(context, {
          name: `${runPrefix}-lb`,
          plan: lbConfig.plan,
          backendGroupName: lbConfig.backendGroupName,
          backendServer: lbConfig.backendServer
        });
        lbId = lbResult.lbId;

        // 3. Wait for LB to be running
        await waitForLbRunningStep(context, lbId);

        // 4. Get LB details
        await getLbStep(context, lbId);

        // 5. Update LB name
        await updateLbStep(context, lbId, {
          name: `${runPrefix}-lb-v2`
        });

        // 6. VPC attach
        if (vpcIdToUse) {
          await attachVpcStep(context, lbId, vpcIdToUse);
          await getLbVerifyVpcAttachedStep(context, lbId, vpcIdToUse);
        }

        // 7. VPC detach
        if (vpcIdToUse) {
          await detachVpcStep(context, lbId, vpcIdToUse);
        }

        // 8. Add a second backend group
        await addBackendGroupStep(context, lbId, {
          name: `${runPrefix}-grp`,
          server: lbConfig.backendServer.replace(/^[^:]+/, 'srv-extra')
        });

        // 9. List backend groups
        await listBackendGroupsStep(context, lbId);

        // 10. Update backend group (rename)
        await updateBackendGroupStep(context, lbId, {
          oldName: `${runPrefix}-grp`,
          newName: `${runPrefix}-grp-v2`
        });

        // 11. Add a backend server to the extra group
        await addBackendServerStep(context, lbId, {
          groupName: `${runPrefix}-grp-v2`,
          server: lbConfig.backendServer.replace(/^[^:]+/, 'srv-extra-2')
        });

        // 12. Remove a backend server
        await removeBackendServerStep(context, lbId, {
          groupName: `${runPrefix}-grp-v2`,
          serverName: 'srv-extra-2'
        });

        // 13. Remove the extra backend group
        await removeBackendGroupStep(context, lbId, `${runPrefix}-grp-v2`);

        // 14. Reserve IP
        await reserveIpStep(context, lbId);

        // 15. Delete load balancer
        await deleteLbStep(context, lbId);
        lbId = undefined;
      } catch (error: unknown) {
        workflowError = error;
        console.error(`LB test manifest: ${context.manifestPath}`);
        if (lbId) console.error(`LB ID for manual cleanup: ${lbId}`);
      } finally {
        const cleanupResult = await runLbCleanup(context, lbId);
        if (cleanupResult.exitCode !== 0) {
          console.error(`LB test manifest: ${context.manifestPath}`);
          console.error(cleanupResult.stdout);
          console.error(cleanupResult.stderr);
          if (workflowError === undefined) {
            cleanupError = new Error(
              `LB cleanup failed for manifest ${context.manifestPath}.`
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

async function prepareLbContext(
  runPrefix: string
): Promise<LbTestContext> {
  const manifestDir = path.resolve(process.cwd(), '.manual-lb');
  await mkdir(manifestDir, { recursive: true });

  const manifestPath = path.join(manifestDir, `${runPrefix}-manifest.json`);
  const manifest = createEmptyLbManifest();
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    manifestPath,
    lbEnv: readLbManualEnv()
  };
}

async function findAvailableVpc(context: LbTestContext): Promise<string | undefined> {
  const vpcList = await runJsonCommand<VpcListJson>(
    ['vpc', 'list'],
    context.lbEnv
  );

  const activeVpc = vpcList.items.find((v) => v.state === 'Active');
  if (activeVpc) {
    return String(activeVpc.id);
  }

  return undefined;
}

async function createLbStep(
  context: LbTestContext,
  options: {
    name: string;
    plan: string;
    backendGroupName: string;
    backendServer: string;
  }
): Promise<{ lbId: number }> {
  const lbCreate = await runJsonCommand<LbCreateJson>(
    [
      'lb',
      'create',
      '--name',
      options.name,
      '--plan',
      options.plan,
      '--frontend-protocol',
      'HTTP',
      '--billing-type',
      'hourly',
      '--backend-group-name',
      options.backendGroupName,
      '--backend-group-server',
      options.backendServer
    ],
    context.lbEnv
  );

  const lbId = lbCreate.result.id;

  if (!Number.isInteger(lbId)) {
    throw new Error('Expected lb create to return a valid LB id.');
  }

  await updateManifest(context, (manifest) => {
    manifest.lb_id = lbId;
    manifest.lb_name = options.name;
  });

  return { lbId };
}

async function waitForLbRunningStep(
  context: LbTestContext,
  lbId: number,
  timeoutMs: number = 15 * 60 * 1000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const lbGet = await runJsonCommand<LbGetJson>(
        ['lb', 'get', String(lbId)],
        context.lbEnv
      );

      const status = lbGet.item.lb_status?.status ?? lbGet.item.status;
      if (status === 'RUNNING') {
        return;
      }
    } catch {
      // Retry on errors
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  throw new Error(`Timed out waiting for LB ${lbId} to become RUNNING`);
}

async function getLbStep(
  context: LbTestContext,
  lbId: number
): Promise<void> {
  const lbGet = await runJsonCommand<LbGetJson>(
    ['lb', 'get', String(lbId)],
    context.lbEnv
  );

  if (lbGet.item.id !== lbId) {
    throw new Error('Expected lb get to return the created LB.');
  }
}

async function updateLbStep(
  context: LbTestContext,
  lbId: number,
  options: {
    name: string;
  }
): Promise<void> {
  const lbUpdate = await runJsonCommand<LbUpdateJson>(
    ['lb', 'update', String(lbId), '--name', options.name],
    context.lbEnv
  );

  if (lbUpdate.lb_id !== String(lbId)) {
    throw new Error('Expected update to target the correct LB.');
  }

  await updateManifest(context, (manifest) => {
    manifest.lb_name = options.name;
  });
}

async function attachVpcStep(
  context: LbTestContext,
  lbId: number,
  vpcId: string
): Promise<void> {
  const result = await runJsonCommand<LbAttachVpcJson>(
    ['lb', 'network', 'vpc', 'attach', String(lbId), '--vpc-id', vpcId],
    context.lbEnv
  );

  if (result.action !== 'network-vpc-attach') {
    throw new Error('Expected VPC attach to succeed.');
  }
}

async function getLbVerifyVpcAttachedStep(
  context: LbTestContext,
  lbId: number,
  vpcId: string
): Promise<void> {
  const lbGet = await runJsonCommand<LbGetJson>(
    ['lb', 'get', String(lbId)],
    context.lbEnv
  );

  const vpcList = lbGet.item.context?.[0]?.vpc_list ?? [];
  const found = vpcList.some((v) => String(v.network_id) === vpcId);

  if (!found) {
    throw new Error(`Expected VPC ${vpcId} to be attached to LB ${lbId}`);
  }
}

async function detachVpcStep(
  context: LbTestContext,
  lbId: number,
  vpcId: string
): Promise<void> {
  const result = await runJsonCommand<LbDetachVpcJson>(
    ['lb', 'network', 'vpc', 'detach', String(lbId), '--vpc-id', vpcId],
    context.lbEnv
  );

  if (result.action !== 'network-vpc-detach') {
    throw new Error('Expected VPC detach to succeed.');
  }
}

async function addBackendGroupStep(
  context: LbTestContext,
  lbId: number,
  options: {
    name: string;
    server: string;
  }
): Promise<void> {
  const result = await runJsonCommand<LbBackendGroupAddJson>(
    [
      'lb',
      'backend',
      'group',
      'add',
      String(lbId),
      '--backend-group-name',
      options.name,
      '--backend-group-server',
      options.server
    ],
    context.lbEnv
  );

  if (result.action !== 'backend-group-add') {
    throw new Error('Expected backend group add to succeed.');
  }
}

async function listBackendGroupsStep(
  context: LbTestContext,
  lbId: number
): Promise<void> {
  const result = await runJsonCommand<LbBackendGroupListJson>(
    ['lb', 'backend', 'group', 'list', String(lbId)],
    context.lbEnv
  );

  if (result.action !== 'backend-group-list') {
    throw new Error('Expected backend group list to succeed.');
  }

  expect(Array.isArray(result.backends)).toBe(true);
}

async function updateBackendGroupStep(
  context: LbTestContext,
  lbId: number,
  options: {
    oldName: string;
    newName: string;
  }
): Promise<void> {
  const result = await runJsonCommand<LbBackendGroupUpdateJson>(
    [
      'lb',
      'backend',
      'group',
      'update',
      String(lbId),
      options.oldName,
      '--backend-group-name',
      options.newName
    ],
    context.lbEnv
  );

  if (result.action !== 'backend-group-update') {
    throw new Error('Expected backend group update to succeed.');
  }
}

async function addBackendServerStep(
  context: LbTestContext,
  lbId: number,
  options: {
    groupName: string;
    server: string;
  }
): Promise<void> {
  const result = await runJsonCommand<LbBackendServerAddJson>(
    [
      'lb',
      'backend',
      'server',
      'add',
      String(lbId),
      '--backend-group-name',
      options.groupName,
      '--backend-group-server',
      options.server
    ],
    context.lbEnv
  );

  if (result.action !== 'backend-server-add') {
    throw new Error('Expected backend server add to succeed.');
  }
}

async function removeBackendServerStep(
  context: LbTestContext,
  lbId: number,
  options: {
    groupName: string;
    serverName: string;
  }
): Promise<void> {
  const result = await runJsonCommand<LbBackendServerRemoveJson>(
    [
      'lb',
      'backend',
      'server',
      'remove',
      String(lbId),
      '--backend-group-name',
      options.groupName,
      '--backend-group-server-name',
      options.serverName
    ],
    context.lbEnv
  );

  if (result.action !== 'backend-server-remove') {
    throw new Error('Expected backend server remove to succeed.');
  }
}

async function removeBackendGroupStep(
  context: LbTestContext,
  lbId: number,
  groupName: string
): Promise<void> {
  const result = await runJsonCommand<LbBackendGroupRemoveJson>(
    ['lb', 'backend', 'group', 'remove', String(lbId), groupName],
    context.lbEnv
  );

  if (result.action !== 'backend-group-remove') {
    throw new Error('Expected backend group remove to succeed.');
  }
}

async function reserveIpStep(
  context: LbTestContext,
  lbId: number
): Promise<void> {
  const result = await runJsonCommand<LbReserveIpJson>(
    ['lb', 'network', 'reserve-ip', 'reserve', String(lbId)],
    context.lbEnv
  );

  if (result.action !== 'network-reserve-ip-reserve') {
    throw new Error('Expected reserve IP to succeed.');
  }
}

async function deleteLbStep(
  context: LbTestContext,
  lbId: number
): Promise<void> {
  const result = await runJsonCommand<LbDeleteJson>(
    ['lb', 'delete', String(lbId), '--force'],
    context.lbEnv
  );

  if (result.cancelled) {
    throw new Error('Expected LB delete to succeed.');
  }

  await updateManifest(context, (manifest) => {
    manifest.lb_deleted = true;
    manifest.lb_id = null;
  });
}

async function runLbCleanup(
  context: LbTestContext,
  lbId: number | undefined
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  if (!lbId) {
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  try {
    const result = await runBuiltCli(
      ['lb', 'delete', String(lbId), '--force', '--json'],
      {
        env: context.lbEnv.cliEnv,
        timeoutMs: 5 * 60 * 1000
      }
    );

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error: unknown) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: toError(error).message
    };
  }
}

async function runJsonCommand<T>(
  args: string[],
  lbEnv: LbManualEnv,
  timeoutMs: number = MANUAL_LB_GET_TIMEOUT_MS
): Promise<T> {
  const result = await runBuiltCli(['--json', ...args], {
    env: lbEnv.cliEnv,
    timeoutMs
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

  try {
    return JSON.parse(result.stdout) as T;
  } catch (error: unknown) {
    throw new Error(
      `Command returned invalid JSON for e2ectl ${args.join(' ')}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function updateManifest(
  context: LbTestContext,
  mutate: (manifest: LbSmokeManifest) => void
): Promise<void> {
  const content = await readFile(context.manifestPath, 'utf8');
  const manifest = JSON.parse(content) as LbSmokeManifest;
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
