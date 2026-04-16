import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node public-ip detach against a fake MyAccount API', () => {
  it('detaches the current node public IP through the dedicated reserve-ip action endpoint', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '151.185.42.45',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/reserve_ips/public_reserveip_actions/': () => ({
        body: {
          code: 200,
          data: {
            IP: '151.185.42.45',
            status: 'Reserved',
            vm_id: 100157,
            vm_name: 'node-a'
          },
          errors: {},
          message: 'Public IP detached successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'node', 'action', 'public-ip', 'detach', '101', '--force'],
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
          action: 'public-ip-detach',
          message: 'Public IP detached successfully.',
          node_id: 101,
          public_ip: '151.185.42.45'
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/101/'
      });
      expect(server.requests[1]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/reserve_ips/public_reserveip_actions/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        public_ip: '151.185.42.45',
        type: 'detach',
        vm_id: 100157
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly when the node does not have a current public IP', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: null,
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['node', 'action', 'public-ip', 'detach', '101', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: This node does not have a current public IP to detach.\n\nDetails:\n- Node ID: 101\n\nNext step: Pick a node with an assigned public IP, then retry the public-ip detach command.\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/101/'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly when node details omit vm_id', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '151.185.42.45',
            status: 'Running'
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['node', 'action', 'public-ip', 'detach', '101', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: The MyAccount API did not return a VM ID for this node.\n\nDetails:\n- Node ID: 101\n\nNext step: Retry the command. If the problem persists, inspect the node details response.\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/101/'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('requires --force outside an interactive terminal after resolving node details', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '151.185.42.45',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/reserve_ips/public_reserveip_actions/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Public IP detached successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['node', 'action', 'public-ip', 'detach', '101'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Detaching a node public IP requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/101/'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
