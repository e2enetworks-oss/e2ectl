import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dns verify against a fake MyAccount API', () => {
  it('verifies nameservers through the backend endpoint and normalizes nameserver fields', async () => {
    const server = await startTestHttpServer({
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
        ['--json', 'dns', 'verify', 'ns', 'EXAMPLE.com'],
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
          action: 'verify-ns',
          authority: false,
          domain_name: 'example.com.',
          e2e_nameservers: [
            'ns50.e2enetworks.net.in.',
            'ns51.e2enetworks.net.in.'
          ],
          global_nameservers: ['ns1.example.net.', 'ns2.example.net.'],
          message: 'Your nameservers are not setup correctly',
          problem: 1,
          status: true
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.pathname).toBe(
        '/myaccount/api/v1/e2e_dns/diagnostics/verify_ns/example.com./'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('verifies validity through the backend endpoint and normalizes validity fields', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/e2e_dns/diagnostics/verify_validity/example.com./':
        () => ({
          body: {
            code: 200,
            data: {
              data: {
                expiry_date: '2026-05-01',
                problem: 0,
                validity: true
              },
              message: 'Valid for 30 days',
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
        ['--json', 'dns', 'verify', 'validity', 'example.com.'],
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
          action: 'verify-validity',
          domain_name: 'example.com.',
          expiry_date: '2026-05-01',
          message: 'Valid for 30 days',
          problem: 0,
          status: true,
          validity_ok: true
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.pathname).toBe(
        '/myaccount/api/v1/e2e_dns/diagnostics/verify_validity/example.com./'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('verifies TTL through the backend endpoint and treats the response as a flat rrset array', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/e2e_dns/diagnostics/verify_ttl/example.com./':
        () => ({
          body: {
            code: 200,
            data: {
              data: [
                {
                  name: 'www.example.com.',
                  records: [
                    {
                      content: '1.1.1.1',
                      disabled: false
                    }
                  ],
                  ttl: 300,
                  type: 'A'
                }
              ],
              message: 'Error verifying TTL for your DNS records.',
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
        ['--json', 'dns', 'verify', 'ttl', 'EXAMPLE.com'],
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
          action: 'verify-ttl',
          domain_name: 'example.com.',
          low_ttl_count: 1,
          low_ttl_records: [
            {
              name: 'www.example.com.',
              records: [
                {
                  content: '1.1.1.1',
                  disabled: false
                }
              ],
              ttl: 300,
              type: 'A'
            }
          ],
          message: 'Error verifying TTL for your DNS records.',
          status: true
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.pathname).toBe(
        '/myaccount/api/v1/e2e_dns/diagnostics/verify_ttl/example.com./'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
