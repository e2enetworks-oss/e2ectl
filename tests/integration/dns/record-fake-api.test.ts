import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dns record and nameserver flows against a fake MyAccount API', () => {
  it('combines configured zone NS records with delegated nameserver diagnostics', async () => {
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
                      content: 'ns50.e2enetworks.net.in.',
                      disabled: false
                    },
                    {
                      content: 'ns51.e2enetworks.net.in.',
                      disabled: false
                    }
                  ],
                  ttl: 86400,
                  type: 'NS'
                }
              ]
            },
            domain_ip: '1.1.1.1',
            domain_name: 'example.com.'
          },
          errors: {},
          message: 'Success'
        }
      }),
      'GET /myaccount/api/v1/e2e_dns/diagnostics/verify_ns/example.com./':
        () => ({
          body: {
            code: 200,
            data: {
              data: {
                authority: false,
                e2e_nameservers: [
                  'ns50.e2enetworks.net.in.',
                  'ns51.e2enetworks.net.in.'
                ],
                gl_nameservers: ['ns1.example.net.', 'ns2.example.net.'],
                problem: 1
              },
              message: 'Your nameservers are not setup correctly',
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
        ['--json', 'dns', 'nameservers', 'Example.com'],
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
          action: 'nameservers',
          authority_match: false,
          configured_nameservers: [
            'ns50.e2enetworks.net.in.',
            'ns51.e2enetworks.net.in.'
          ],
          delegated_nameservers: ['ns1.example.net.', 'ns2.example.net.'],
          domain_name: 'example.com.',
          message: 'Your nameservers are not setup correctly',
          problem: 1,
          status: true
        })}\n`
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]?.pathname).toBe(
        '/myaccount/api/v1/e2e_dns/forward/example.com./'
      );
      expect(server.requests[1]?.pathname).toBe(
        '/myaccount/api/v1/e2e_dns/diagnostics/verify_ns/example.com./'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lists records by flattening rrsets and excluding SOA and NS', async () => {
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
                      content: 'ignored',
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
                      content: 'ns50.e2enetworks.net.in.',
                      disabled: false
                    }
                  ],
                  ttl: 86400,
                  type: 'NS'
                },
                {
                  name: 'www.example.com.',
                  records: [
                    {
                      content: '1.1.1.1',
                      disabled: false
                    },
                    {
                      content: '1.1.1.2',
                      disabled: false
                    }
                  ],
                  ttl: 300,
                  type: 'A'
                },
                {
                  name: 'example.com.',
                  records: [
                    {
                      content: '"hello world"',
                      disabled: false
                    }
                  ],
                  ttl: 600,
                  type: 'TXT'
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
        ['--json', 'dns', 'record', 'list', 'Example.com'],
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
          action: 'record-list',
          domain_name: 'example.com.',
          items: [
            {
              disabled: false,
              name: 'www.example.com.',
              ttl: 300,
              type: 'A',
              value: '1.1.1.1'
            },
            {
              disabled: false,
              name: 'www.example.com.',
              ttl: 300,
              type: 'A',
              value: '1.1.1.2'
            },
            {
              disabled: false,
              name: 'example.com.',
              ttl: 600,
              type: 'TXT',
              value: 'hello world'
            }
          ]
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('creates forward records on the detail endpoint with normalized request bodies', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/e2e_dns/forward/example.com./': () => ({
        body: {
          code: 200,
          data: {
            message: 'The record was added successfully!',
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
        [
          '--json',
          'dns',
          'record',
          'create',
          'Example.com',
          '--type',
          'SRV',
          '--name',
          '_sip._tcp',
          '--priority',
          '10',
          '--weight',
          '5',
          '--port',
          '443',
          '--target',
          'Service.Example.NET'
        ],
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
          action: 'record-create',
          domain_name: 'example.com.',
          message: 'The record was added successfully!',
          record: {
            name: '_sip._tcp.example.com.',
            ttl: null,
            type: 'SRV',
            value: '10 5 443 service.example.net.'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/e2e_dns/forward/example.com./',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        content: '10 5 443 service.example.net.',
        record_name: '_sip._tcp.example.com.',
        record_type: 'SRV',
        zone_name: 'example.com.'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('updates records using exact current-value matching and preserves the existing TTL when omitted', async () => {
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
                      content: '"old text"',
                      disabled: false
                    }
                  ],
                  ttl: 600,
                  type: 'TXT'
                }
              ]
            },
            domain_ip: '1.1.1.1',
            domain_name: 'example.com.'
          },
          errors: {},
          message: 'Success'
        }
      }),
      'PUT /myaccount/api/v1/e2e_dns/forward/example.com./': () => ({
        body: {
          code: 200,
          data: {
            message: 'The record was updated successfully!',
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
        [
          '--json',
          'dns',
          'record',
          'update',
          'Example.com',
          '--type',
          'TXT',
          '--current-value',
          'old text',
          '--value',
          'new text'
        ],
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
          action: 'record-update',
          domain_name: 'example.com.',
          message: 'The record was updated successfully!',
          record: {
            current_value: 'old text',
            name: 'example.com.',
            new_value: 'new text',
            ttl: 600,
            type: 'TXT'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]?.method).toBe('GET');
      expect(server.requests[1]?.method).toBe('PUT');
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        new_record_content: '"new text"',
        new_record_ttl: 600,
        old_record_content: '"old text"',
        record_name: 'example.com.',
        record_type: 'TXT',
        zone_name: 'example.com.'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('verifies exact record existence before deleting and sends the detail delete body only after the precheck', async () => {
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
                      content: '1.1.1.1',
                      disabled: false
                    }
                  ],
                  ttl: 300,
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
      }),
      'DELETE /myaccount/api/v1/e2e_dns/forward/example.com./': () => ({
        body: {
          code: 200,
          data: {
            message: 'The custom Reverse DNS record was deleted successfully!',
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
        [
          '--json',
          'dns',
          'record',
          'delete',
          'Example.com',
          '--type',
          'A',
          '--value',
          '1.1.1.1',
          '--force'
        ],
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
          action: 'record-delete',
          cancelled: false,
          domain_name: 'example.com.',
          message: 'The record was deleted successfully!',
          record: {
            name: 'example.com.',
            type: 'A',
            value: '1.1.1.1'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]?.method).toBe('GET');
      expect(server.requests[1]?.method).toBe('DELETE');
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        content: '1.1.1.1',
        record_name: 'example.com.',
        record_type: 'A',
        zone_name: 'example.com.'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails before the delete request when the exact record value is missing', async () => {
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
                      content: '1.1.1.1',
                      disabled: false
                    }
                  ],
                  ttl: 300,
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
      }),
      'DELETE /myaccount/api/v1/e2e_dns/forward/example.com./': () => ({
        body: {
          code: 200,
          data: {
            message: 'unexpected',
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
        [
          'dns',
          'record',
          'delete',
          'Example.com',
          '--type',
          'A',
          '--value',
          '2.2.2.2',
          '--force'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: DNS record A example.com. with value 2.2.2.2 was not found in example.com..\n\nNext step: Run e2ectl dns record list example.com. and retry with the exact current value via --value.\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.method).toBe('GET');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
