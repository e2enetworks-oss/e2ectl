import {
  resolveAccountCredentials,
  resolveCredentials
} from '../../../src/config/resolver.js';
import type { ConfigFile } from '../../../src/config/index.js';
import { CliError, EXIT_CODES } from '../../../src/core/errors.js';

describe('resolveCredentials', () => {
  const config: ConfigFile = {
    profiles: {
      prod: {
        api_key: 'api-prod',
        auth_token: 'auth-prod',
        default_project_id: '123',
        default_location: 'Delhi'
      }
    },
    default: 'prod'
  };

  it('returns auth and default context from the saved default profile', () => {
    const result = resolveCredentials({
      config,
      configPath: '/tmp/config.json',
      env: {}
    });

    expect(result).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      project_id: '123',
      location: 'Delhi',
      alias: 'prod',
      source: 'profile'
    });
  });

  it('applies flag and env context overrides on top of saved auth', () => {
    const result = resolveCredentials({
      alias: 'prod',
      config,
      env: {
        E2E_LOCATION: 'Chennai'
      },
      projectId: '456'
    });

    expect(result.project_id).toBe('456');
    expect(result.location).toBe('Chennai');
    expect(result.api_key).toBe('api-prod');
    expect(result.source).toBe('profile');
  });

  it('uses environment auth and context without a saved profile', () => {
    const result = resolveCredentials({
      config: { profiles: {} },
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env',
        E2E_PROJECT_ID: '789',
        E2E_LOCATION: 'Chennai'
      }
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      project_id: '789',
      location: 'Chennai',
      source: 'env'
    });
    expect(result.alias).toBeUndefined();
  });

  it('returns project-scoped environment credentials without adding an alias when no profile is involved', () => {
    const result = resolveCredentials({
      config: { profiles: {} },
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env',
        E2E_PROJECT_ID: '790',
        E2E_LOCATION: 'Delhi'
      }
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      location: 'Delhi',
      project_id: '790',
      source: 'env'
    });
  });

  it('throws an actionable error when auth is incomplete', () => {
    expect(() =>
      resolveCredentials({
        config: { profiles: {} },
        configPath: '/tmp/config.json',
        env: {
          E2E_API_KEY: 'api-env'
        }
      })
    ).toThrowError(/Unable to resolve MyAccount authentication/);
  });

  it('omits config-path details when auth resolution fails without a config file path', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        alias: 'prod',
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod'
            }
          }
        },
        env: {}
      })
    );

    expect(error.code).toBe('MISSING_AUTH_CREDENTIALS');
    expect(error.details).toEqual([
      'Missing required auth values: auth_token',
      'Resolved profile alias: prod',
      'Expected environment variables: E2E_AUTH_TOKEN'
    ]);
  });

  it('throws an actionable error when context is missing', () => {
    expect(() =>
      resolveCredentials({
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod',
              auth_token: 'auth-prod'
            }
          },
          default: 'prod'
        },
        configPath: '/tmp/config.json',
        env: {}
      })
    ).toThrowError(/Unable to resolve MyAccount project context/);
  });

  it('omits config-path details when context resolution fails without a config file path', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        config: {
          profiles: {}
        },
        env: {
          E2E_API_KEY: 'api-env',
          E2E_AUTH_TOKEN: 'auth-env'
        },
        location: 'Delhi'
      })
    );

    expect(error.code).toBe('MISSING_REQUEST_CONTEXT');
    expect(error.details).toEqual([
      'Missing required context values: project_id',
      'No profile alias was provided and no default profile exists.',
      'Expected environment variables: E2E_PROJECT_ID',
      'Command flags: --project-id <unset>, --location Delhi'
    ]);
  });

  it('throws when the requested alias does not exist', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        alias: 'missing',
        config,
        configPath: '/tmp/config.json',
        env: {
          E2E_API_KEY: 'api-env',
          E2E_AUTH_TOKEN: 'auth-env',
          E2E_LOCATION: 'Delhi',
          E2E_PROJECT_ID: '46429'
        }
      })
    );

    expect(error.message).toBe('Profile "missing" was not found.');
    expect(error.code).toBe('PROFILE_NOT_FOUND');
    expect(error.exitCode).toBe(EXIT_CODES.config);
  });

  it('prefers environment auth over the saved default profile auth', () => {
    const result = resolveCredentials({
      config,
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env',
        E2E_PROJECT_ID: '456',
        E2E_LOCATION: 'Chennai'
      }
    });

    expect(result).toEqual({
      alias: 'prod',
      api_key: 'api-env',
      auth_token: 'auth-env',
      project_id: '456',
      location: 'Chennai',
      source: 'mixed'
    });
  });

  it('ignores a stale default alias when env auth and env context are complete', () => {
    const result = resolveCredentials({
      config: {
        profiles: {},
        default: 'missing'
      },
      configPath: '/tmp/config.json',
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env',
        E2E_LOCATION: 'Delhi',
        E2E_PROJECT_ID: '46429'
      }
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      project_id: '46429',
      location: 'Delhi',
      source: 'env'
    });
  });

  it('ignores a stale default alias when env auth and flag context are complete', () => {
    const result = resolveCredentials({
      config: {
        profiles: {},
        default: 'missing'
      },
      configPath: '/tmp/config.json',
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env'
      },
      location: 'Chennai',
      projectId: '789'
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      project_id: '789',
      location: 'Chennai',
      source: 'env'
    });
  });

  it('throws a targeted config error when a stale default alias cannot be bypassed', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        config: {
          profiles: {},
          default: 'missing'
        },
        configPath: '/tmp/config.json',
        env: {
          E2E_API_KEY: 'api-env',
          E2E_AUTH_TOKEN: 'auth-env'
        }
      })
    );

    expect(error.message).toBe('Default profile "missing" is invalid.');
    expect(error.code).toBe('INVALID_DEFAULT_PROFILE');
    expect(error.exitCode).toBe(EXIT_CODES.config);
    expect(error.details).toEqual([
      'Unknown saved default alias: missing',
      'Missing required context values without a valid default profile: project_id, location',
      'Expected environment variables: E2E_PROJECT_ID, E2E_LOCATION',
      'Config path: /tmp/config.json'
    ]);
    expect(error.suggestion).toContain('Fix the saved default profile');
  });

  it('includes flag details when a stale default alias still leaves auth unresolved', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        config: {
          profiles: {},
          default: 'missing'
        },
        configPath: '/tmp/config.json',
        env: {},
        location: 'Delhi',
        projectId: '46429'
      })
    );

    expect(error.code).toBe('INVALID_DEFAULT_PROFILE');
    expect(error.details).toEqual(
      expect.arrayContaining([
        'Missing required auth values without a valid default profile: api_key, auth_token',
        'Command flags: --project-id 46429, --location Delhi',
        'Config path: /tmp/config.json'
      ])
    );
  });

  it('reports resolved aliases and config paths when saved auth is incomplete', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        alias: 'prod',
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod'
            }
          }
        },
        configPath: '/tmp/config.json',
        env: {}
      })
    );

    expect(error.code).toBe('MISSING_AUTH_CREDENTIALS');
    expect(error.details).toEqual([
      'Missing required auth values: auth_token',
      'Resolved profile alias: prod',
      'Expected environment variables: E2E_AUTH_TOKEN',
      'Config path: /tmp/config.json'
    ]);
  });

  it('reports resolved aliases, flags, and config paths when project context is incomplete', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        alias: 'prod',
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod',
              auth_token: 'auth-prod',
              default_project_id: '123'
            }
          }
        },
        configPath: '/tmp/config.json',
        env: {},
        projectId: '123'
      })
    );

    expect(error.code).toBe('MISSING_REQUEST_CONTEXT');
    expect(error.details).toEqual([
      'Missing required context values: location',
      'Resolved profile alias: prod',
      'Expected environment variables: E2E_LOCATION',
      'Command flags: --project-id 123, --location <unset>',
      'Config path: /tmp/config.json'
    ]);
  });

  it('validates numeric project ids and supported locations after resolution', () => {
    const projectError = captureCliError(() =>
      resolveCredentials({
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod',
              auth_token: 'auth-prod',
              default_project_id: 'abc',
              default_location: 'Delhi'
            }
          },
          default: 'prod'
        },
        env: {}
      })
    );
    const locationError = captureCliError(() =>
      resolveCredentials({
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod',
              auth_token: 'auth-prod',
              default_project_id: '123',
              default_location: 'Atlantis'
            }
          },
          default: 'prod'
        },
        env: {}
      })
    );

    expect(projectError.code).toBe('INVALID_PROJECT_ID');
    expect(locationError.code).toBe('INVALID_LOCATION');
  });
});

