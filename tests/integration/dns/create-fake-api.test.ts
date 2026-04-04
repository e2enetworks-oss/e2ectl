import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dns create against a fake MyAccount API', () => {
  it('validates locally, sends the documented body, and preserves requested values in output', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/e2e_dns/forward/': () => ({
        body: {
          code: 200,
          data: {
            id: 10279,
            message: 'The domain was created successfully!',
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
        ['--json', 'dns', 'create', 'Example.COM', '--ip', '1.1.1.1'],
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
          action: 'create',
          domain: {
            id: 10279
          },
          message: 'The domain was created successfully!',
          requested: {
            domain_name: 'Example.COM',
            ip_address: '1.1.1.1'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/e2e_dns/forward/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        domain_name: 'example.com.',
        ip_addr: '1.1.1.1'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('rejects invalid IPv4 input before any network request', async () => {
    const result = await runBuiltCli([
      'dns',
      'create',
      'example.com',
      '--ip',
      'bad-ip'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: IP address must be a valid IPv4 address.\n\nNext step: Pass a valid IPv4 address like 164.52.198.54 with --ip.\n'
    );
  });
});
