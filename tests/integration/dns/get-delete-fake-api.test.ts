import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dns get/delete against a fake MyAccount API', () => {
  it('gets one domain through the dedicated detail endpoint and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/e2e_dns/forward/example.com./': () => ({
        body: {
          code: 200,
          data: {
            DOMAIN_TTL: 86400,
            domain: {
              rrsets: [
                {
                  name: 'example.com.',
                  records: [
                    {
                      content:
                        'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in. 2024110404 10800 3600 604800 86400',
                      disabled: false
                    }
                  ],
                  ttl: 86400,
                  type: 'SOA'
                },
                {
                  name: 'example.com.',
                  records: [
                    {
                      content: '1.1.1.1',
                      disabled: false
                    }
                  ],
                  ttl: 86400,
                  type: 'A'
                }
              ]
            },
            domain_ip: '1.1.1.1',
            domain_name: 'example.com.'
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'dns', 'get', 'EXAMPLE.com'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'get',
          domain: {
            domain_name: 'example.com.',
            domain_ttl: 86400,
            ip_address: '1.1.1.1',
            rrsets: [
              {
                name: 'example.com.',
                records: [
                  {
                    content:
                      'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in. 2024110404 10800 3600 604800 86400',
                    disabled: false
                  }
                ],
                ttl: 86400,
                type: 'SOA'
              },
              {
                name: 'example.com.',
                records: [
                  {
                    content: '1.1.1.1',
                    disabled: false
                  }
                ],
                ttl: 86400,
                type: 'A'
              }
            ]
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/e2e_dns/forward/example.com./'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('resolves domain_id from list and deletes with --force without exposing it publicly', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/e2e_dns/forward/': () => ({
        body: {
          code: 200,
          data: [
            {
              created_at: '2024-11-04T09:01:30.545588Z',
              deleted: false,
              domain_ip: '1.1.1.1',
              domain_name: 'example.com.',
              id: 10279,
              validity: null
            }
          ],
          errors: {},
          message: 'Success'
        }
      }),
      'DELETE /myaccount/api/v1/e2e_dns/forward/': () => ({
        body: {
          code: 200,
          data: {
            message: 'The domain was deleted successfully',
            status: true
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'dns', 'delete', 'Example.com', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'delete',
          cancelled: false,
          domain_name: 'example.com.',
          message: 'The domain was deleted successfully'
        })}\n`
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/e2e_dns/forward/'
      });
      expect(server.requests[1]).toMatchObject({
        method: 'DELETE',
        pathname: '/myaccount/api/v1/e2e_dns/forward/',
        query: {
          apikey: 'prod-api-key',
          domain_id: '10279',
          location: 'Delhi',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly when delete cannot find an exact canonical match before the delete request', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/e2e_dns/forward/': () => ({
        body: {
          code: 200,
          data: [
            {
              created_at: '2024-11-04T09:01:30.545588Z',
              deleted: false,
              domain_ip: '1.1.1.1',
              domain_name: 'other.com.',
              id: 10280,
              validity: null
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['dns', 'delete', 'example.com', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: DNS domain example.com. was not found.\n\nNext step: Run e2ectl dns list to inspect available DNS domains, then retry with an exact domain name.\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.method).toBe('GET');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails in non-interactive mode when delete omits --force before any network request', async () => {
    const result = await runBuiltCli(['dns', 'delete', 'example.com']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Deleting a DNS domain requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
    );
  });
});
