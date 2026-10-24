import {
  configurePlatform,
  describePlatformSetup,
  findSetupProfile,
  type PlatformSetupSteps,
  type ProfileConfig,
  type SetupIo,
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
    name: 'Fake',
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

function io(overrides: Partial<SetupIo> = {}): SetupIo & { written: string[] } {
  const written: string[] = [];
  return {
    canPrompt: false,
    env: {},
    prompt: vi.fn(() => Promise.resolve('')),
    write: (text) => {
      written.push(text);
    },
    written,
    ...overrides
  };
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
    const store = await storeWith();

    const result = await configurePlatform(steps(true), 'work', ALL_FLAGS, {
      io: io(),
      store
    });

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

  it('skips the account step for platforms without accounts', async () => {
    const result = await configurePlatform(
      steps(false),
      'work',
      { location: 'Delhi', project: '33' },
      { io: io(), store: await storeWith() }
    );

    expect(result.account).toBeNull();
  });

  it('takes a flag over the environment over the saved value', async () => {
    const store = await storeWith({
      tir: { account_id: '11', location: 'Delhi', project_id: '33' }
    });
    const env = { FAKE_LOCATION: 'Chennai' };

    expect(
      (
        await configurePlatform(
          steps(true),
          'work',
          {},
          { io: io({ env }), store }
        )
      ).location
    ).toBe('Chennai');
    expect(
      (
        await configurePlatform(
          steps(true),
          'work',
          { location: 'Delhi' },
          {
            io: io({ env }),
            store
          }
        )
      ).location
    ).toBe('Delhi');
  });

  it('asks in a terminal, offering the saved value as the default', async () => {
    const prompt = vi
      .fn<SetupIo['prompt']>()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('33')
      .mockResolvedValueOnce('Delhi');
    const terminal = io({ canPrompt: true, prompt });

    const result = await configurePlatform(
      steps(true),
      'work',
      {},
      {
        io: terminal,
        store: await storeWith({ tir: { account_id: '11' } })
      }
    );

    expect(prompt).toHaveBeenNthCalledWith(1, 'Fake account [11]: ');
    expect(prompt).toHaveBeenNthCalledWith(2, 'Fake project [33]: ');
    expect(prompt).toHaveBeenNthCalledWith(3, 'Fake location: ');
    expect(terminal.written.join('')).toContain('owner@example.com');
    expect(terminal.written.join('')).toContain('22  Off  (Fake is off)');
    expect(result).toMatchObject({ location: 'Delhi', project: { id: 33 } });
  });

  it('does not ask for a value given as a flag', async () => {
    const prompt = vi.fn(() => Promise.resolve('Delhi'));

    await configurePlatform(
      steps(true),
      'work',
      { account: '11', project: '33' },
      {
        io: io({ canPrompt: true, prompt }),
        store: await storeWith()
      }
    );

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      {},
      'No Fake account given.',
      'Add --account <id> (see `e2ectl fake account list`).'
    ],
    [
      { account: '11' },
      'No Fake project given.',
      'Add --project <id> (see `e2ectl fake project list`).'
    ],
    [
      { account: '11', project: '33' },
      'No Fake location given.',
      'Add --location Delhi or --location Chennai.'
    ]
  ])(
    'without a terminal, names the flag to add when %o is given',
    async (flags, message, suggestion) => {
      const error = await capture(
        configurePlatform(steps(true), 'work', flags, {
          io: io(),
          store: await storeWith()
        })
      );

      expect(error.message).toBe(message);
      expect(error.suggestion).toBe(suggestion);
    }
  );

  it('treats an empty answer with no default as missing', async () => {
    const error = await capture(
      configurePlatform(
        steps(false),
        'work',
        { project: '33' },
        {
          io: io({ canPrompt: true }),
          store: await storeWith()
        }
      )
    );

    expect(error.code).toBe('MISSING_SETUP_VALUE');
  });

  it.each([
    [
      { ...ALL_FLAGS, account: '99' },
      'SETUP_ACCOUNT_NOT_FOUND',
      'Fake account 99 is not one your key can use.'
    ],
    [
      { ...ALL_FLAGS, account: '22' },
      'SETUP_ACCOUNT_DISABLED',
      'Fake is not turned on for account 22.'
    ],
    [
      { ...ALL_FLAGS, project: '44' },
      'SETUP_PROJECT_NOT_FOUND',
      'Fake project 44 was not found in account 11.'
    ],
    [
      { ...ALL_FLAGS, location: 'Mumbai' },
      'INVALID_LOCATION',
      'Unsupported Fake location "Mumbai".'
    ],
    [
      { ...ALL_FLAGS, account: 'x' },
      'INVALID_SETUP_ID',
      'Fake account ID must be numeric.'
    ],
    [
      { ...ALL_FLAGS, project: 'x' },
      'INVALID_SETUP_ID',
      'Fake project ID must be numeric.'
    ]
  ])('refuses %o with %s and saves nothing', async (flags, code, message) => {
    const store = await storeWith();
    const error = await capture(
      configurePlatform(steps(true), 'work', flags, { io: io(), store })
    );

    expect(error).toMatchObject({ code, message });
    expect(error.suggestion).toBeDefined();
    expect((await store.read()).profiles.work?.tir).toBeUndefined();
  });

  it('words a missing project without an account for platforms without accounts', async () => {
    const error = await capture(
      configurePlatform(
        steps(false),
        'work',
        { location: 'Delhi', project: '44' },
        {
          io: io(),
          store: await storeWith()
        }
      )
    );

    expect(error.message).toBe('Fake project 44 was not found.');
  });

  it('refuses a profile that does not exist', async () => {
    const error = await capture(
      configurePlatform(steps(true), 'missing', ALL_FLAGS, {
        io: io(),
        store: await storeWith()
      })
    );

    expect(error.code).toBe('PROFILE_NOT_FOUND');
  });
});

describe('findSetupProfile', () => {
  it('uses --alias, then the default profile', async () => {
    const store = await storeWith();

    expect(await findSetupProfile(store, 'work')).toBe('work');
    expect(await findSetupProfile(store, undefined)).toBe('work');
  });

  it('says to run e2ectl configure when there is no profile', async () => {
    const store = new ConfigStore({
      configPath: createTestConfigPath('no-profile')
    });

    await expect(findSetupProfile(store, undefined)).rejects.toMatchObject({
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
