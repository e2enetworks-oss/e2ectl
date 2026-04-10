import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('stale default alias env bypass process flow', () => {
  it('uses env auth and context when the saved default alias is missing', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/nodes/': () => ({
        body: {
          code: 200,
          data: [],
          errors: {},
          message: 'OK',
          total_count: 0,
          total_page_number: 0
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'missing',
        profiles: {}
      });

      const result = await runBuiltCli(['--json', 'node', 'list'], {
        env: {
          E2E_API_KEY: 'env-api-key',
          E2E_AUTH_TOKEN: 'env-auth-token',
          E2E_LOCATION: 'Delhi',
          E2E_PROJECT_ID: '46429',
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stderr).not.toContain('Profile "missing" was not found');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'list',
          nodes: [],
          total_count: 0,
          total_page_number: 0
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        headers: {
          authorization: 'Bearer env-auth-token'
        },
        method: 'GET',
        pathname: '/myaccount/api/v1/nodes/',
        query: {
          apikey: 'env-api-key',
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
