import {
  resolveCredentials,
  resolveTirCredentials
} from '../../../src/config/resolver.js';
import type { ConfigFile } from '../../../src/config/index.js';
import { pickValue } from '../../../src/config/value-order.js';
import { CliError, EXIT_CODES } from '../../../src/core/errors.js';

// Every combination of where a value can be set, and which one must win.
const COMBINATIONS = [
  { flag: true, env: true, profile: true, winner: 'flag' },
  { flag: true, env: true, profile: false, winner: 'flag' },
  { flag: true, env: false, profile: true, winner: 'flag' },
  { flag: true, env: false, profile: false, winner: 'flag' },
  { flag: false, env: true, profile: true, winner: 'env' },
  { flag: false, env: true, profile: false, winner: 'env' },
  { flag: false, env: false, profile: true, winner: 'profile' },
  { flag: false, env: false, profile: false, winner: 'none' }
] as const;

describe('pickValue', () => {
  it.each(COMBINATIONS)(
    'flag=$flag env=$env profile=$profile picks $winner',
    ({ flag, env, profile, winner }) => {
      const picked = pickValue({
        ...(flag ? { flag: 'from-flag' } : {}),
        ...(env ? { env: 'from-env' } : {}),
        ...(profile ? { profile: 'from-profile' } : {})
      });

      expect(picked?.origin ?? 'none').toBe(winner);
      expect(picked?.value ?? 'none').toBe(
        winner === 'none' ? 'none' : `from-${winner}`
      );
    }
  );

  it('treats blank values as missing and trims the value it picks', () => {
    expect(pickValue({ flag: '  ', env: ' 42 ', profile: '7' })).toEqual({
      origin: 'env',
      value: '42'
    });
  });
});

// Numbers stand in for each source so a test can see which one won:
// flag 1xx, environment 2xx, profile 3xx.
const MYACCOUNT_VALUES = {
  project_id: { flag: '101', env: '201', profile: '301' },
  location: { flag: 'Delhi', env: 'Chennai', profile: 'Delhi' }
} as const;

describe('MyAccount value order', () => {
  it.each(COMBINATIONS.filter((combination) => combination.profile))(
    'project: flag=$flag env=$env profile=$profile picks $winner',
    ({ flag, env, winner }) => {
      const result = resolveCredentials({
        config: profileConfig({ default_project_id: '301' }),
        env: {
          ...(env ? { E2E_PROJECT_ID: '201' } : {})
        },
        ...(flag ? { projectId: '101' } : {})
      });

      expect(result.project_id).toBe(MYACCOUNT_VALUES.project_id[winner]);
    }
  );

  it.each([
    { flag: 'Delhi', env: 'Chennai', profile: 'Chennai', expected: 'Delhi' },
    { flag: undefined, env: 'Chennai', profile: 'Delhi', expected: 'Chennai' },
    { flag: undefined, env: undefined, profile: 'Chennai', expected: 'Chennai' }
  ])(
    'location: flag=$flag env=$env profile=$profile gives $expected',
    ({ flag, env, profile, expected }) => {
      const result = resolveCredentials({
        config: profileConfig({ default_location: profile }),
        env: env === undefined ? {} : { E2E_LOCATION: env },
        ...(flag === undefined ? {} : { location: flag })
      });

      expect(result.location).toBe(expected);
    }
  );

  it('fails with a next step when no place has a project', () => {
    const error = captureCliError(() =>
      resolveCredentials({
        config: {
          default: 'home',
          profiles: { home: { api_key: 'key-home', auth_token: 'token-home' } }
        },
        env: {}
      })
    );

    expect(error.code).toBe('MISSING_REQUEST_CONTEXT');
    expect(error.suggestion).toContain('--project-id');
  });
});

describe('key and token order', () => {
  const env = { E2E_API_KEY: 'key-env', E2E_AUTH_TOKEN: 'token-env' };

  it('uses the --alias profile key and token over the environment', () => {
    const result = resolveCredentials({
      alias: 'work',
      config: twoProfileConfig(),
      env: { ...env, E2E_PROJECT_ID: '201', E2E_LOCATION: 'Chennai' }
    });

    expect(result).toMatchObject({
      alias: 'work',
      api_key: 'key-work',
      auth_token: 'token-work'
    });
  });

  it('still lets the project and location environment variables beat the --alias profile', () => {
    const result = resolveCredentials({
      alias: 'work',
      config: twoProfileConfig(),
      env: { E2E_PROJECT_ID: '201', E2E_LOCATION: 'Chennai' }
    });

    expect(result.project_id).toBe('201');
    expect(result.location).toBe('Chennai');
  });

  it('uses the environment key and token over the default profile when no --alias is given', () => {
    const result = resolveCredentials({ config: twoProfileConfig(), env });

    expect(result).toMatchObject({
      alias: 'home',
      api_key: 'key-env',
      auth_token: 'token-env',
      project_id: '300'
    });
  });

  it('uses the default profile key and token when the environment has none', () => {
    const result = resolveCredentials({ config: twoProfileConfig(), env: {} });

    expect(result).toMatchObject({
      api_key: 'key-home',
      auth_token: 'token-home'
    });
  });

  it('uses the --alias profile key and token for TIR too', () => {
    const result = resolveTirCredentials(
      { alias: 'work', config: twoProfileConfig(), env },
      'auth'
    );

    expect(result.api_key).toBe('key-work');
    expect(result.auth_token).toBe('token-work');
  });
});

