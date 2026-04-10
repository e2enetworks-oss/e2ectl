import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node save-image action against a fake MyAccount API', () => {
  it('sends the save-image payload and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/nodes/101/actions/': () => ({
        body: {
          code: 200,
          data: {
            action_type: 'Save Image',
            created_at: '2026-03-14T08:20:00Z',
            id: 703,
            image_id: 'img-455',
            resource_id: '101',
            status: 'In Progress'
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
        [
          '--json',
          'node',
          'action',
          'save-image',
          '101',
          '--name',
          'node-a-image'
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
          action: 'save-image',
          image_name: 'node-a-image',
          node_id: 101,
          result: {
            action_id: 703,
            created_at: '2026-03-14T08:20:00Z',
            image_id: 'img-455',
            status: 'In Progress'
          }
        })}\n`
      );
      expect(server.requests).toHaveLength(1);
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        name: 'node-a-image',
        type: 'save_images'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
