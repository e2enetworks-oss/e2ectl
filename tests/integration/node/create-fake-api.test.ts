import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildCreateResponse() {
  return {
    code: 200,
    data: {
      node_create_response: [
        {
          created_at: '2026-03-11T10:00:00Z',
          id: 205,
          location: 'Delhi',
          name: 'demo-node',
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.2',
          public_ip_address: '1.1.1.2',
          status: 'Creating'
        }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    },
    errors: {},
    message: 'OK'
  };
}

describe('node create against a fake MyAccount API', () => {
  it('sends the default hourly create payload and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/nodes/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'create',
          '--name',
          'demo-node',
          '--plan',
          'plan-123',
          '--image',
          'Ubuntu-24.04-Distro'
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
            billing_type: 'hourly'
          },
          created: 1,
          nodes: [
            {
              created_at: '2026-03-11T10:00:00Z',
              id: 205,
              location: 'Delhi',
              name: 'demo-node',
              plan: 'C3.8GB',
              private_ip_address: '10.0.0.2',
              public_ip_address: '1.1.1.2',
              status: 'Creating'
            }
          ],
          requested: 1
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/nodes/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        backups: false,
        default_public_ip: false,
        disable_password: true,
        enable_bitninja: false,
        image: 'Ubuntu-24.04-Distro',
        is_ipv6_availed: false,
        is_saved_image: false,
        label: 'default',
        name: 'demo-node',
        number_of_instances: 1,
        plan: 'plan-123',
        ssh_keys: [],
        start_scripts: []
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('sends cn_id and auto_renew for committed node creation', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/nodes/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'create',
          '--name',
          'demo-node',
          '--plan',
          'plan-123',
          '--image',
          'Ubuntu-24.04-Distro',
          '--billing-type',
          'committed',
          '--committed-plan-id',
          '2711'
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
            billing_type: 'committed',
            committed_plan_id: 2711,
            post_commit_behavior: 'auto_renew'
          },
          created: 1,
          nodes: [
            {
              created_at: '2026-03-11T10:00:00Z',
              id: 205,
              location: 'Delhi',
              name: 'demo-node',
              plan: 'C3.8GB',
              private_ip_address: '10.0.0.2',
              public_ip_address: '1.1.1.2',
              status: 'Creating'
            }
          ],
          requested: 1
        })}\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        backups: false,
        cn_id: 2711,
        cn_status: 'auto_renew',
        default_public_ip: false,
        disable_password: true,
        enable_bitninja: false,
        image: 'Ubuntu-24.04-Distro',
        is_ipv6_availed: false,
        is_saved_image: false,
        label: 'default',
        name: 'demo-node',
        number_of_instances: 1,
        plan: 'plan-123',
        ssh_keys: [],
        start_scripts: []
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
