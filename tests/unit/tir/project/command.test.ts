import { createProgram } from '../../../../src/app/program.js';
import type { ProfileConfig } from '../../../../src/config/index.js';
import { ConfigStore } from '../../../../src/config/store.js';
import { CliError } from '../../../../src/core/errors.js';
import type { TirAccountClient } from '../../../../src/tir/account/index.js';
import type { TirProjectClient } from '../../../../src/tir/project/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

interface Harness {
  listProjects: TirProjectClient['listProjects'];
  output: string;
  store: ConfigStore;
}

async function runTir(
  args: string[],
  profile: Partial<ProfileConfig> = {},
  withProfile = true,
  store = new ConfigStore({
    configPath: createTestConfigPath('tir-project-command-test')
  })
): Promise<Harness> {
  if (withProfile) {
    await store.upsertProfile('work', {
      api_key: 'key',
      auth_token: 'token',
      ...profile
    });
  }
  const stdout = new MemoryWriter();
  const accountClient: TirAccountClient = {
    listAccounts: vi.fn(() =>
      Promise.resolve([
        {
          has_tir_access: true,
          id: 11,
          owner: { email: 'owner@example.com', name: 'Owner' },
          role: 'Owner'
        },
        { has_tir_access: false, id: 22, role: 'Member' }
      ])
    )
  };
  const listProjects = vi.fn(() =>
    Promise.resolve([
      {
        created_at: '2026-01-02T03:04:05Z',
        project_id: 33,
        project_name: 'research'
      }
    ])
  );
  const projectClient: TirProjectClient = { listProjects };
  const program = createProgram(
    createTestRuntime({
      createTirAccountClient: () => accountClient,
      createTirProjectClient: () => projectClient,
      stdout,
      store
    })
  );

  await program.parseAsync(['node', 'e2ectl', ...args]);

  return { listProjects, output: stdout.buffer, store };
}

async function captureError(
  args: string[],
  profile: Partial<ProfileConfig> = {},
  withProfile = true
): Promise<CliError> {
  try {
    await runTir(args, profile, withProfile);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(CliError);
    return error as CliError;
  }

  throw new Error('Expected a CliError.');
}

describe('tir project list', () => {
  it('lists the projects of the account passed with --account-id', async () => {
    const { output, listProjects } = await runTir([
      'tir',
      'project',
      'list',
      '--account-id',
      '11'
    ]);

    expect(listProjects).toHaveBeenCalledWith('11');
    expect(output).toContain('research');
    expect(output).toContain('tir configure --account 11 --project <id>');
  });

  it('uses the saved TIR account and emits JSON', async () => {
    const { output } = await runTir(['--json', 'tir', 'project', 'list'], {
      tir: { account_id: '11' }
    });

    expect(JSON.parse(output)).toEqual({
      account_id: 11,
      action: 'list',
      items: [{ created_at: '2026-01-02T03:04:05Z', id: 33, name: 'research' }]
    });
  });

  it('says to run tir account list when no account is chosen', async () => {
    const error = await captureError(['tir', 'project', 'list']);

    expect(error.code).toBe('MISSING_TIR_ACCOUNT');
    expect(error.suggestion).toContain('tir account list');
  });
});

describe('tir configure', () => {
  const flags = ['--account', '11', '--project', '33', '--location', 'Chennai'];

  it('checks the values against TIR and saves them in the default profile', async () => {
    const { output, store } = await runTir(['tir', 'configure', ...flags], {
      default_location: 'Delhi',
      default_project_id: '5'
    });

    expect(output).toBe(
      'TIR context saved for profile "work": account 11 (owner@example.com), project 33 (research), Chennai.\n'
    );
    const saved = (await store.read()).profiles.work;
    expect(saved?.tir).toEqual({
      account_id: '11',
      location: 'Chennai',
      project_id: '33'
    });
    expect(saved?.default_project_id).toBe('5');
  });

  it('emits the shared --json shape', async () => {
    const { output } = await runTir([
      '--json',
      'tir',
      'configure',
      ...flags,
      '--alias',
      'work'
    ]);

    expect(JSON.parse(output)).toEqual({
      account: { email: 'owner@example.com', id: 11, name: 'Owner' },
      action: 'configure',
      alias: 'work',
      location: 'Chennai',
      platform: 'tir',
      project: { id: 33, name: 'research' }
    });
  });

  it('names the flag to add without a terminal', async () => {
    const error = await captureError(['tir', 'configure', '--account', '11']);

    expect(error.message).toBe('No TIR project given.');
    expect(error.suggestion).toContain('--project <id>');
  });

  it('refuses a project outside the account', async () => {
    const error = await captureError([
      'tir',
      'configure',
      '--account',
      '11',
      '--project',
      '44',
      '--location',
      'Delhi'
    ]);

    expect(error.message).toBe('TIR project 44 was not found in account 11.');
  });

  it('refuses to save when there is no profile', async () => {
    const error = await captureError(['tir', 'configure', ...flags], {}, false);

    expect(error.code).toBe('PROFILE_NOT_FOUND');
    expect(error.suggestion).toContain('e2ectl configure');
  });
});
