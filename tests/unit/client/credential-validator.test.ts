import { ApiCredentialValidator } from '../../../src/client/credential-validator.js';

describe('ApiCredentialValidator', () => {
  it('accepts valid credentials when /iam/multi-crn/ succeeds', async () => {
    const validator = new ApiCredentialValidator({
      fetchFn: () =>
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
    });

    await expect(
      validator.validate({
        api_key: 'api-key',
        auth_token: 'auth-token',
        project_id: '123',
        location: 'Delhi'
      })
    ).resolves.toEqual({
      valid: true,
      message: 'Credentials validated successfully against /iam/multi-crn/.'
    });
  });
});
