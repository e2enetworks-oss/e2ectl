import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildPlansResponse() {
  return {
    code: 200,
    data: [
      {
        appliance_config: [
          {
            committed_sku: [
              {
                committed_days: 90,
                committed_sku_id: 901,
                committed_sku_name: '90 Days',
                committed_sku_price: 5000
              }
            ],
            disk: 50,
            hourly: 3,
            name: 'LB-2',
            price: 2000,
            ram: 4,
            template_id: 'plan-1',
            vcpu: 2
          }
        ]
      }
    ],
    errors: {},
    message: 'OK'
  };
}

describe('lb plans against a fake MyAccount API', () => {
  it('emits committed plan data in deterministic JSON', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'lb', 'plans'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        stableStringify({
          action: 'plans',
          items: [
            {
              committed_sku: [
                {
                  committed_days: 90,
                  committed_node_message: null,
                  committed_sku_id: 901,
                  committed_sku_name: '90 Days',
                  committed_sku_price: 5000,
                  committed_upto_date: null
                }
              ],
              disk: 50,
              hourly: 3,
              name: 'LB-2',
              price: 2000,
              ram: 4,
              template_id: 'plan-1',
              vcpu: 2
            }
          ]
        }) + '\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders the base plans and committed options in human-readable tables', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['lb', 'plans'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Base Plans');
      expect(result.stdout).toContain('Committed Options');
      expect(result.stdout).toContain('90 Days');
      expect(result.stdout).toContain('901');
      expect(result.stdout).toContain('Price/Month');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
