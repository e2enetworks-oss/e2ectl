import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runBuiltCli } from '../../helpers/process.js';
import {
  buildDbaasCreatePasswordCommand,
  buildDbaasResetPasswordCommand,
  redactCliArgs,
  runDbaasDestructiveCleanup,
  runDbaasJsonCommand
} from '../../manual/helpers/dbaas-destructive.js';
import type { DbaasManualEnv } from '../../manual/helpers/dbaas-env.js';
import {
  createEmptyDbaasManifest,
  type DbaasSmokeManifest
} from '../../manual/helpers/dbaas-helpers.js';

vi.mock('../../helpers/process.js', () => ({
  runBuiltCli: vi.fn()
}));

const runBuiltCliMock = vi.mocked(runBuiltCli);

describe('manual DBaaS destructive helpers', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    runBuiltCliMock.mockReset();
  });

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
    );
  });

  it('builds create and reset commands that pass passwords through stdin', () => {
    const createPassword = 'CreatePassword123!@#';
    const resetPassword = 'ResetPassword123!@#';

    const createCommand = buildDbaasCreatePasswordCommand({
      databaseName: 'appdb',
      name: 'manual-db',
      password: createPassword,
      plan: 'DBS.16GB',
      type: 'sql',
      version: '8.0',
      vpcId: 1234
    });
    const resetCommand = buildDbaasResetPasswordCommand({
      dbaasId: 7869,
      password: resetPassword
    });

    expect(createCommand.args).toContain('--password-file');
    expect(createCommand.args).toContain('-');
    expect(createCommand.args).not.toContain('--password');
    expect(createCommand.args).not.toContain(createPassword);
    expect(createCommand.stdin).toBe(`${createPassword}\n`);

    expect(resetCommand.args).toEqual([
      'dbaas',
      'reset-password',
      '7869',
      '--password-file',
      '-'
    ]);
    expect(resetCommand.args).not.toContain(resetPassword);
    expect(resetCommand.stdin).toBe(`${resetPassword}\n`);
  });

  it('redacts secret-bearing command args and output on failures', async () => {
    const password = 'InlinePassword123!@#';
    runBuiltCliMock.mockResolvedValue({
      exitCode: 1,
      stderr: `backend rejected ${password}`,
      stdout: `raw output ${password}`
    });

    await expect(
      runDbaasJsonCommand(
        ['dbaas', 'create', '--password', password],
        createManualEnv(),
        { sensitiveValues: [password] }
      )
    ).rejects.toThrow(
      [
        'Command failed: e2ectl dbaas create --password <redacted>',
        'STDERR: backend rejected <redacted>',
        'STDOUT: raw output <redacted>'
      ].join('\n')
    );

    expect(
      redactCliArgs(['dbaas', 'create', `--password=${password}`])
    ).toEqual(['dbaas', 'create', '--password=<redacted>']);
  });

  it('preserves the manifest and fails cleanup when DBaaS delete fails', async () => {
    const manifestPath = await writeManifest(tempDirs, {
      dbaas_id: 7869,
      dbaas_name: 'manual-db',
      dbaas_deleted: false
    });
    const runJsonCommand = vi.fn((args: string[]) => {
      if (args[0] === 'dbaas' && args[1] === 'delete') {
        return Promise.reject(new Error('delete failed'));
      }

      return Promise.resolve({});
    });

    const result = await runDbaasDestructiveCleanup(
      { dbaasEnv: createManualEnv(), manifestPath },
      undefined,
      undefined,
      { runJsonCommand }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Preserved DBaaS cleanup manifest');
    expect(result.stderr).toContain('Failed to delete DBaaS 7869');
    await expect(access(manifestPath)).resolves.toBeUndefined();
  });

  it('preserves the manifest and fails cleanup when VPC delete fails', async () => {
    const manifestPath = await writeManifest(tempDirs, {
      dbaas_deleted: true,
      dbaas_id: null,
      vpc_deleted: false,
      vpc_id: 9876
    });
    const runJsonCommand = vi.fn((args: string[]) => {
      if (args[0] === 'vpc' && args[1] === 'delete') {
        return Promise.reject(new Error('vpc is still in use'));
      }

      return Promise.resolve({});
    });

    const result = await runDbaasDestructiveCleanup(
      { dbaasEnv: createManualEnv(), manifestPath },
      undefined,
      undefined,
      { runJsonCommand }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Failed to delete VPC 9876');
    await expect(access(manifestPath)).resolves.toBeUndefined();
  });

  it('detaches VPC without detaching public IP when both are attached', async () => {
    const manifestPath = await writeManifest(tempDirs, {
      dbaas_id: 7869,
      dbaas_name: 'manual-db',
      dbaas_deleted: false,
      public_ip_attached: true,
      vpc_attached: true,
      vpc_deleted: false,
      vpc_id: 9876
    });
    const runJsonCommand = vi.fn((args: string[]) => Promise.resolve({ args }));

    const result = await runDbaasDestructiveCleanup(
      { dbaasEnv: createManualEnv(), manifestPath },
      undefined,
      undefined,
      { runJsonCommand }
    );

    expect(result.exitCode).toBe(0);
    expect(runJsonCommand.mock.calls.map(([args]) => args)).toEqual([
      ['dbaas', 'network', 'vpc', 'detach', '7869', '--vpc-id', '9876'],
      ['dbaas', 'delete', '7869', '--force'],
      ['vpc', 'delete', '9876', '--force']
    ]);
  });

  it('skips VPC detach when the public IP is already detached', async () => {
    const manifestPath = await writeManifest(tempDirs, {
      dbaas_id: 7869,
      dbaas_name: 'manual-db',
      dbaas_deleted: false,
      public_ip_attached: false,
      vpc_attached: true,
      vpc_deleted: false,
      vpc_id: 9876
    });
    const runJsonCommand = vi.fn((args: string[]) => Promise.resolve({ args }));

    const result = await runDbaasDestructiveCleanup(
      { dbaasEnv: createManualEnv(), manifestPath },
      undefined,
      undefined,
      { runJsonCommand }
    );

    expect(result.exitCode).toBe(0);
    expect(runJsonCommand.mock.calls.map(([args]) => args)).toEqual([
      ['dbaas', 'delete', '7869', '--force'],
      ['vpc', 'delete', '9876', '--force']
    ]);
  });

  it('removes the manifest only after cleanup succeeds', async () => {
    const manifestPath = await writeManifest(tempDirs, {
      dbaas_id: 7869,
      dbaas_name: 'manual-db',
      dbaas_deleted: false,
      vpc_deleted: false,
      vpc_id: 9876
    });
    const runJsonCommand = vi.fn((args: string[]) => Promise.resolve({ args }));

    const result = await runDbaasDestructiveCleanup(
      { dbaasEnv: createManualEnv(), manifestPath },
      undefined,
      undefined,
      { runJsonCommand }
    );

    expect(result).toEqual({ exitCode: 0, stderr: '', stdout: '' });
    expect(runJsonCommand.mock.calls.map(([args]) => args)).toEqual([
      ['dbaas', 'delete', '7869', '--force'],
      ['vpc', 'delete', '9876', '--force']
    ]);
    await expect(access(manifestPath)).rejects.toThrow();
  });
});

function createManualEnv(): DbaasManualEnv {
  return {
    apiKey: 'api-key',
    authToken: 'auth-token',
    cliEnv: {
      E2E_API_KEY: 'api-key',
      E2E_AUTH_TOKEN: 'auth-token',
      E2E_LOCATION: 'Delhi',
      E2E_PROJECT_ID: '123'
    },
    location: 'Delhi',
    prefix: 'manual-dbaas',
    projectId: '123'
  };
}

async function writeManifest(
  tempDirs: string[],
  overrides: Partial<DbaasSmokeManifest>
): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'e2ectl-dbaas-'));
  tempDirs.push(tempDir);
  const manifestPath = path.join(tempDir, 'manifest.json');
  const manifest = {
    ...createEmptyDbaasManifest(),
    ...overrides
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return manifestPath;
}
