import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('reserved-ip create against a fake MyAccount API', () => {
  it('creates a reserved IP and emits deterministic json with the canonical ip_address', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/reserve_ips/': () => ({
        body: {
          code: 200,
          data: {
            appliance_type: 'NODE',
            bought_at: '04-11-2024 10:37',
            floating_ip_attached_nodes: [],
            ip_address: '164.52.198.54',
            project_name: 'default-project',
            reserve_id: 12662,
            reserved_type: 'AddonIP',
            status: 'Reserved',
            vm_id: null,
            vm_name: '--'
          },
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'reserved-ip', 'create'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'create',
          reserved_ip: {
            appliance_type: 'NODE',
            bought_at: '04-11-2024 10:37',
            floating_ip_attached_nodes: [],
            ip_address: '164.52.198.54',
            project_name: 'default-project',
            reserve_id: 12662,
            reserved_type: 'AddonIP',
            status: 'Reserved',
            vm_id: null,
            vm_name: '--'
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/reserve_ips/'
      });
      expect(server.requests[0]?.body).toBe('');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
