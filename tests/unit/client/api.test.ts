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

  it('serializes a public-node create request that matches backend serializer expectations', async () => {
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
            data: {
              node_create_response: [],
              total_number_of_node_created: 1,
              total_number_of_node_requested: 1
            },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.createNode({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'node-a',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });

    expect(seenInput).toBe(
      'https://example.test/nodes/?apikey=api-key&project_id=123&location=Delhi'
    );
    expect(seenInit?.method).toBe('POST');
    expect(seenInit?.headers).toMatchObject({
      Authorization: 'Bearer auth-token',
      'Content-Type': 'application/json'
    });
    expect(typeof seenInit?.body).toBe('string');
    const body = JSON.parse(seenInit?.body as string) as Record<
      string,
      unknown
    >;

    expect(body).toMatchObject({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'node-a',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(body).not.toHaveProperty('security_group_id');
    expect(body).not.toHaveProperty('vpc_id');
    expect(body).not.toHaveProperty('subnet_id');
    expect(body).not.toHaveProperty('reserve_ip');
    expect(body).not.toHaveProperty('reserve_ip_pool');
    expect(body).not.toHaveProperty('image_id');
    expect(body).not.toHaveProperty('disk');
    expect(body).not.toHaveProperty('is_encryption_required');
    expect(body).not.toHaveProperty('isEncryptionEnabled');
    expect(body).not.toHaveProperty('saved_image_template_id');
  });

  it('requests the OS catalog from the docs-backed discovery path', async () => {
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
            data: {
              category_list: []
            },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.listNodeCatalogOs();

    expect(seenInput).toBe(
      'https://example.test/images/os-category/?apikey=api-key&project_id=123&location=Delhi'
    );
  });

  it('serializes catalog plan queries with the required filters', async () => {
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
            data: [],
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.listNodeCatalogPlans({
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });

    expect(seenInput).toBe(
      'https://example.test/images/?apikey=api-key&project_id=123&location=Delhi&category=Ubuntu&display_category=Linux+Virtual+Node&os=Ubuntu&osversion=24.04'
    );
  });

  it('issues delete requests against the node resource path', async () => {
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
            data: {},
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.deleteNode('101');

    expect(seenInput).toBe(
      'https://example.test/nodes/101/?apikey=api-key&project_id=123&location=Delhi'
    );
    expect(seenInit?.method).toBe('DELETE');
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
