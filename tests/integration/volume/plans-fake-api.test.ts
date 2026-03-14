import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('volume plans against a fake MyAccount API', () => {
  it('reads the backend discovery endpoint and emits grouped plan data', async () => {
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
            },
            {
              available_inventory_status: false,
              bs_size: 1,
              committed_sku: [],
              currency: 'INR',
              iops: 15000,
              name: '1 TB',
              price: 5
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

      const result = await runBuiltCli(['--json', 'volume', 'plans'], {
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
          filters: {
            available_only: false,
            size_gb: null
          },
          items: [
            {
              available: true,
              committed_options: [
                {
                  id: 31,
                  name: '30 Days Committed',
                  savings_percent: 18.78,
                  term_days: 30,
                  total_price: 1000
                }
              ],
              currency: 'INR',
              hourly_price: 1.71,
              iops: 5000,
              size_gb: 250
            },
            {
              available: false,
              committed_options: [],
              currency: 'INR',
              hourly_price: 6.85,
              iops: 15000,
              size_gb: 1000
            }
          ],
          total_count: 2
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/block_storage/plans/',
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

  it('filters volume plans to one available size in deterministic json mode', async () => {
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
            },
            {
              available_inventory_status: false,
              bs_size: 1,
              committed_sku: [],
              currency: 'INR',
              iops: 15000,
              name: '1 TB',
              price: 5
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

      const result = await runBuiltCli(
        ['--json', 'volume', 'plans', '--size', '250', '--available-only'],
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
          action: 'plans',
          filters: {
            available_only: true,
            size_gb: 250
          },
          items: [
            {
              available: true,
              committed_options: [
                {
                  id: 31,
                  name: '30 Days Committed',
                  savings_percent: 18.78,
                  term_days: 30,
                  total_price: 1000
                }
              ],
              currency: 'INR',
              hourly_price: 1.71,
              iops: 5000,
              size_gb: 250
            }
          ],
          total_count: 1
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/block_storage/plans/',
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
