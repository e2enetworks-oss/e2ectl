import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('volume create against a fake MyAccount API', () => {
  it('derives iops from plans and sends committed billing fields to the backend', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/block_storage/plans/': () => ({
        body: {
          code: 200,
          data: [
            {
              available_inventory_status: true,
              bs_size: 0.25,
              committed_sku: [
                {
                  committed_days: 30,
                  committed_sku_id: 31,
                  committed_sku_name: '30 Days Committed , INR 1000',
                  committed_sku_price: 1000
                }
              ],
              currency: 'INR',
              iops: 5000,
              name: '250 GB',
              price: 5
            }
          ],
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/block_storage/': () => ({
        body: {
          code: 201,
          data: {
            id: 25550,
            image_name: 'data-01'
          },
          errors: {},
          message: 'Created Successfully'
        },
        status: 201
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'volume',
          'create',
          '--name',
          'data-01',
          '--size',
          '250',
          '--billing-type',
          'committed',
          '--committed-plan-id',
          '31',
          '--post-commit-behavior',
          'hourly-billing'
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
          action: 'create',
          billing: {
            committed_plan: {
              id: 31,
              name: '30 Days Committed',
              savings_percent: 18.78,
              term_days: 30,
              total_price: 1000
            },
            post_commit_behavior: 'hourly-billing',
            type: 'committed'
          },
          requested: {
            name: 'data-01',
            size_gb: 250
          },
          resolved_plan: {
            available: true,
            currency: 'INR',
            hourly_price: 1.71,
            iops: 5000,
            size_gb: 250
          },
          volume: {
            id: 25550,
            name: 'data-01'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/block_storage/plans/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(server.requests[1]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/block_storage/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        cn_id: 31,
        cn_status: 'hourly_billing',
        iops: 5000,
        name: 'data-01',
        size: 250
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
