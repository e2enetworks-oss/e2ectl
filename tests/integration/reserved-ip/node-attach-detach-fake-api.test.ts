import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('reserved-ip node attach/detach/reserve against a fake MyAccount API', () => {
  it('attaches reserved IPs after resolving the node vm id from node details', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '164.52.198.55',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/reserve_ips/164.52.198.54/actions/': () => ({
        body: {
          code: 200,
          data: {
            IP: '164.52.198.54',
            status: 'Assigned',
            vm_id: 100157,
            vm_name: 'node-a'
          },
          errors: {},
          message: 'IP assigned successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'reserved-ip',
          'attach',
          'node',
          '164.52.198.54',
          '--node-id',
          '101'
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
          action: 'attach-node',
          message: 'IP assigned successfully.',
          node_id: 101,
          reserved_ip: {
            ip_address: '164.52.198.54',
            status: 'Assigned',
            vm_id: 100157,
            vm_name: 'node-a'
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        type: 'attach',
        vm_id: 100157
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('detaches reserved IPs after resolving the node vm id from node details', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '164.52.198.55',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/reserve_ips/164.52.198.54/actions/': () => ({
        body: {
          code: 200,
          data: {
            IP: '164.52.198.54',
            status: 'Reserved',
            vm_id: 100157,
            vm_name: 'node-a'
          },
          errors: {},
          message: 'IP detached successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'reserved-ip',
          'detach',
          'node',
          '164.52.198.54',
          '--node-id',
          '101'
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
          action: 'detach-node',
          message: 'IP detached successfully.',
          node_id: 101,
          reserved_ip: {
            ip_address: '164.52.198.54',
            status: 'Reserved',
            vm_id: 100157,
            vm_name: 'node-a'
          }
        })}\n`
      );
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        type: 'detach',
        vm_id: 100157
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('reserves the current node public IP through the live-reserve action path', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '164.52.198.55',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/reserve_ips/164.52.198.55/actions/': () => ({
        body: {
          code: 200,
          data: {
            IP: '164.52.198.55',
            status: 'Live Reserved',
            vm_name: 'node-a'
          },
          errors: {},
          message: 'IP reserved successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'reserved-ip', 'reserve', 'node', '101'],
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
          action: 'reserve-node',
          ip_address: '164.52.198.55',
          message: 'IP reserved successfully.',
          node_id: 101,
          status: 'Live Reserved'
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        type: 'live-reserve',
        vm_id: 100157
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly for reserve when the node does not have a public IP', async () => {
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
        ['reserved-ip', 'reserve', 'node', '101'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'Error: This node does not have a current public IP to reserve.'
      );
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly for attach when node details omit vm_id', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '164.52.198.55',
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
        ['reserved-ip', 'attach', 'node', '164.52.198.54', '--node-id', '101'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'Error: The MyAccount API did not return a VM ID for this node.'
      );
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly for detach when node details omit vm_id', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            public_ip_address: '164.52.198.55',
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
        ['reserved-ip', 'detach', 'node', '164.52.198.54', '--node-id', '101'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'Error: The MyAccount API did not return a VM ID for this node.'
      );
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
