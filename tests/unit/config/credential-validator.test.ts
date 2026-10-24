import { ApiCredentialValidator } from '../../../src/config/credential-validator.js';
import type { FetchLike } from '../../../src/http/index.js';
import { createMyAccountTransport } from '../../../src/myaccount/api.js';

function createValidator(fetchFn: FetchLike): ApiCredentialValidator {
  return new ApiCredentialValidator((credentials) =>
    createMyAccountTransport(credentials, { fetchFn })
  );
}

describe('ApiCredentialValidator', () => {
  it('accepts valid credentials when /iam/multi-crn/ succeeds', async () => {
    const validator = createValidator(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: {
              crn_data: []
            },
            errors: {},
            message: 'Success'
          })
      })
    );

    await expect(
      validator.validate({
        api_key: 'api-key',
        auth_token: 'auth-token'
      })
    ).resolves.toEqual({
      valid: true,
      message: 'Credentials validated successfully against /iam/multi-crn/.'
    });
  });

  it('returns a friendly invalid result for auth failures', async () => {
    const validator = createValidator(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({
            detail: 'Authentication credentials were not provided.'
          })
      })
    );

    await expect(
      validator.validate({
        api_key: 'api-key',
        auth_token: 'auth-token'
      })
    ).resolves.toEqual({
      message:
        'MyAccount API request failed: Authentication credentials were not provided.',
      valid: false
    });
  });
});
