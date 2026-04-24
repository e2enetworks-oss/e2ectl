import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ConfigService } from '../../../src/config/service.js';
import type { ConfigFile, ProfileConfig } from '../../../src/config/index.js';

function createConfig(
  profiles: Record<string, ProfileConfig> = {},
  defaultAlias?: string
): ConfigFile {
  return defaultAlias === undefined
    ? { profiles }
    : {
        default: defaultAlias,
        profiles
      };
}

function createServiceFixture(
  initialConfig: ConfigFile = createConfig(),
  options?: {
    confirmResponses?: boolean[];
    isInteractive?: boolean;
    promptResponses?: string[];
    validateResults?: Array<{ message?: string; valid: boolean }>;
  }
): {
  confirm: ReturnType<typeof vi.fn>;
  getConfig: () => ConfigFile;
  prompt: ReturnType<typeof vi.fn>;
  service: ConfigService;
  store: {
    configPath: string;
    hasProfile: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    removeProfile: ReturnType<typeof vi.fn>;
    setDefault: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };
  validator: ReturnType<typeof vi.fn>;
} {
  let config = structuredClone(initialConfig);
  const confirmResponses = [...(options?.confirmResponses ?? [])];
  const promptResponses = [...(options?.promptResponses ?? [])];
  const validateResults = [...(options?.validateResults ?? [])];

  const store = {
    configPath: '/tmp/e2ectl-config.json',
    hasProfile: vi.fn((alias: string) =>
      Promise.resolve(config.profiles[alias] !== undefined)
    ),
    read: vi.fn(() => Promise.resolve(structuredClone(config))),
    removeProfile: vi.fn((alias: string) => {
      const nextProfiles = { ...config.profiles };
      delete nextProfiles[alias];
      config =
        config.default === alias
          ? { profiles: nextProfiles }
          : config.default === undefined
            ? { profiles: nextProfiles }
            : { default: config.default, profiles: nextProfiles };
      return Promise.resolve(structuredClone(config));
    }),
    setDefault: vi.fn((alias: string) => {
      config = {
        default: alias,
        profiles: { ...config.profiles }
      };
      return Promise.resolve(structuredClone(config));
    }),
    updateProfile: vi.fn(
      (alias: string, patch: Partial<ProfileConfig>) => {
        config = {
          ...(config.default === undefined ? {} : { default: config.default }),
          profiles: {
            ...config.profiles,
            [alias]: {
              ...config.profiles[alias],
              ...patch
            }
          }
        };
        return Promise.resolve(structuredClone(config));
      }
    ),
    write: vi.fn((nextConfig: ConfigFile) => {
      config = structuredClone(nextConfig);
      return Promise.resolve();
    })
  };

  const validator = vi.fn(
    () => Promise.resolve(validateResults.shift() ?? { valid: true })
  );
  const confirm = vi.fn(() => Promise.resolve(confirmResponses.shift() ?? true));
  const prompt = vi.fn(() => Promise.resolve(promptResponses.shift() ?? ''));
  const service = new ConfigService({
    confirm,
    credentialValidator: {
      validate: validator
    },
    isInteractive: options?.isInteractive ?? true,
    prompt,
    store
  });

  return {
    confirm,
    getConfig: () => structuredClone(config),
    prompt,
    service,
    store,
    validator
  };
}

