import { resolveCredentials } from '../../../src/config/resolver.js';
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
