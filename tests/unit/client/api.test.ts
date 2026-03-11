import { MyAccountApiClient } from '../../../src/client/api.js';
import { CliError } from '../../../src/utils/errors.js';

describe('MyAccountApiClient', () => {
  const credentials = {
    api_key: 'api-key',
    auth_token: 'auth-token',
    project_id: '123',
    location: 'Delhi',
    source: 'profile' as const
  };

  it('injects bearer auth and required query params', async () => {
    let seenInput = '';
    let seenInit: RequestInit | undefined;

    const fetchFn = vi.fn((input: string, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: { ok: true },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/root',
      fetchFn
    });

    await client.get('/nodes/', {
      query: {
        page_no: '2'
      }
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(seenInput).toBe(
      'https://example.test/root/nodes/?apikey=api-key&project_id=123&location=Delhi&page_no=2'
    );
    expect(seenInit?.headers).toMatchObject({
      Authorization: 'Bearer auth-token'
    });
  });

  it('omits project context for credential validation', async () => {
    let seenInput = '';

    const fetchFn = vi.fn((input: string) => {
      seenInput = input;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: { valid: true },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.validateCredentials();

    expect(seenInput).toBe(
      'https://example.test/iam/multi-crn/?apikey=api-key'
    );
  });

  it('raises a CLI error when the API envelope indicates failure', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({
              code: 401,
              data: {},
              errors: {
                auth: ['invalid']
              },
              message: 'Unauthorized'
            })
        })
    });

    await expect(client.validateCredentials()).rejects.toBeInstanceOf(CliError);
    await expect(client.validateCredentials()).rejects.toThrow(/Unauthorized/);
  });

  it('raises a CLI error when the response is malformed', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({
              message: 'missing fields'
            })
        })
    });

    await expect(client.validateCredentials()).rejects.toThrow(
      /unexpected response shape/i
    );
  });

  it('wraps network failures in an actionable CLI error', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () => Promise.reject(new Error('dns failure'))
    });

    await expect(client.validateCredentials()).rejects.toThrow(
      /could not be completed/i
    );
  });
});
