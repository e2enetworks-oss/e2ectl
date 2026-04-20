import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('image get/delete against a fake MyAccount API', () => {
  it('gets one saved image and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/images/1001/': () => ({
        body: {
          code: 200,
          data: {
            creation_time: '2026-03-11T09:00:00Z',
            image_id: '1001',
            image_name: 'alpha-image',
            image_size: '30 GB',
            image_state: 'available',
            os_distribution: 'CentOS 7',
            running_vms: 0
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'image', 'get', '1001'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'get',
          item: {
            creation_time: '2026-03-11T09:00:00Z',
            image_id: '1001',
            image_name: 'alpha-image',
            image_size: '30 GB',
            image_state: 'available',
            is_windows: false,
            node_plans_available: false,
            os_distribution: 'CentOS 7',
            project_name: null,
            running_vms: 0,
            scaler_group_count: 0
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/images/1001/',
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

  it('deletes one saved image with --force and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/images/1001/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Saved image deleted successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'image', 'delete', '1001', '--force'],
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
          action: 'delete',
          cancelled: false,
          id: '1001',
          message: 'Saved image deleted successfully.'
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'DELETE',
        pathname: '/myaccount/api/v1/images/1001/',
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
