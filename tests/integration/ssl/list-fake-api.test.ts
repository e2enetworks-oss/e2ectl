import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('ssl list against a fake MyAccount API', () => {
  it('lists SSL certificate IDs as deterministic JSON', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ssl/import-certificate/': () => ({
        body: {
          code: 200,
          data: [
            {
              id: 123,
              ssl_cert_name: 'api-cert',
              ssl_certificate_type: 'CUSTOM',
              status: 'ACTIVE',
              common_name: 'api.example.com',
              expiry_date: '2027-01-01'
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'ssl', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        stableStringify({
          action: 'list',
          items: [
            {
              id: 123,
              name: 'api-cert',
              ssl_certificate_type: 'CUSTOM',
              status: 'ACTIVE',
              common_name: 'api.example.com',
              expiry_date: '2027-01-01',
              created_at: null
            }
          ]
        }) + '\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
