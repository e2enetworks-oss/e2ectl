import {
  configurePlatform,
  describePlatformSetup,
  type PlatformSetupResult,
  type PlatformSetupSteps,
  type ProfileConfig,
  type SetupValues
} from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import { CliError } from '../../../src/core/errors.js';
import { createTestConfigPath } from '../../helpers/runtime.js';

// A platform with accounts (like TIR) and one without (like MyAccount),
// built from the same fake data so both go through the same checks.
function steps(withAccounts: boolean): PlatformSetupSteps {
  return {
    envVarNames: {
      ...(withAccounts ? { account: 'FAKE_ACCOUNT' } : {}),
      location: 'FAKE_LOCATION',
      project: 'FAKE_PROJECT'
    },
    listCommands: {
      ...(withAccounts ? { account: 'e2ectl fake account list' } : {}),
      project: 'e2ectl fake project list'
    },
    ...(withAccounts
      ? {
          listAccounts: () =>
            Promise.resolve([
              {
                email: 'owner@example.com',
                id: 11,
                name: 'Owner',
                usable: true
              },
              { email: '', id: 22, name: 'Off', usable: false }
            ])
        }
      : {}),
    listProjects: (accountId) =>
      Promise.resolve(accountId === 22 ? [] : [{ id: 33, name: 'research' }]),
    platform: withAccounts ? 'tir' : 'myaccount',
    readSaved: (profile) => ({
      account: profile.tir?.account_id,
      location: profile.tir?.location,
      project: profile.tir?.project_id
    }),
    toProfilePatch: (context) => ({
      tir: {
        account_id: String(context.accountId ?? ''),
        location: context.location,
        project_id: String(context.projectId)
      }
    })
  };
}

async function storeWith(
  profile: Partial<ProfileConfig> = {}
): Promise<ConfigStore> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('platform-setup')
  });
  await store.upsertProfile('work', {
    api_key: 'k',
    auth_token: 't',
    ...profile
  });
  return store;
}

interface SetupOptions {
  alias?: string;
  answers?: string[];
  flagPrefix?: string;
  store?: ConfigStore;
}

// Runs the shared setup with fake steps; with answers it runs as in a
// terminal, without them as in a script.
async function setup(
  platformSteps: PlatformSetupSteps,
  flags: SetupValues,
  options: SetupOptions = {}
): Promise<{
  prompt: ReturnType<typeof vi.fn>;
  result: PlatformSetupResult;
  store: ConfigStore;
  written: string;
}> {
  const store = options.store ?? (await storeWith());
  const answers = [...(options.answers ?? [])];
  const prompt = vi.fn((message: string) => {
    void message;
    return Promise.resolve(answers.shift() ?? '');
  });
  let written = '';
  const outcome = await configurePlatform(
    {
      alias: options.alias ?? 'work',
      canPrompt: options.answers !== undefined,
      flagPrefix: options.flagPrefix ?? '',
      values: flags
    },
    {
      prompt,
      stdout: {
        write: (text: string) => {
          written += text;
        }
      },
      store
    },
    () => Promise.resolve(platformSteps)
  );

  return { prompt, result: outcome.setup, store, written };
}

const ALL_FLAGS: SetupValues = {
  account: '11',
  location: 'Chennai',
  project: '33'
};

async function capture(promise: Promise<unknown>): Promise<CliError> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(CliError);
  return error as CliError;
}

