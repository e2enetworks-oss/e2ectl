import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildCatalogResponse(options?: {
  families?: [string | undefined, string | undefined];
  includeCommittedOnFirst?: boolean;
}) {
  return {
    code: 200,
    data: [
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        location: 'Delhi',
        name: 'C3.4GB',
        os: {
          category: 'Ubuntu',
          image: 'Ubuntu-24.04-Distro',
          name: 'Ubuntu',
          version: '24.04'
        },
        plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
        specs: {
          committed_sku: [],
          cpu: 2,
          disk_space: 50,
          ...(options?.families?.[0] === undefined
            ? {}
            : { family: options.families[0] }),
          minimum_billing_amount: 0,
          price_per_hour: 1.8,
          price_per_month: 1321,
          ram: '4.00',
          series: 'C3',
          sku_name: 'C3.4GB'
        }
      },
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        location: 'Delhi',
        name: 'C3.8GB',
        os: {
          category: 'Ubuntu',
          image: 'Ubuntu-24.04-Distro',
          name: 'Ubuntu',
          version: '24.04'
        },
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
        specs: {
          committed_sku:
            options?.includeCommittedOnFirst === false
              ? []
              : [
                  {
                    committed_days: 90,
                    committed_sku_id: 2711,
                    committed_sku_name: '90 Days Committed , Rs. 6026.0',
                    committed_sku_price: 6026
                  }
                ],
          cpu: 4,
          disk_space: 100,
          ...(options?.families?.[1] === undefined
            ? {}
            : { family: options.families[1] }),
          minimum_billing_amount: 0,
          price_per_hour: 3.1,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3',
          sku_name: 'C3.8GB'
        }
      }
    ],
    errors: {},
    message: 'OK'
  };
}

describe('node catalog plans against a fake MyAccount API', () => {
  it('passes the selected OS query and emits grouped deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/': () => ({
        body: buildCatalogResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'catalog',
          'plans',
          '--display-category',
          'Linux Virtual Node',
          '--category',
          'Ubuntu',
          '--os',
          'Ubuntu',
          '--os-version',
          '24.04',
          '--billing-type',
          'all'
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
          action: 'catalog-plans',
          items: [
            {
              available_inventory: true,
              committed_options: [],
              config: {
                disk_gb: 50,
                family: null,
                ram: '4.00',
                series: 'C3',
                vcpu: 2
              },
              currency: 'INR',
              hourly: {
                minimum_billing_amount: 0,
                price_per_hour: 1.8,
                price_per_month: 1321
              },
              image: 'Ubuntu-24.04-Distro',
              plan: 'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi',
              row: 1,
              sku: 'C3.4GB'
            },
            {
              available_inventory: true,
              committed_options: [
                {
                  days: 90,
                  id: 2711,
                  name: '90 Days Committed , Rs. 6026.0',
                  total_price: 6026
                }
              ],
              config: {
                disk_gb: 100,
                family: null,
                ram: '8.00',
                series: 'C3',
                vcpu: 4
              },
              currency: 'INR',
              hourly: {
                minimum_billing_amount: 0,
                price_per_hour: 3.1,
                price_per_month: 2263
              },
              image: 'Ubuntu-24.04-Distro',
              plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
              row: 2,
              sku: 'C3.8GB'
            }
          ],
          query: {
            billing_type: 'all',
            category: 'Ubuntu',
            display_category: 'Linux Virtual Node',
            os: 'Ubuntu',
            osversion: '24.04'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/images/',
        query: {
          apikey: 'prod-api-key',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          location: 'Delhi',
          os: 'Ubuntu',
          osversion: '24.04',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('filters the json output down to configs with committed options', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/': () => ({
        body: buildCatalogResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'catalog',
          'plans',
          '--display-category',
          'Linux Virtual Node',
          '--category',
          'Ubuntu',
          '--os',
          'Ubuntu',
          '--os-version',
          '24.04',
          '--billing-type',
          'committed'
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
      expect(result.stdout).toContain('"billing_type": "committed"');
      expect(result.stdout).toContain('"committed_options": [');
      expect(result.stdout).not.toContain(
        'C3-2vCPU-4RAM-50DISK-C3.4GB-Ubuntu-24.04-Delhi'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders hourly-only human guidance without the committed section', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/': () => ({
        body: buildCatalogResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'node',
          'catalog',
          'plans',
          '--display-category',
          'Linux Virtual Node',
          '--category',
          'Ubuntu',
          '--os',
          'Ubuntu',
          '--os-version',
          '24.04',
          '--billing-type',
          'hourly'
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
      expect(result.stdout).toContain(
        'Filters: OS=Ubuntu 24.04, Billing=hourly'
      );
      expect(result.stdout).toContain('Candidate Configs');
      expect(result.stdout).toContain('Create hourly from config #1:');
      expect(result.stdout).not.toContain('Committed Options by Config');
      expect(result.stdout).not.toContain('--billing-type committed');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('shows the empty committed-state message when all is requested but no committed plans exist', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/': () => ({
        body: buildCatalogResponse({
          includeCommittedOnFirst: false
        })
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'node',
          'catalog',
          'plans',
          '--display-category',
          'Linux Virtual Node',
          '--category',
          'Ubuntu',
          '--os',
          'Ubuntu',
          '--os-version',
          '24.04',
          '--billing-type',
          'all'
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
      expect(result.stdout).toContain('Committed Options by Config');
      expect(result.stdout).toContain(
        'No committed options found for the selected configs.'
      );
      expect(result.stdout).toContain('Create hourly from config #1:');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('keeps family filtering client-side and returns an empty json item list when nothing matches', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/': () => ({
        body: buildCatalogResponse({
          families: ['Compute Intensive', 'General Purpose']
        })
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'catalog',
          'plans',
          '--display-category',
          'Linux Virtual Node',
          '--category',
          'Ubuntu',
          '--os',
          'Ubuntu',
          '--os-version',
          '24.04',
          '--family',
          'Memory Optimized'
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
          action: 'catalog-plans',
          items: [],
          query: {
            billing_type: 'all',
            category: 'Ubuntu',
            display_category: 'Linux Virtual Node',
            family: 'Memory Optimized',
            os: 'Ubuntu',
            osversion: '24.04'
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/images/',
        query: {
          apikey: 'prod-api-key',
          category: 'Ubuntu',
          display_category: 'Linux Virtual Node',
          location: 'Delhi',
          os: 'Ubuntu',
          osversion: '24.04',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
