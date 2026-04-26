import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('image rename against a fake MyAccount API', () => {
  it('renames a saved image and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'PUT /myaccount/api/v1/images/1001/': () => ({
        body: {
          code: 200,
          data: {
            message: 'Saved image renamed successfully.',
            status: true
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
        ['--json', 'image', 'rename', '1001', '--name', 'renamed-image'],
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
          action: 'rename',
          id: '1001',
          message: 'Saved image renamed successfully.',
          name: 'renamed-image'
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'PUT',
        pathname: '/myaccount/api/v1/images/1001/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        action_type: 'rename',
        name: 'renamed-image'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
