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

  it('retries GET once on retryable 5xx responses and succeeds', async () => {
    vi.useFakeTimers();

    const fetchFn = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        createFetchResponse(undefined, {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () =>
            Promise.resolve({
              message: 'Temporary upstream issue'
            })
        })
      )
      .mockResolvedValueOnce(
        createFetchResponse(
          envelope({
            ok: true
          })
        )
      );

    const transport = new MyAccountApiTransport(credentials, {
      fetchFn
    });

    const request = transport.get<ApiEnvelope<{ ok: boolean }>>(
      '/iam/multi-crn/',
      {
        includeProjectContext: false
      }
    );

    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual(
      envelope({
        ok: true
      })
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries GET once on network failures and succeeds', async () => {
    vi.useFakeTimers();

    const fetchFn = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new Error('dns failure'))
      .mockResolvedValueOnce(
        createFetchResponse(
          envelope({
            ok: true
          })
        )
      );

    const transport = new MyAccountApiTransport(credentials, {
      fetchFn
    });

    const request = transport.get<ApiEnvelope<{ ok: boolean }>>(
      '/iam/multi-crn/',
      {
        includeProjectContext: false
      }
    );

    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual(
      envelope({
        ok: true
      })
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
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

  it.each([401, 403])(
    'does not retry GET requests on %s auth failures',
    async (status) => {
      const fetchFn = vi.fn<FetchLike>(() =>
        Promise.resolve(
          createFetchResponse(undefined, {
            ok: false,
            status,
            statusText: status === 401 ? 'Unauthorized' : 'Forbidden',
            json: () =>
              Promise.resolve({
                detail: 'Authentication credentials were not provided.'
              })
          })
        )
      );

      const transport = new MyAccountApiTransport(credentials, {
        fetchFn
      });

      await expect(
        transport.get<ApiEnvelope<Record<string, never>>>('/iam/multi-crn/', {
          includeProjectContext: false
        })
      ).rejects.toThrow(/Authentication credentials were not provided/i);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  );

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

  it('does not retry POST requests on retryable 5xx responses', async () => {
    const fetchFn = vi.fn<FetchLike>(() =>
      Promise.resolve(
        createFetchResponse(undefined, {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () =>
            Promise.resolve({
              message: 'Temporary upstream issue'
            })
        })
      )
    );

    const transport = new MyAccountApiTransport(credentials, {
      fetchFn
    });

    await expect(
      transport.post<ApiEnvelope<Record<string, never>>>('/nodes/', {
        body: {
          name: 'node-a'
        }
      })
    ).rejects.toThrow(/Temporary upstream issue/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('redacts apikey values from request-url error details', async () => {
    vi.useFakeTimers();

    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () => Promise.reject(new Error('socket hang up'))
    });

    const request =
      transport.get<ApiEnvelope<Record<string, never>>>('/nodes/');
    const errorPromise = request.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(250);

    const error = await errorPromise;

    expect(error).toBeInstanceOf(CliError);
    const cliError = error as CliError;

    expect(cliError.details.join('\n')).toContain('Request URL: ');
    expect(cliError.details.join('\n')).toContain('apikey=%5BREDACTED%5D');
    expect(cliError.details.join('\n')).not.toContain('apikey=api-key');
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
    vi.useFakeTimers();

    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () => Promise.reject(new Error('dns failure'))
    });

    const request = transport.get<ApiEnvelope<Record<string, never>>>(
      '/iam/multi-crn/',
      {
        includeProjectContext: false
      }
    );
    const assertion = expect(request).rejects.toThrow(
      /could not be completed/i
    );

    await vi.advanceTimersByTimeAsync(250);

    await assertion;
  });

  it('supports endpoint-specific success parsing for future non-envelope domains', async () => {
    const transport = new MyAccountApiTransport(credentials, {
      fetchFn: () =>
        Promise.resolve(
          createFetchResponse({
            items: [
              {
                id: 'vol-1',
                name: 'primary-volume'
              }
            ]
          })
        )
    });

    const result = await transport.get<Array<{ id: string; name: string }>>(
      '/volumes/',
      {
        parseResponse: (payload) => {
          if (!isRecord(payload) || !isNamedItemArray(payload.items)) {
            throw new Error('Expected an items array with id/name entries.');
          }

          return payload.items;
        }
      }
    );

    expect(result).toEqual([
      {
        id: 'vol-1',
        name: 'primary-volume'
      }
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNamedItemArray(
  value: unknown
): value is Array<{ id: string; name: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string'
    )
  );
}
