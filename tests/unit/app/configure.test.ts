import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ConfigFile } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import { CliError } from '../../../src/core/errors.js';
import type { ProjectClient } from '../../../src/myaccount/project/index.js';
import type { TirAccountClient } from '../../../src/tir/account/index.js';
import type { TirProjectClient } from '../../../src/tir/project/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../helpers/runtime.js';

const TIR_ACCOUNTS: TirAccountClient = {
  listAccounts: () =>
    Promise.resolve([
      {
        has_tir_access: true,
        id: 11,
        owner: { email: 'o@example.com', name: 'O' },
        role: 'Owner'
      }
    ])
};
const TIR_PROJECTS: TirProjectClient = {
  listProjects: () =>
    Promise.resolve([{ project_id: 33, project_name: 'research' }])
};
const MYACCOUNT_PROJECTS: ProjectClient = {
  createProject: vi.fn(),
  listProjects: () =>
    Promise.resolve([
      { is_default: true, is_starred: false, name: 'main', project_id: 46 }
    ]),
  starUnstarProject: vi.fn()
};

interface Harness {
  config: ConfigFile;
  output: string;
  validate: ReturnType<typeof vi.fn>;
}

async function configure(
  args: string[],
  setup: {
    answers?: string[];
    secrets?: string[];
    savedProfile?: boolean;
    valid?: boolean;
  } = {}
): Promise<Harness> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('configure')
  });
  if (setup.savedProfile === true) {
    await store.upsertProfile('work', {
      api_key: 'saved-key',
      auth_token: 'saved-token'
    });
  }
  const answers = [...(setup.answers ?? [])];
  const secrets = [...(setup.secrets ?? [])];
  const stdout = new MemoryWriter();
  const validate = vi.fn(() => Promise.resolve({ valid: setup.valid ?? true }));
  const runtime: CliRuntime = createTestRuntime({
    createProjectClient: () => MYACCOUNT_PROJECTS,
    createTirAccountClient: () => TIR_ACCOUNTS,
    createTirProjectClient: () => TIR_PROJECTS,
    credentialValidator: { validate },
    isInteractive: setup.answers !== undefined || setup.secrets !== undefined,
    prompt: () => Promise.resolve(answers.shift() ?? ''),
    promptSecret: () => Promise.resolve(secrets.shift() ?? ''),
    stdout,
    store
  });

  await createProgram(runtime).parseAsync(['node', 'e2ectl', ...args]);

  return { config: await store.read(), output: stdout.buffer, validate };
}

async function configureError(
  args: string[],
  setup: Parameters<typeof configure>[1] = {}
): Promise<CliError> {
  const error = await configure(args, setup).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(CliError);
  return error as CliError;
}

