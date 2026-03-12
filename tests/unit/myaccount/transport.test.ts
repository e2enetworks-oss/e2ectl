import { CliError } from '../../../src/core/errors.js';
import { MyAccountApiTransport } from '../../../src/myaccount/transport.js';
import type { ApiEnvelope, FetchLike } from '../../../src/myaccount/types.js';

describe('MyAccountApiTransport', () => {
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

      return Promise.resolve(
        createFetchResponse(
          envelope({
            ok: true
          })
        )
      );
    });

    const transport = new MyAccountApiTransport(credentials, {
      baseUrl: 'https://example.test/root',
      fetchFn
    });

    await transport.get<ApiEnvelope<{ ok: boolean }>>('/nodes/', {
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

  it('omits project context when explicitly requested', async () => {
    let seenInput = '';

    const fetchFn = vi.fn((input: string) => {
      seenInput = input;

      return Promise.resolve(
        createFetchResponse(
          envelope({
            valid: true
          })
        )
      );
    });

    const transport = new MyAccountApiTransport(
      {
        api_key: 'api-key',
        auth_token: 'auth-token',
        source: 'profile'
      },
      {
        baseUrl: 'https://example.test/',
        fetchFn
      }
    );

    await transport.get<ApiEnvelope<{ valid: boolean }>>('/iam/multi-crn/', {
      includeProjectContext: false
    });

    expect(seenInput).toBe(
      'https://example.test/iam/multi-crn/?apikey=api-key'
    );
  });

  it('fails early when a project-scoped request has no resolved context', async () => {
    const transport = new MyAccountApiTransport(
      {
        api_key: 'api-key',
        auth_token: 'auth-token',
        source: 'profile'
      },
      {
        fetchFn: vi.fn()
      }
    );

    await expect(
      transport.get<ApiEnvelope<{ ok: boolean }>>('/nodes/')
    ).rejects.toThrow(/project context is required/i);
  });

  it('serializes JSON bodies for POST requests', async () => {
    let seenInput = '';
    let seenInit: RequestInit | undefined;

    const fetchFn = vi.fn((input: string, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;

      return Promise.resolve(createFetchResponse(envelope({ ok: true })));
    });

    const transport = new MyAccountApiTransport(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await transport.post<ApiEnvelope<{ ok: boolean }>>('/nodes/', {
      body: {
        image: 'Ubuntu-24.04-Distro',
        name: 'node-a',
        plan: 'plan-123'
      }
    });

    expect(seenInput).toBe(
      'https://example.test/nodes/?apikey=api-key&project_id=123&location=Delhi'
    );
    expect(seenInit?.method).toBe('POST');
    expect(seenInit?.headers).toMatchObject({
      Authorization: 'Bearer auth-token',
      'Content-Type': 'application/json'
    });
    expect(seenInit?.body).toBe(
      JSON.stringify({
        image: 'Ubuntu-24.04-Distro',
        name: 'node-a',
        plan: 'plan-123'
      })
    );
  });

  it('raises a CLI error when the API envelope indicates failure', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse(
            envelope(
              {},
              {
                code: 401,
                errors: {
                  auth: ['invalid']
                },
                message: 'Unauthorized'
              }
            )
          )
        )
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toBeInstanceOf(CliError);
    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toThrow(/Unauthorized/);
  });

  it('raises a CLI error when the response is malformed', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse({
            message: 'missing fields'
          })
        )
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toThrow(/unexpected response shape/i);
  });

  it('extracts a DRF-style detail message from failed API responses', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse(undefined, {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () =>
              Promise.resolve({
                detail: 'Authentication credentials were not provided.'
              })
          })
        )
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toThrow(/Authentication credentials were not provided/i);
  });

  it('extracts message and status_code from non-envelope API failures', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse(undefined, {
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: () =>
              Promise.resolve({
                status_code: 400,
                message: 'Project not found'
              })
          })
        )
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toThrow(/Project not found/i);
  });

  it('treats a 200 response with errors=true as an API failure', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse(undefined, {
            json: () =>
              Promise.resolve({
                errors: true,
                message: 'Validation failed'
              })
          })
        )
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toThrow(/Validation failed/i);
  });

  it('uses a short response preview for non-json failed responses', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse(undefined, {
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            json: () => Promise.reject(new SyntaxError('Unexpected token <')),
            text: () =>
              Promise.resolve('<html><body>502 Bad Gateway</body></html>')
          })
        )
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toMatchObject({
      details: expect.arrayContaining([
        expect.stringContaining('HTTP status: 502 Bad Gateway'),
        expect.stringContaining(
          'Response preview: <html><body>502 Bad Gateway</body></html>'
        )
      ]),
      message: expect.stringContaining('Unexpected API error')
    });
  });

  it('wraps network failures in an actionable CLI error', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () => Promise.reject(new Error('dns failure'))
    });

    await expect(
      transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
        includeProjectContext: false
      })
    ).rejects.toThrow(/could not be completed/i);
  });
});

function envelope<TData>(
  data: TData,
  overrides: Partial<ApiEnvelope<TData>> = {}
): ApiEnvelope<TData> {
  return {
    code: overrides.code ?? 200,
    data,
    errors: overrides.errors ?? {},
    message: overrides.message ?? 'Success'
  };
}

function createFetchResponse(
  payload: unknown,
  overrides: Partial<Awaited<ReturnType<FetchLike>>> = {}
): Awaited<ReturnType<FetchLike>> {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? 'OK',
    json: overrides.json ?? (() => Promise.resolve(payload)),
    ...(overrides.text === undefined ? {} : { text: overrides.text })
  };
}
