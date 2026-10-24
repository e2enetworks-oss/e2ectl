import { runCli } from '../../../src/app/index.js';
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
  secretPrompts: string[];
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
  const secretPrompts: string[] = [];
  const stdout = new MemoryWriter();
  const validate = vi.fn(() => Promise.resolve({ valid: setup.valid ?? true }));
  const runtime: CliRuntime = createTestRuntime({
    createProjectClient: () => MYACCOUNT_PROJECTS,
    createTirAccountClient: () => TIR_ACCOUNTS,
    createTirProjectClient: () => TIR_PROJECTS,
    credentialValidator: { validate },
    isInteractive: setup.answers !== undefined || setup.secrets !== undefined,
    prompt: () => Promise.resolve(answers.shift() ?? ''),
    promptSecret: (message) => {
      secretPrompts.push(message);
      return Promise.resolve(secrets.shift() ?? '');
    },
    stdout,
    store
  });

  await createProgram(runtime).parseAsync(['node', 'e2ectl', ...args]);

  return {
    config: await store.read(),
    output: stdout.buffer,
    secretPrompts,
    validate
  };
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

  it('asks again instead of dropping a mistyped platform', async () => {
    const { config, output } = await configure(['configure'], {
      answers: ['1,myacount', '2', '', 'Delhi'],
      secrets: ['k', 't']
    });

    expect(output).toContain('Not a choice: myacount.');
    expect(config.profiles.default?.default_project_id).toBe('46');
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

  it('says whether Enter keeps the saved key or uses the environment', async () => {
    const saved = await configure(['configure', '--alias', 'work'], {
      answers: ['2', '', 'Delhi'],
      savedProfile: true,
      secrets: ['', '']
    });
    vi.stubEnv('E2E_API_KEY', 'env-key');
    const fromEnv = await configure(['configure'], {
      answers: ['2', '', 'Delhi'],
      savedProfile: true,
      secrets: ['', 't']
    });

    expect(saved.secretPrompts[0]).toBe(
      'API key (press Enter to keep the saved one): '
    );
    expect(fromEnv.secretPrompts[0]).toBe(
      'API key (press Enter to use E2E_API_KEY): '
    );
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

  it('sets up both platforms in one command from their flags', async () => {
    const { config, output } = await configure([
      '--json',
      'configure',
      '--tir-account-id',
      '11',
      '--tir-project-id',
      '33',
      '--tir-location',
      'Chennai',
      '--myaccount-project-id',
      '46',
      '--myaccount-location',
      'delhi'
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
        },
        {
          account: null,
          location: 'Delhi',
          platform: 'myaccount',
          project: { id: 46, name: 'main' }
        }
      ]
    });
    expect(config.profiles.default).toMatchObject({
      api_key: 'env-key',
      auth_token: 'env-token',
      default_location: 'Delhi',
      default_project_id: '46',
      tir: { account_id: '11', location: 'Chennai', project_id: '33' }
    });
  });

  it('sets up only the platform whose flags are given', async () => {
    const { config } = await configure([
      'configure',
      '--myaccount-project-id',
      '46',
      '--myaccount-location',
      'Delhi'
    ]);

    expect(config.profiles.default?.default_project_id).toBe('46');
    expect(config.profiles.default?.tir).toBeUndefined();
  });

  it('keeps the saved key of a profile named with --alias over the environment', async () => {
    const flags = [
      '--myaccount-project-id',
      '46',
      '--myaccount-location',
      'Delhi'
    ];

    const named = await configure(['configure', '--alias', 'work', ...flags], {
      savedProfile: true
    });
    const unnamed = await configure(['configure', ...flags], {
      savedProfile: true
    });

    expect(named.config.profiles.work?.api_key).toBe('saved-key');
    expect(unnamed.config.profiles.work?.api_key).toBe('env-key');
  });

  it.each(['', '  ', '__proto__', 'constructor'])(
    'refuses the profile name "%s"',
    async (alias) => {
      const error = await configureError([
        'configure',
        '--alias',
        alias,
        '--platform',
        'tir'
      ]);

      expect(error.code).toBe('INVALID_ALIAS');
    }
  );

  it('asks for a platform, naming both ways to choose one', async () => {
    const error = await configureError(['configure']);

    expect(error.message).toBe('Choose at least one platform.');
    expect(error.suggestion).toContain('--platform tir');
    expect(error.suggestion).toContain('--tir-project-id');
  });

  it('lists every missing flag, spelled for e2ectl configure', async () => {
    const error = await configureError(['configure', '--tir-account-id', '11']);

    expect(error.message).toBe('No TIR project and location given.');
    expect(error.suggestion).toContain('--tir-project-id <id>');
    expect(error.suggestion).toContain('--tir-location Delhi|Chennai');
  });

  it.each([['gcp'], ['1'], ['toString']])(
    'refuses --platform %s as a usage error',
    async (platform) => {
      const stderr = new MemoryWriter();
      const runtime = createTestRuntime({
        store: new ConfigStore({
          configPath: createTestConfigPath('configure-platform')
        })
      });

      const exitCode = await runCli(
        ['node', 'e2ectl', 'configure', '--platform', platform],
        runtime,
        stderr
      );

      expect(exitCode).toBe(2);
      expect(stderr.buffer).toContain('Allowed choices are tir, myaccount');
    }
  );

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
      '--tir-account-id',
      '99',
      '--tir-project-id',
      '33',
      '--tir-location',
      'Delhi'
    ]);

    expect(error.message).toBe('TIR account 99 is not one your key can use.');
  });
});
