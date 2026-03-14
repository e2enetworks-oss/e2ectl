import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node volume actions against a fake MyAccount API', () => {
  it('attaches volumes after resolving the node vm id from node details', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'PUT /myaccount/api/v1/block_storage/8801/vm/attach/': () => ({
        body: {
          code: 200,
          data: {
            image_id: 8801,
            vm_id: 100157
          },
          errors: {},
          message: 'Block Storage is Attached to VM.'
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
          'volume',
          'attach',
          '101',
          '--volume-id',
          '8801'
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
          action: 'volume-attach',
          node_id: 101,
          node_vm_id: 100157,
          result: {
            message: 'Block Storage is Attached to VM.'
          },
          volume: {
            id: 8801
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/101/'
      });
      expect(server.requests[1]).toMatchObject({
        method: 'PUT',
        pathname: '/myaccount/api/v1/block_storage/8801/vm/attach/'
      });
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        vm_id: 100157
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('detaches volumes after resolving the node vm id from node details', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {
            id: 101,
            name: 'node-a',
            plan: 'C3.8GB',
            status: 'Running',
            vm_id: 100157
          },
          errors: {},
          message: 'OK'
        }
      }),
      'PUT /myaccount/api/v1/block_storage/8801/vm/detach/': () => ({
        body: {
          code: 200,
          data: {
            image_id: 8801,
            vm_id: 100157
          },
          errors: {},
          message: 'Block Storage Detach Process is Started.'
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
          'volume',
          'detach',
          '101',
          '--volume-id',
          '8801'
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
          action: 'volume-detach',
          node_id: 101,
          node_vm_id: 100157,
          result: {
            message: 'Block Storage Detach Process is Started.'
          },
          volume: {
            id: 8801
          }
        })}\n`
      );
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        vm_id: 100157
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
