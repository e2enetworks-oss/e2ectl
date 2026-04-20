import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('image list against a fake MyAccount API', () => {
  it('lists saved images and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/saved-images/': () => ({
        body: {
          code: 200,
          data: [
            {
              creation_time: '2026-03-12T10:00:00Z',
              image_id: '1002',
              image_name: 'zeta-image',
              image_size: '45 GB',
              image_state: 'available',
              os_distribution: 'Ubuntu 24.04',
              running_vms: 2
            },
            {
              creation_time: '2026-03-11T09:00:00Z',
              image_id: '1001',
              image_name: 'alpha-image',
              image_size: '30 GB',
              image_state: 'available',
              is_windows: false,
              node_plans_available: true,
              os_distribution: 'CentOS 7',
              project_name: 'default-project',
              running_vms: 0,
              scaler_group_count: 1
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

      const result = await runBuiltCli(['--json', 'image', 'list'], {
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
              creation_time: '2026-03-11T09:00:00Z',
              image_id: '1001',
              image_name: 'alpha-image',
              image_size: '30 GB',
              image_state: 'available',
              is_windows: false,
              node_plans_available: true,
              os_distribution: 'CentOS 7',
              project_name: 'default-project',
              running_vms: 0,
              scaler_group_count: 1
            },
            {
              creation_time: '2026-03-12T10:00:00Z',
              image_id: '1002',
              image_name: 'zeta-image',
              image_size: '45 GB',
              image_state: 'available',
              is_windows: false,
              node_plans_available: false,
              os_distribution: 'Ubuntu 24.04',
              project_name: null,
              running_vms: 2,
              scaler_group_count: 0
            }
          ]
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/images/saved-images/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(server.requests[0]?.headers.authorization).toBe(
        'Bearer prod-auth-token'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
