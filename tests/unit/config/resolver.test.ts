import { resolveCredentials } from '../../../src/config/resolver.js';
import type { ConfigFile } from '../../../src/config/index.js';

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
    expect(() =>
      resolveCredentials({
        alias: 'missing',
        config,
        configPath: '/tmp/config.json',
        env: {}
      })
    ).toThrowError(/Profile "missing" was not found/);
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
});
