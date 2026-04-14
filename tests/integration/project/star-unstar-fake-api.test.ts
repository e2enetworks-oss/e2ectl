import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function projectListHandler() {
  return () => ({
    body: {
      code: 200,
      data: [
        {
          is_default: true,
          is_starred: false,
          name: 'default-project',
          project_id: 46429
        },
        {
          is_default: false,
          is_starred: true,
          name: 'sandbox',
          project_id: 46430
        }
      ],
      errors: {},
      message: 'Success'
    }
  });
}

function projectStarUnstarHandler() {
  return (req: { body: string }) => {
    const parsed = JSON.parse(req.body) as {
      name: string;
      project_id: number;
    };

    return {
      body: {
        code: 200,
        data: {
          project_id: parsed.project_id,
          project_name: parsed.name
        },
        errors: {},
        message: 'Project Updation done!'
      }
    };
  };
}

describe('project star/unstar against a fake MyAccount API', () => {
  it('stars a project in json mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': projectListHandler(),
      'PUT /myaccount/api/v1/pbac/project/': projectStarUnstarHandler()
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

      const result = await runBuiltCli(['--json', 'project', 'star', '46429'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'star',
          name: 'default-project',
          project_id: 46429
        })}\n`
      );

      const putRequest = server.requests.find((r) => r.method === 'PUT');
      expect(putRequest).toBeDefined();

      const putBody = JSON.parse(putRequest!.body);
      expect(putBody).toMatchObject({
        is_starred: true,
        name: 'default-project',
        project_id: 46429
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('unstars a project in json mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': projectListHandler(),
      'PUT /myaccount/api/v1/pbac/project/': projectStarUnstarHandler()
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
        ['--json', 'project', 'unstar', '46430'],
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
          action: 'unstar',
          name: 'sandbox',
          project_id: 46430
        })}\n`
      );

      const putRequest = server.requests.find((r) => r.method === 'PUT');
      expect(putRequest).toBeDefined();

      const putBody = JSON.parse(putRequest!.body);
      expect(putBody).toMatchObject({
        is_starred: false,
        name: 'sandbox',
        project_id: 46430
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders human output for project star', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': projectListHandler(),
      'PUT /myaccount/api/v1/pbac/project/': projectStarUnstarHandler()
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

      const result = await runBuiltCli(['project', 'star', '46429'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Starred project: default-project');
      expect(result.stdout).toContain('ID: 46429');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('renders human output for project unstar', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': projectListHandler(),
      'PUT /myaccount/api/v1/pbac/project/': projectStarUnstarHandler()
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

      const result = await runBuiltCli(['project', 'unstar', '46430'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Unstarred project: sandbox');
      expect(result.stdout).toContain('ID: 46430');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails with non-numeric project id', async () => {
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

      const result = await runBuiltCli(['project', 'star', 'abc'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Project ID must be numeric');
    } finally {
      await tempHome.cleanup();
    }
  });

  it('fails with an unsafe-large project id', async () => {
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
        ['project', 'star', '9007199254740992'],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'Project ID is too large to represent safely'
      );
    } finally {
      await tempHome.cleanup();
    }
  });
});
