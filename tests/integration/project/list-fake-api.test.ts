import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('project list against a fake MyAccount API', () => {
  it('lists account projects without requiring project or location defaults', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': () => ({
        body: {
          code: 200,
          data: [
            {
              is_default: true,
              is_starred: false,
              name: 'default-project',
              project_id: 46429
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'prod-api-key',
            auth_token: 'prod-auth-token'
          }
        }
      });

      const result = await runBuiltCli(['--json', 'project', 'list'], {
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
              is_cli_default_project: false,
              is_default: true,
              is_starred: false,
              name: 'default-project',
              project_id: 46429
            }
          ]
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/pbac/project/',
        query: {
          apikey: 'prod-api-key'
        }
      });
      expect(server.requests[0]?.query.project_id).toBeUndefined();
      expect(server.requests[0]?.query.location).toBeUndefined();
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders human project list output without project-scoped defaults', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': () => ({
        body: {
          code: 200,
          data: [
            {
              is_default: false,
              is_starred: true,
              name: 'zeta-project',
              project_id: 50001
            },
            {
              is_default: true,
              is_starred: false,
              name: 'default-project',
              project_id: 46429
            }
          ],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'prod-api-key',
            auth_token: 'prod-auth-token'
          }
        }
      });

      const result = await runBuiltCli(['project', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('CLI Default');
      expect(result.stdout).toContain('default-project');
      expect(result.stdout).toContain('zeta-project');
      expect(result.stdout.indexOf('default-project')).toBeLessThan(
        result.stdout.indexOf('zeta-project')
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders a clear empty-state message for project list', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': () => ({
        body: {
          code: 200,
          data: [],
          errors: {},
          message: 'Success'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'prod-api-key',
            auth_token: 'prod-auth-token'
          }
        }
      });

      const result = await runBuiltCli(['project', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('No projects found.\n');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
