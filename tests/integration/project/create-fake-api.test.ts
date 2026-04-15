import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('project create against a fake MyAccount API', () => {
  it('creates a project and returns json output', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/pbac/project/': () => ({
        body: {
          code: 200,
          data: {
            project_id: 99001,
            project_name: 'new-project'
          },
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

      const result = await runBuiltCli(
        ['--json', 'project', 'create', '--name', 'new-project'],
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
          name: 'new-project',
          project_id: 99001
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/pbac/project/'
      });
      expect(server.requests[0]?.query.project_id).toBeUndefined();
      expect(server.requests[0]?.query.location).toBeUndefined();
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders human output for project create', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/pbac/project/': () => ({
        body: {
          code: 200,
          data: {
            project_id: 99001,
            project_name: 'new-project'
          },
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

      const result = await runBuiltCli(
        ['project', 'create', '--name', 'new-project'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Created project: new-project');
      expect(result.stdout).toContain('ID: 99001');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when --name is missing', async () => {
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

      const result = await runBuiltCli(['project', 'create'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("required option '--name <name>'");
    } finally {
      await tempHome.cleanup();
    }
  });
});
