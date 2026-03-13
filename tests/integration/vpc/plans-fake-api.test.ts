import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('vpc plans against a fake MyAccount API', () => {
  it('reads the backend discovery endpoint and emits clean billing sections', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/vpc/plans/': () => ({
        body: {
          code: 200,
          data: [
            {
              committed_sku: [
                {
                  committed_days: 30,
                  committed_sku_id: 31,
                  committed_sku_name: '30 Days',
                  committed_sku_price: 3000
                },
                {
                  committed_days: 90,
                  committed_sku_id: 91,
                  committed_sku_name: '90 Days',
                  committed_sku_price: 7800
                }
              ],
              currency: 'INR',
              location: 'Delhi',
              name: 'VPC',
              price_per_hour: 4.79,
              price_per_month: 3500
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

      const result = await runBuiltCli(['--json', 'vpc', 'plans'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'plans',
          committed: {
            default_post_commit_behavior: 'auto-renew',
            items: [
              {
                currency: 'INR',
                effective_price_per_hour: 4.11,
                id: 31,
                name: '30 Days',
                term_days: 30,
                total_price: 3000
              },
              {
                currency: 'INR',
                effective_price_per_hour: 3.56,
                id: 91,
                name: '90 Days',
                term_days: 90,
                total_price: 7800
              }
            ],
            supported_post_commit_behaviors: ['auto-renew', 'hourly-billing']
          },
          hourly: {
            items: [
              {
                currency: 'INR',
                location: 'Delhi',
                name: 'VPC',
                price_per_hour: 4.79,
                price_per_month: 3500
              }
            ]
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/vpc/plans/',
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