describe('resolveAccountCredentials', () => {
  it('resolves account-scoped auth without requiring saved project context', () => {
    const result = resolveAccountCredentials({
      config: {
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 'auth-prod'
          }
        },
        default: 'prod'
      },
      env: {}
    });

    expect(result).toEqual({
      alias: 'prod',
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      source: 'profile'
    });
  });

  it('returns account-scoped environment credentials with optional context and no alias', () => {
    const result = resolveAccountCredentials({
      config: {
        profiles: {}
      },
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env',
        E2E_PROJECT_ID: '123',
        E2E_LOCATION: 'Chennai'
      }
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      location: 'Chennai',
      project_id: '123',
      source: 'env'
    });
  });

  it('carries optional saved context when it exists so account commands can reflect the CLI default project', () => {
    const result = resolveAccountCredentials({
      config: {
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 'auth-prod',
            default_project_id: '123',
            default_location: 'Delhi'
          }
        },
        default: 'prod'
      },
      env: {}
    });

    expect(result).toEqual({
      alias: 'prod',
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      project_id: '123',
      location: 'Delhi',
      source: 'profile'
    });
  });

  it('ignores a stale default alias when environment auth is complete for account-scoped commands', () => {
    const result = resolveAccountCredentials({
      config: {
        profiles: {},
        default: 'missing'
      },
      configPath: '/tmp/config.json',
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env'
      }
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      source: 'env'
    });
  });

  it('retains optional context only when the values are non-empty and valid', () => {
    const resultWithProjectOnly = resolveAccountCredentials({
      config: {
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 'auth-prod',
            default_project_id: '123',
            default_location: '   '
          }
        },
        default: 'prod'
      },
      env: {}
    });
    const resultWithFullContext = resolveAccountCredentials({
      config: {
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 'auth-prod',
            default_project_id: '123',
            default_location: 'Delhi'
          }
        },
        default: 'prod'
      },
      env: {}
    });

    expect(resultWithProjectOnly).toEqual({
      alias: 'prod',
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      project_id: '123',
      source: 'profile'
    });
    expect(resultWithFullContext).toEqual({
      alias: 'prod',
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      project_id: '123',
      location: 'Delhi',
      source: 'profile'
    });
  });

  it('validates optional account context when both values are present', () => {
    const invalidProject = captureCliError(() =>
      resolveAccountCredentials({
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod',
              auth_token: 'auth-prod',
              default_project_id: 'bad-id',
              default_location: 'Delhi'
            }
          },
          default: 'prod'
        },
        env: {}
      })
    );
    const invalidLocation = captureCliError(() =>
      resolveAccountCredentials({
        config: {
          profiles: {
            prod: {
              api_key: 'api-prod',
              auth_token: 'auth-prod',
              default_project_id: '123',
              default_location: 'Atlantis'
            }
          },
          default: 'prod'
        },
        env: {}
      })
    );

    expect(invalidProject.code).toBe('INVALID_PROJECT_ID');
    expect(invalidLocation.code).toBe('INVALID_LOCATION');
  });
});

function captureCliError(callback: () => unknown): CliError {
  try {
    callback();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(CliError);
    return error as CliError;
  }

  throw new Error('Expected a CliError to be thrown.');
}