describe('configurePlatform', () => {
  it('checks flag values and saves them', async () => {
    const { result, store } = await setup(steps(true), ALL_FLAGS);

    expect(result).toEqual({
      account: { email: 'owner@example.com', id: 11, name: 'Owner' },
      location: 'Chennai',
      platform: 'tir',
      project: { id: 33, name: 'research' }
    });
    expect((await store.read()).profiles.work?.tir).toEqual({
      account_id: '11',
      location: 'Chennai',
      project_id: '33'
    });
  });

  it('accepts a location in any case and saves it as written by E2E', async () => {
    const { result } = await setup(steps(true), {
      ...ALL_FLAGS,
      location: 'chennai'
    });

    expect(result.location).toBe('Chennai');
  });

  it('skips the account step for platforms without accounts', async () => {
    const { result } = await setup(steps(false), {
      location: 'Delhi',
      project: '33'
    });

    expect(result.account).toBeNull();
  });

  it('takes a flag over the environment over the saved value', async () => {
    const store = await storeWith({
      tir: { account_id: '11', location: 'Delhi', project_id: '33' }
    });
    vi.stubEnv('FAKE_LOCATION', 'Chennai');

    expect((await setup(steps(true), {}, { store })).result.location).toBe(
      'Chennai'
    );
    expect(
      (await setup(steps(true), { location: 'Delhi' }, { store })).result
        .location
    ).toBe('Delhi');
  });

  it('stops before asking when there are no projects', async () => {
    const error = await capture(
      setup(
        { ...steps(false), listProjects: () => Promise.resolve([]) },
        { location: 'Delhi' },
        { answers: [] }
      )
    );

    expect(error.code).toBe('SETUP_NO_PROJECTS');
    expect(error.message).toBe('There are no MyAccount projects.');
  });

  it('does not use the saved project after switching accounts', async () => {
    const store = await storeWith({
      tir: { account_id: '22', location: 'Delhi', project_id: '44' }
    });

    const error = await capture(
      setup(steps(true), { account: '11' }, { store })
    );

    expect(error.code).toBe('MISSING_SETUP_VALUE');
    expect(error.message).toBe('No TIR project given.');
  });

  it('asks in a terminal, offering the saved value as the default', async () => {
    const { prompt, result, written } = await setup(
      steps(true),
      {},
      {
        answers: ['', '33', 'Delhi'],
        store: await storeWith({ tir: { account_id: '11' } })
      }
    );

    expect(prompt).toHaveBeenNthCalledWith(1, 'TIR account [11]: ');
    expect(prompt).toHaveBeenNthCalledWith(2, 'TIR project [33]: ');
    expect(prompt).toHaveBeenNthCalledWith(3, 'TIR location: ');
    expect(written).toContain('owner@example.com');
    expect(written).toContain('22  Off  (TIR is off)');
    expect(result).toMatchObject({ location: 'Delhi', project: { id: 33 } });
  });

  it('does not ask for a value given as a flag', async () => {
    const { prompt } = await setup(
      steps(true),
      { account: '11', project: '33' },
      { answers: ['Delhi'] }
    );

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      {},
      'No TIR account, project and location given.',
      'Add --account-id <id> (see `e2ectl fake account list`), --project-id <id> (see `e2ectl fake project list`), --location Delhi|Chennai.'
    ],
    [
      { account: '11' },
      'No TIR project and location given.',
      'Add --project-id <id> (see `e2ectl fake project list`), --location Delhi|Chennai.'
    ],
    [
      { account: '11', project: '33' },
      'No TIR location given.',
      'Add --location Delhi|Chennai.'
    ]
  ])(
    'without a terminal, lists every flag to add when %o is given',
    async (flags, message, suggestion) => {
      const error = await capture(setup(steps(true), flags));

      expect(error.message).toBe(message);
      expect(error.suggestion).toBe(suggestion);
    }
  );

  it('names the flags as e2ectl configure spells them', async () => {
    const error = await capture(
      setup(steps(true), { account: '11' }, { flagPrefix: 'tir-' })
    );

    expect(error.suggestion).toContain('--tir-project-id <id>');
    expect(error.suggestion).toContain('--tir-location Delhi|Chennai');
  });

  it('treats an empty answer with no default as missing', async () => {
    const error = await capture(
      setup(steps(false), { project: '33' }, { answers: [] })
    );

    expect(error.code).toBe('MISSING_SETUP_VALUE');
  });

  it.each([
    [
      { ...ALL_FLAGS, account: '99' },
      'SETUP_ACCOUNT_NOT_FOUND',
      'TIR account 99 is not one your key can use.'
    ],
    [
      { ...ALL_FLAGS, account: '22' },
      'SETUP_ACCOUNT_DISABLED',
      'TIR is not turned on for account 22.'
    ],
    [
      { ...ALL_FLAGS, project: '44' },
      'SETUP_PROJECT_NOT_FOUND',
      'TIR project 44 was not found in account 11.'
    ],
    [
      { ...ALL_FLAGS, location: 'Mumbai' },
      'INVALID_LOCATION',
      'Unsupported location "Mumbai".'
    ],
    [
      { ...ALL_FLAGS, account: 'x' },
      'INVALID_ID',
      'TIR account ID must be numeric.'
    ],
    [
      { ...ALL_FLAGS, project: 'x' },
      'INVALID_ID',
      'TIR project ID must be numeric.'
    ]
  ])('refuses %o with %s and saves nothing', async (flags, code, message) => {
    const store = await storeWith();
    const error = await capture(setup(steps(true), flags, { store }));

    expect(error).toMatchObject({ code, message });
    expect(error.suggestion).toBeDefined();
    expect((await store.read()).profiles.work?.tir).toBeUndefined();
  });

  it('checks ids and the location before calling the API', async () => {
    const listAccounts = vi.fn(() => Promise.resolve([]));

    const error = await capture(
      setup(
        { ...steps(true), listAccounts },
        { ...ALL_FLAGS, location: 'Mumbai' }
      )
    );

    expect(error.code).toBe('INVALID_LOCATION');
    expect(listAccounts).not.toHaveBeenCalled();
  });

  it('words a missing project without an account for platforms without accounts', async () => {
    const error = await capture(
      setup(steps(false), { location: 'Delhi', project: '44' })
    );

    expect(error.message).toBe('MyAccount project 44 was not found.');
  });

  it('refuses a profile that does not exist', async () => {
    const error = await capture(
      setup(steps(true), ALL_FLAGS, { alias: 'missing' })
    );

    expect(error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('says to run e2ectl configure when there is no profile at all', async () => {
    const store = new ConfigStore({
      configPath: createTestConfigPath('no-profile')
    });

    const error = await capture(
      configurePlatform(
        { canPrompt: false, flagPrefix: '', values: ALL_FLAGS },
        { prompt: vi.fn(), stdout: { write: vi.fn() }, store },
        () => Promise.resolve(steps(true))
      )
    );

    expect(error).toMatchObject({
      message: 'There is no saved profile to keep this setting in.',
      suggestion: expect.stringContaining('e2ectl configure') as string
    });
  });
});

describe('describePlatformSetup', () => {
  it('names the account only when there is one', () => {
    expect(
      describePlatformSetup('work', {
        account: { email: 'a@b.c', id: 1, name: 'A' },
        location: 'Delhi',
        platform: 'tir',
        project: { id: 2, name: 'p' }
      })
    ).toBe(
      'TIR context saved for profile "work": account 1 (a@b.c), project 2 (p), Delhi.'
    );
    expect(
      describePlatformSetup('work', {
        account: null,
        location: 'Chennai',
        platform: 'myaccount',
        project: { id: 3, name: 'q' }
      })
    ).toBe(
      'MyAccount context saved for profile "work": project 3 (q), Chennai.'
    );
  });
});
