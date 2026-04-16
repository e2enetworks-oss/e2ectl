import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node security-group actions against a fake MyAccount API', () => {
  it('attaches security groups after resolving the node vm id', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            security_group_count: 2,
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/security_group/100157/attach/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Security Group Attached Successfully'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'action',
          'security-group',
          'attach',
          '101',
          '--security-group-id',
          '44',
          '--security-group-id',
          '45',
          '--security-group-id',
          '44'
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
          action: 'security-group-attach',
          node_id: 101,
          result: {
            message: 'Security Group Attached Successfully'
          },
          security_group_ids: [44, 45]
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(server.requests[1]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/security_group/100157/attach/'
      });
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        security_group_ids: [44, 45]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('detaches security groups after resolving the node vm id', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            security_group_count: 2,
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/security_group/100157/detach/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Security Groups Detached Successfully'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'action',
          'security-group',
          'detach',
          '101',
          '--security-group-id',
          '45'
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
          action: 'security-group-detach',
          node_id: 101,
          result: {
            message: 'Security Groups Detached Successfully'
          },
          security_group_ids: [45]
        })}\n`
      );
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        security_group_ids: [45]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('blocks detaching the last remaining security group before calling the detach endpoint', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            security_group_count: 1,
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/security_group/100157/detach/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Security Groups Detached Successfully'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'node',
          'action',
          'security-group',
          'detach',
          '101',
          '--security-group-id',
          '45'
        ],
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
        'Error: Node 101 must keep at least one attached security group.\n\nDetails:\n- Attached security groups: 1\n- Requested detach count: 1\n\nNext step: Detach fewer security groups, or attach another security group before retrying.\n'
      );
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.method).toBe('GET');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders human security-group action output', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            security_group_count: 2,
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'POST /myaccount/api/v1/security_group/100157/attach/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Security Group Attached Successfully'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'node',
          'action',
          'security-group',
          'attach',
          '101',
          '--security-group-id',
          '44',
          '--security-group-id',
          '45'
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
        'Requested security-group attach for node 101.'
      );
      expect(result.stdout).toContain('Security Group IDs: 44, 45');
      expect(result.stdout).toContain(
        'Message: Security Group Attached Successfully'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