describe('e2ectl configure in a terminal', () => {
  it('saves the key and token, then sets up TIR, picked by default', async () => {
    const { config, output, validate } = await configure(['configure'], {
      answers: ['', '', '', 'Chennai'],
      secrets: ['typed-key', 'typed-token']
    });

    expect(validate).toHaveBeenCalledWith({
      api_key: 'typed-key',
      auth_token: 'typed-token'
    });
    expect(output).toContain('1) TIR (recommended)');
    expect(output).toContain('Saved the key and token in profile "default".');
    expect(output).toContain(
      'TIR context saved for profile "default": account 11'
    );
    expect(config.default).toBe('default');
    expect(config.profiles.default).toMatchObject({
      api_key: 'typed-key',
      auth_token: 'typed-token',
      tir: { account_id: '11', location: 'Chennai', project_id: '33' }
    });
  });

  it('sets up MyAccount only', async () => {
    const { config } = await configure(['configure'], {
      answers: ['2', '', 'Delhi'],
      secrets: ['k', 't']
    });

    expect(config.profiles.default).toMatchObject({
      default_location: 'Delhi',
      default_project_id: '46'
    });
    expect(config.profiles.default?.tir).toBeUndefined();
  });

  it('sets up both platforms, TIR first', async () => {
    const { config, output } = await configure(['configure'], {
      answers: ['1,2', '', '', 'Chennai', '', 'Delhi'],
      secrets: ['k', 't']
    });

    expect(output.indexOf('TIR context saved')).toBeLessThan(
      output.indexOf('MyAccount context saved')
    );
    expect(config.profiles.default).toMatchObject({
      default_location: 'Delhi',
      tir: { location: 'Chennai' }
    });
  });

  it('asks again when no platform is chosen', async () => {
    const { output } = await configure(['configure'], {
      answers: ['none', 'tir', '', '', 'Delhi'],
      secrets: ['k', 't']
    });

    expect(output).toContain(
      'Choose at least one platform. TIR is recommended.'
    );
    expect(output).toContain('TIR context saved');
  });

  it('keeps the saved key and token when Enter is pressed', async () => {
    const { config, validate } = await configure(
      ['configure', '--alias', 'work'],
      {
        answers: ['2', '', 'Delhi'],
        savedProfile: true,
        secrets: ['', '']
      }
    );

    expect(validate).toHaveBeenCalledWith({
      api_key: 'saved-key',
      auth_token: 'saved-token'
    });
    expect(config.profiles.work?.default_project_id).toBe('46');
  });

  it('saves nothing when the API refuses the key and token', async () => {
    const error = await configureError(['configure'], {
      answers: [],
      secrets: ['bad', 'bad'],
      valid: false
    });

    expect(error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('e2ectl configure without a terminal', () => {
  const env = { E2E_API_KEY: 'env-key', E2E_AUTH_TOKEN: 'env-token' };

  beforeEach(() => {
    vi.stubEnv('E2E_API_KEY', env.E2E_API_KEY);
    vi.stubEnv('E2E_AUTH_TOKEN', env.E2E_AUTH_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs from flags alone, with the key and token from the environment', async () => {
    const { config, output } = await configure([
      '--json',
      'configure',
      '--platform',
      'tir',
      '--account',
      '11',
      '--project',
      '33',
      '--location',
      'Chennai'
    ]);

    expect(JSON.parse(output)).toEqual({
      action: 'configure',
      alias: 'default',
      platforms: [
        {
          account: { email: 'o@example.com', id: 11, name: 'O' },
          location: 'Chennai',
          platform: 'tir',
          project: { id: 33, name: 'research' }
        }
      ]
    });
    expect(config.profiles.default).toMatchObject({
      api_key: 'env-key',
      auth_token: 'env-token'
    });
  });

  it('runs MyAccount only from flags', async () => {
    const { config } = await configure([
      'configure',
      '--platform',
      'myaccount',
      '--project',
      '46',
      '--location',
      'Delhi'
    ]);

    expect(config.profiles.default?.default_project_id).toBe('46');
  });

  it('asks for --platform with the exact message', async () => {
    const error = await configureError(['configure']);

    expect(error.message).toBe(
      'Choose at least one platform with --platform tir or --platform myaccount (TIR is recommended).'
    );
  });

  it('names the flag to add for a missing value', async () => {
    const error = await configureError([
      'configure',
      '--platform',
      'tir',
      '--account',
      '11'
    ]);

    expect(error.message).toBe('No TIR project given.');
    expect(error.suggestion).toContain('--project <id>');
  });

  it.each([
    [
      ['--platform', 'tir', '--platform', 'myaccount', '--project', '1'],
      '--project can only be used with one platform.'
    ],
    [
      ['--platform', 'myaccount', '--account', '11'],
      '--account is only for TIR.'
    ],
    [['--platform', 'gcp'], 'Unknown platform "gcp".'],
    [['--platform', '1'], 'Unknown platform "1".']
  ])('refuses %o before saving anything', async (flags, message) => {
    const error = await configureError(['configure', ...flags]);

    expect(error.message).toBe(message);
  });

  it('asks for the key and token by name when none is set', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('E2E_API_KEY', '');
    vi.stubEnv('E2E_AUTH_TOKEN', '');

    const error = await configureError(['configure', '--platform', 'tir']);

    expect(error.message).toBe('No api key given.');
    expect(error.suggestion).toContain('E2E_API_KEY and E2E_AUTH_TOKEN');
  });

  it('checks every TIR value the same way as tir configure', async () => {
    const error = await configureError([
      'configure',
      '--platform',
      'tir',
      '--account',
      '99',
      '--project',
      '33',
      '--location',
      'Delhi'
    ]);

    expect(error.message).toBe('TIR account 99 is not one your key can use.');
  });
});
