import { parseImportedProfiles } from '../../../src/config/import-file.js';

describe('import-file parser', () => {
  it('parses the downloaded credential file shape', () => {
    const parsed = parseImportedProfiles(
      JSON.stringify({
        prod: {
          api_auth_token: 'auth-token',
          api_key: 'api-key'
        }
      })
    );

    expect(parsed).toEqual({
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token'
      }
    });
  });

  it('rejects malformed top-level values', () => {
    expect(() => parseImportedProfiles(JSON.stringify(['prod']))).toThrow(
      /JSON object keyed by alias/i
    );
  });

  it('rejects aliases without required secrets', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          prod: {
            api_key: 'api-key'
          }
        })
      )
    ).toThrow(/missing api_auth_token/i);
  });

  it('rejects auth_token-only shapes because import requires downloaded credential JSON', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          prod: {
            api_key: 'api-key',
            auth_token: 'auth-token'
          }
        })
      )
    ).toThrow(/missing api_auth_token/i);
  });
});
