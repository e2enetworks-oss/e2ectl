import { TIR_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome, type TempHome } from '../../helpers/temp-home.js';

async function seedConfiguredProfile(tempHome: TempHome): Promise<void> {
  await tempHome.writeConfig({
    default: 'work',
    profiles: {
      work: {
        api_key: 'work-key',
        auth_token: 'work-token',
        default_location: 'Chennai',
        default_project_id: '555',
        tir: { account_id: '1234', location: 'Delhi', project_id: '91011' }
      }
    }
  });
}

describe('tir image and plan lists against a fake TIR API', () => {
  it('lists image versions and the plans for one of them in the saved TIR context', async () => {
    const server = await startTestHttpServer({
      'GET /gpu/gpu_service/image/': () => ({
        body: {
          code: 200,
          data: [
            {
              image_id: 2,
              name: 'PyTorch',
              versions: [
                {
                  app: { name: 'jupyter_labs' },
                  description: 'PyTorch 2.8',
                  image_version_id: 65,
                  is_internal: false,
                  version: 'v2.8'
                }
              ]
            }
          ],
          errors: {},
          message: 'Success'
        }
      }),
      'GET /gpu/gpu_service/sku/': () => ({
        body: {
          code: 200,
          data: {
            CPU: [
              {
                cpu: '4',
                gpu: null,
                gpu_card_type: null,
                is_inventory_available: true,
                memory: '8GB',
                name: 'C3.8GB',
                plans: [
                  {
                    currency: 'INR',
                    sku_item_price_id: 1565,
                    sku_type: 'hourly',
                    unit_price: 4.7
                  }
                ],
                series: 'CPU'
              }
            ],
            is_cpu_supported: true
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();
    const env = {
      HOME: tempHome.path,
      [TIR_BASE_URL_ENV_VAR]: `${server.baseUrl}/gpu`
    };

    try {
      await seedConfiguredProfile(tempHome);

      const images = await runBuiltCli(['--json', 'tir', 'image', 'list'], {
        env
      });
      expect(images.exitCode).toBe(0);
      expect(JSON.parse(images.stdout)).toMatchObject({
        items: [{ image_name: 'PyTorch', version_id: 65 }]
      });

      const plans = await runBuiltCli(
        ['--json', 'tir', 'plan', 'list', '--image-version-id', '65'],
        { env }
      );
      expect(plans.exitCode).toBe(0);
      expect(JSON.parse(plans.stdout)).toMatchObject({
        image_version_id: 65,
        items: [
          { hourly: { plan_id: 1565, price: 4.7 }, name: 'C3.8GB', vcpu: 4 }
        ]
      });

      const planRequest = server.requests.find(
        (request) => request.pathname === '/gpu/gpu_service/sku/'
      );
      // The TIR context, never the MyAccount project 555 or Chennai.
      expect(planRequest?.query).toMatchObject({
        active_iam: '1234',
        image_version_id: '65',
        location: 'Delhi',
        project_id: '91011',
        service: 'notebook'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lets flags and E2E_TIR_* variables beat the saved TIR context', async () => {
    const server = await startTestHttpServer({
      'GET /gpu/gpu_service/image/': () => ({
        body: { code: 200, data: [], errors: {}, message: 'Success' }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedConfiguredProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'tir', 'image', 'list', '--project-id', '777'],
        {
          env: {
            E2E_TIR_LOCATION: 'Chennai',
            E2E_TIR_PROJECT_ID: '666',
            HOME: tempHome.path,
            [TIR_BASE_URL_ENV_VAR]: `${server.baseUrl}/gpu`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(server.requests[0]?.query).toMatchObject({
        active_iam: '1234',
        location: 'Chennai',
        project_id: '777'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('says to run tir configure when no TIR project is chosen', async () => {
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'work',
        profiles: {
          work: { api_key: 'k', auth_token: 't', tir: { account_id: '1234' } }
        }
      });

      const result = await runBuiltCli(['tir', 'plan', 'list'], {
        env: { HOME: tempHome.path }
      });

      expect(result.exitCode).toBe(4);
      expect(result.stderr).toContain('No TIR project chosen.');
      expect(result.stderr).toContain('e2ectl tir configure');
    } finally {
      await tempHome.cleanup();
    }
  });
});
