import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('dns list against a fake MyAccount API', () => {
  it('uses the forward DNS list endpoint and emits normalized deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/e2e_dns/forward/': () => ({
        body: {
          code: 200,
          data: [
            {
              created_at: '2024-11-04T09:01:30.545588Z',
              deleted: false,
              domain_ip: '2.2.2.2',
              domain_name: 'Zeta.com.',
              id: 22,
              validity: null
            },
            {
              created_at: '2024-11-04T08:01:30.545588Z',
              deleted: false,
              domain_ip: '1.1.1.1',
              domain_name: 'alpha.com.',
              id: 11,
              validity: '2026-05-01'
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

      const result = await runBuiltCli(['--json', 'dns', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'list',
          items: [
            {
              created_at: '2024-11-04T08:01:30.545588Z',
              deleted: false,
              domain_name: 'alpha.com.',
              id: 11,
              ip_address: '1.1.1.1',
              validity: '2026-05-01'
            },
            {
              created_at: '2024-11-04T09:01:30.545588Z',
              deleted: false,
              domain_name: 'zeta.com.',
              id: 22,
              ip_address: '2.2.2.2',
              validity: null
            }
          ]
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/e2e_dns/forward/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
