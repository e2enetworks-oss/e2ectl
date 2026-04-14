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

  it('rejects blank alias keys after trimming whitespace', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          '   ': {
            api_auth_token: 'auth-token',
            api_key: 'api-key'
          }
        })
      )
    ).toThrow(/empty alias key/i);
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

  it('trims aliases and secret values from imported profiles', () => {
    const parsed = parseImportedProfiles(
      JSON.stringify({
        ' prod ': {
          api_auth_token: ' auth-token ',
          api_key: ' api-key '
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

  it('rejects invalid JSON content', () => {
    expect(() => parseImportedProfiles('{')).toThrow(/valid JSON/i);
  });

  it('rejects empty import files after parsing', () => {
    expect(() => parseImportedProfiles('{}')).toThrow(
      /does not contain any aliases/i
    );
  });

  it('rejects alias values that are not JSON objects', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          prod: ['not-an-object']
        })
      )
    ).toThrow(/must map to a JSON object/i);
  });

  it('rejects aliases without api_key', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          prod: {
            api_auth_token: 'auth-token'
          }
        })
      )
    ).toThrow(/missing api_key/i);
  });

  it('rejects blank api_key values after trimming whitespace', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          prod: {
            api_auth_token: 'auth-token',
            api_key: '   '
          }
        })
      )
    ).toThrow(/missing api_key/i);
  });

  it('rejects blank api_auth_token values after trimming whitespace', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          prod: {
            api_auth_token: '   ',
            api_key: 'api-key'
          }
        })
      )
    ).toThrow(/missing api_auth_token/i);
  });

  it('rejects duplicate aliases after trimming whitespace', () => {
    expect(() =>
      parseImportedProfiles(
        JSON.stringify({
          ' prod ': {
            api_auth_token: 'auth-token-1',
            api_key: 'api-key-1'
          },
          prod: {
            api_auth_token: 'auth-token-2',
            api_key: 'api-key-2'
          }
        })
      )
    ).toThrow(/duplicate alias "prod"/i);
  });
});
