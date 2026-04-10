import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node delete against a fake MyAccount API', () => {
  it('sends the delete request with --force and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/nodes/101/': () => ({
        body: {
          code: 200,
          data: {},
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'node', 'delete', '101', '--force'],
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
          message: 'Success',
          node_id: 101
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'DELETE',
        pathname: '/myaccount/api/v1/nodes/101/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(server.requests[0]!.body).toBe('');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