async function createImportFile(payload: unknown): Promise<string> {
  const filePath = path.join(
    process.cwd(),
    '.tmp',
    `config-service-${Math.random().toString(36).slice(2)}.json`
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
  return filePath;
}

describe('ConfigService', () => {
  it('imports profiles, prompts for defaults, and preserves existing alias context until defaults are applied', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-new-prod',
        api_key: 'api-new-prod'
      },
      staging: {
        api_auth_token: 'auth-staging',
        api_key: 'api-staging'
      }
    });
    const { confirm, getConfig, prompt, service, validator } =
      createServiceFixture(
        createConfig({
          prod: {
            api_key: 'api-old-prod',
            auth_token: 'auth-old-prod',
            default_location: 'Mumbai',
            default_project_id: '99'
          }
        }),
        {
          confirmResponses: [true, true],
          promptResponses: ['123', 'Delhi', 'staging']
        }
      );

    const result = await service.importProfiles({
      file
    });

    expect(validator).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenNthCalledWith(
      1,
      'Overwrite existing aliases: prod?'
    );
    expect(confirm).toHaveBeenNthCalledWith(
      2,
      'Set one of the imported aliases as the default profile now?'
    );
    expect(prompt).toHaveBeenNthCalledWith(
      1,
      'Default project ID for imported aliases (press Enter to skip): '
    );
    expect(prompt).toHaveBeenNthCalledWith(
      2,
      'Default location for imported aliases (Delhi/Chennai, press Enter to skip): '
    );
    expect(prompt).toHaveBeenNthCalledWith(
      3,
      'Default alias (prod, staging), or press Enter to skip: '
    );
    expect(result.importedAliases).toEqual(['prod', 'staging']);
    expect(result.importedDefaults).toEqual({
      default_location: 'Delhi',
      default_project_id: '123'
    });
    expect(getConfig()).toEqual({
      default: 'staging',
      profiles: {
        prod: {
          api_key: 'api-new-prod',
          auth_token: 'auth-new-prod',
          default_location: 'Delhi',
          default_project_id: '123'
        },
        staging: {
          api_key: 'api-staging',
          auth_token: 'auth-staging',
          default_location: 'Delhi',
          default_project_id: '123'
        }
      }
    });
  });

  it('sets a single imported alias as default when the confirmation prompt is accepted', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const { service } = createServiceFixture(createConfig(), {
      confirmResponses: [true],
      promptResponses: ['', '']
    });

    const result = await service.importProfiles({
      file
    });

    expect(result.config.default).toBe('prod');
  });

  it('rejects overwrite in non-interactive mode unless force is provided', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const { service } = createServiceFixture(
      createConfig({
        prod: {
          api_key: 'api-old',
          auth_token: 'auth-old'
        }
      }),
      {
        isInteractive: false
      }
    );

    await expect(
      service.importProfiles({
        file
      })
    ).rejects.toMatchObject({
      code: 'IMPORT_OVERWRITE_REQUIRED'
    });
  });

  it('rejects overwrite when the confirmation prompt is declined', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const { service } = createServiceFixture(
      createConfig({
        prod: {
          api_key: 'api-old',
          auth_token: 'auth-old'
        }
      }),
      {
        confirmResponses: [false]
      }
    );

    await expect(
      service.importProfiles({
        file
      })
    ).rejects.toMatchObject({
      code: 'IMPORT_CANCELLED'
    });
  });

  it('surfaces invalid imported credentials together with validator messages', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const { service } = createServiceFixture(createConfig(), {
      validateResults: [
        {
          message: 'Token expired.',
          valid: false
        }
      ]
    });

    await expect(
      service.importProfiles({
        file,
        input: false
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IMPORTED_CREDENTIALS',
      details: ['Token expired.']
    });
  });

  it('surfaces invalid imported credentials even when the validator omits a message', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const { service } = createServiceFixture(createConfig(), {
      validateResults: [{ valid: false }]
    });

    await expect(
      service.importProfiles({
        file,
        input: false
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IMPORTED_CREDENTIALS',
      details: []
    });
  });

  it('rejects explicit and prompted default aliases that were not imported', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      },
      staging: {
        api_auth_token: 'auth-staging',
        api_key: 'api-staging'
      }
    });

    const explicitFixture = createServiceFixture(createConfig());
    await expect(
      explicitFixture.service.importProfiles({
        default: 'missing',
        file,
        input: false
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IMPORT_DEFAULT_ALIAS'
    });

    const promptedFixture = createServiceFixture(createConfig(), {
      confirmResponses: [true],
      promptResponses: ['', '', 'missing']
    });
    await expect(
      promptedFixture.service.importProfiles({
        file
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IMPORT_DEFAULT_ALIAS'
    });
  });

  it('updates profile context with project-only and location-only patches', async () => {
    const fixture = createServiceFixture(
      createConfig({
        prod: {
          api_key: 'api-prod',
          auth_token: 'auth-prod'
        }
      })
    );

    const projectOnly = await fixture.service.setContext({
      alias: 'prod',
      defaultProjectId: '123'
    });
    const locationOnly = await fixture.service.setContext({
      alias: 'prod',
      defaultLocation: 'Chennai'
    });

    expect(projectOnly.config.profiles.prod).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '123'
    });
    expect(locationOnly.config.profiles.prod).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_location: 'Chennai',
      default_project_id: '123'
    });
  });

  it('preserves existing partial context when imported defaults are not supplied', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const { getConfig, service } = createServiceFixture(
      createConfig({
        prod: {
          api_key: 'api-old',
          auth_token: 'auth-old',
          default_location: 'Delhi',
          default_project_id: '123'
        }
      })
    );

    await service.importProfiles({
      file,
      force: true,
      input: false
    });

    expect(getConfig().profiles.prod).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_location: 'Delhi',
      default_project_id: '123'
    });
  });

  it('applies project-only and location-only imported defaults independently', async () => {
    const file = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    const projectOnlyFixture = createServiceFixture(createConfig());
    await projectOnlyFixture.service.importProfiles({
      defaultProjectId: '555',
      file,
      input: false
    });
    expect(projectOnlyFixture.getConfig()).toEqual({
      profiles: {
        prod: {
          api_key: 'api-prod',
          auth_token: 'auth-prod',
          default_project_id: '555'
        }
      }
    });

    const locationOnlyFixture = createServiceFixture(createConfig());
    await locationOnlyFixture.service.importProfiles({
      defaultLocation: 'Chennai',
      file,
      input: false
    });
    expect(locationOnlyFixture.getConfig()).toEqual({
      profiles: {
        prod: {
          api_key: 'api-prod',
          auth_token: 'auth-prod',
          default_location: 'Chennai'
        }
      }
    });
  });

  it('allows operators to skip setting a default alias during interactive import prompts', async () => {
    const singleAliasFile = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });
    const singleAliasFixture = createServiceFixture(createConfig(), {
      confirmResponses: [false],
      promptResponses: ['', '']
    });

    const singleAliasResult = await singleAliasFixture.service.importProfiles({
      file: singleAliasFile
    });

    expect(singleAliasResult.config.default).toBeUndefined();

    const multiAliasFile = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      },
      staging: {
        api_auth_token: 'auth-staging',
        api_key: 'api-staging'
      }
    });
    const skipDefaultFixture = createServiceFixture(createConfig(), {
      confirmResponses: [false],
      promptResponses: ['', '']
    });

    const skipDefaultResult = await skipDefaultFixture.service.importProfiles({
      file: multiAliasFile
    });

    expect(skipDefaultResult.config.default).toBeUndefined();

    const blankAliasFixture = createServiceFixture(createConfig(), {
      confirmResponses: [true],
      promptResponses: ['', '', '   ']
    });

    const blankAliasResult = await blankAliasFixture.service.importProfiles({
      file: multiAliasFile
    });

    expect(blankAliasResult.config.default).toBeUndefined();
  });

  it('rejects invalid context updates and missing aliases', async () => {
    const fixture = createServiceFixture(
      createConfig({
        prod: {
          api_key: 'api-prod',
          auth_token: 'auth-prod'
        }
      })
    );

    await expect(
      fixture.service.setContext({
        alias: 'prod'
      })
    ).rejects.toMatchObject({
      code: 'MISSING_DEFAULT_CONTEXT'
    });
    await expect(
      fixture.service.setContext({
        alias: 'prod',
        defaultProjectId: 'abc'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_PROJECT_ID'
    });
    await expect(
      fixture.service.setContext({
        alias: 'prod',
        defaultLocation: 'Atlantis'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_LOCATION'
    });
    await expect(
      fixture.service.removeProfile({
        alias: 'missing'
      })
    ).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND'
    });
    await expect(
      fixture.service.setDefault({
        alias: 'missing'
      })
    ).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND'
    });
  });
});
