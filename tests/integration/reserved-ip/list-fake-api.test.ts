import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('reserved-ip list against a fake MyAccount API', () => {
  it('lists reserved IPs and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/reserve_ips/': () => ({
        body: {
          code: 200,
          data: [
            {
              appliance_type: 'NODE',
              bought_at: '04-11-2024 10:37',
              floating_ip_attached_nodes: [],
              ip_address: '216.48.184.202',
              project_name: 'default-project',
              reserve_id: 12663,
              reserved_type: 'AddonIP',
              status: 'Reserved',
              vm_id: null,
              vm_name: '--'
            },
            {
              appliance_type: 'NODE',
              bought_at: '04-11-2024 10:37',
              floating_ip_attached_nodes: [
                {
                  id: 101,
                  ip_address_private: '10.0.0.5',
                  ip_address_public: '164.52.198.55',
                  name: 'node-a',
                  security_group_status: 'Updated',
                  status_name: 'Running',
                  vm_id: 100157
                }
              ],
              ip_address: '164.52.198.54',
              project_name: 'default-project',
              reserve_id: 12662,
              reserved_type: 'AddonIP',
              status: 'Assigned',
              vm_id: 100157,
              vm_name: 'node-a'
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'reserved-ip', 'list'], {
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
              appliance_type: 'NODE',
              bought_at: '04-11-2024 10:37',
              floating_ip_attached_nodes: [
                {
                  id: 101,
                  ip_address_private: '10.0.0.5',
                  ip_address_public: '164.52.198.55',
                  name: 'node-a',
                  security_group_status: 'Updated',
                  status_name: 'Running',
                  vm_id: 100157
                }
              ],
              ip_address: '164.52.198.54',
              project_name: 'default-project',
              reserve_id: 12662,
              reserved_type: 'AddonIP',
              status: 'Assigned',
              vm_id: 100157,
              vm_name: 'node-a'
            },
            {
              appliance_type: 'NODE',
              bought_at: '04-11-2024 10:37',
              floating_ip_attached_nodes: [],
              ip_address: '216.48.184.202',
              project_name: 'default-project',
              reserve_id: 12663,
              reserved_type: 'AddonIP',
              status: 'Reserved',
              vm_id: null,
              vm_name: '--'
            }
          ]
        })}\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/reserve_ips/',
        query: {
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