describe('TIR value order', () => {
  const tirEnvNames = {
    account_id: 'E2E_TIR_ACCOUNT_ID',
    project_id: 'E2E_TIR_PROJECT_ID'
  } as const;
  const flagNames = {
    account_id: 'accountId',
    project_id: 'projectId'
  } as const;
  const values = {
    flag: '111',
    env: '222',
    profile: '333'
  } as const;

  for (const field of ['account_id', 'project_id'] as const) {
    it.each(
      COMBINATIONS.filter((combination) => combination.winner !== 'none')
    )(
      `${field}: flag=$flag env=$env profile=$profile picks $winner`,
      ({ flag, env, profile, winner }) => {
        const result = resolveTirCredentials(
          {
            config: profileConfig(
              {},
              {
                account_id: '9',
                project_id: '8',
                location: 'Chennai',
                ...(profile ? { [field]: values.profile } : { [field]: '' })
              }
            ),
            env: env ? { [tirEnvNames[field]]: values.env } : {},
            ...(flag ? { [flagNames[field]]: values.flag } : {})
          },
          'project'
        );

        expect(result[field]).toBe(values[winner]);
      }
    );
  }

  it.each([
    { flag: 'Delhi', env: 'Chennai', profile: 'Chennai', expected: 'Delhi' },
    { flag: undefined, env: 'Delhi', profile: 'Chennai', expected: 'Delhi' },
    { flag: undefined, env: undefined, profile: 'Chennai', expected: 'Chennai' }
  ])(
    'location: flag=$flag env=$env profile=$profile gives $expected',
    ({ flag, env, profile, expected }) => {
      const result = resolveTirCredentials(
        {
          config: profileConfig(
            {},
            { account_id: '9', project_id: '8', location: profile }
          ),
          env: env === undefined ? {} : { E2E_TIR_LOCATION: env },
          ...(flag === undefined ? {} : { location: flag })
        },
        'project'
      );

      expect(result.location).toBe(expected);
    }
  );

  it('never takes the MyAccount project or location for TIR', () => {
    const result = resolveTirCredentials(
      {
        config: profileConfig({}, { account_id: '9' }),
        env: { E2E_PROJECT_ID: '201', E2E_LOCATION: 'Chennai' }
      },
      'account'
    );

    expect(result.project_id).toBeUndefined();
    expect(result.location).toBeUndefined();
  });

  it('says to run tir account list when no account is chosen', () => {
    const error = captureCliError(() =>
      resolveTirCredentials({ config: profileConfig(), env: {} }, 'account')
    );

    expect(error.message).toBe('No TIR account chosen.');
    expect(error.exitCode).toBe(EXIT_CODES.config);
    expect(error.suggestion).toContain('tir account list');
  });

  it('says to run tir project list and tir configure when no project is chosen', () => {
    const error = captureCliError(() =>
      resolveTirCredentials(
        { config: profileConfig({}, { account_id: '9' }), env: {} },
        'project'
      )
    );

    expect(error.message).toBe('No TIR project and location chosen.');
    expect(error.suggestion).toContain('tir project list');
    expect(error.suggestion).toContain('tir configure');
  });

  it.each([
    { context: { account_id: 'abc' }, code: 'INVALID_ID' },
    {
      context: { account_id: '9', project_id: 'abc', location: 'Delhi' },
      code: 'INVALID_ID'
    },
    {
      context: { account_id: '9', project_id: '8', location: 'Mumbai' },
      code: 'INVALID_LOCATION'
    }
  ])('rejects a bad value with $code', ({ context, code }) => {
    const error = captureCliError(() =>
      resolveTirCredentials(
        { config: profileConfig({}, context), env: {} },
        'project'
      )
    );

    expect(error.code).toBe(code);
    expect(error.exitCode).toBe(EXIT_CODES.usage);
  });

  it('needs no TIR context when only the key and token are required', () => {
    const result = resolveTirCredentials(
      { config: profileConfig(), env: {} },
      'auth'
    );

    expect(result).toEqual({
      alias: 'home',
      api_key: 'key-home',
      auth_token: 'token-home'
    });
  });
});

function profileConfig(
  myAccount: { default_location?: string; default_project_id?: string } = {},
  tir?: Record<string, string>
): ConfigFile {
  return {
    default: 'home',
    profiles: {
      home: {
        api_key: 'key-home',
        auth_token: 'token-home',
        default_project_id: '300',
        default_location: 'Delhi',
        ...myAccount,
        ...(tir === undefined ? {} : { tir })
      }
    }
  };
}

function twoProfileConfig(): ConfigFile {
  return {
    default: 'home',
    profiles: {
      home: {
        api_key: 'key-home',
        auth_token: 'token-home',
        default_project_id: '300',
        default_location: 'Delhi'
      },
      work: {
        api_key: 'key-work',
        auth_token: 'token-work',
        default_project_id: '400',
        default_location: 'Delhi'
      }
    }
  };
}

function captureCliError(callback: () => unknown): CliError {
  try {
    callback();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(CliError);
    return error as CliError;
  }

  throw new Error('Expected a CliError to be thrown.');
}
