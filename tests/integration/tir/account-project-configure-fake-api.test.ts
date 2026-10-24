import { TIR_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome, type TempHome } from '../../helpers/temp-home.js';

const ACCOUNTS = {
  code: 200,
  data: [
    {
      has_tir_access: true,
      id: 1234,
      owner: { email: 'acme@example.com', name: 'Acme' },
      role: 'Admin'
    }
  ],
  errors: {},
  message: 'Success'
};

const PROJECTS = {
  code: 200,
  data: [
    {
      created_at: '2026-09-02T10:00:00Z',
      project_id: 91011,
      project_name: 'research',
      team_id: 1
    }
  ],
  errors: {},
  message: 'Success'
};

async function seedProfile(tempHome: TempHome): Promise<void> {
  await tempHome.writeConfig({
    default: 'work',
    profiles: { work: { api_key: 'work-key', auth_token: 'work-token' } }
  });
}

describe('tir account, project and configure against a fake TIR API', () => {
  it('picks an account, a project and a location in three commands, then saves them', async () => {
    const server = await startTestHttpServer({
      'GET /gpu/users/iam-accounts/': () => ({ body: ACCOUNTS }),
      'GET /gpu/projects/': () => ({ body: PROJECTS })
    });
    const tempHome = await createTempHome();
    const env = {
      HOME: tempHome.path,
      [TIR_BASE_URL_ENV_VAR]: `${server.baseUrl}/gpu`
    };

    try {
      await seedProfile(tempHome);

      const accounts = await runBuiltCli(['--json', 'tir', 'account', 'list'], {
        env
      });
      expect(accounts.exitCode).toBe(0);
      expect(accounts.stdout).toBe(
        `${stableStringify({
          action: 'list',
          items: [
            {
              email: 'acme@example.com',
              id: 1234,
              name: 'Acme',
              role: 'Admin',
              tir_access: true
            }
          ]
        })}\n`
      );

      const projects = await runBuiltCli(
        ['--json', 'tir', 'project', 'list', '--account-id', '1234'],
        { env }
      );
      expect(projects.exitCode).toBe(0);
      expect(JSON.parse(projects.stdout)).toEqual({
        account_id: 1234,
        action: 'list',
        items: [
          { created_at: '2026-09-02T10:00:00Z', id: 91011, name: 'research' }
        ]
      });

      const configured = await runBuiltCli(
        [
          'tir',
          'configure',
          '--account',
          '1234',
          '--project',
          '91011',
          '--location',
          'Delhi'
        ],
        { env }
      );
      expect(configured.exitCode).toBe(0);
      expect(configured.stdout).toBe(
        'TIR context saved for profile "work": account 1234 (acme@example.com), project 91011 (research), Delhi.\n'
      );
      expect((await tempHome.readConfig()).profiles.work?.tir).toEqual({
        account_id: '1234',
        location: 'Delhi',
        project_id: '91011'
      });

      const projectRequest = server.requests.find(
        (request) => request.pathname === '/gpu/projects/'
      );
      expect(projectRequest?.query).toMatchObject({
        active_iam: '1234',
        apikey: 'work-key'
      });
      expect(projectRequest?.query.project_id).toBeUndefined();
      expect(projectRequest?.headers.authorization).toBe('Bearer work-token');

      const savedProjects = await runBuiltCli(
        ['--json', 'tir', 'project', 'list'],
        { env }
      );
      expect(JSON.parse(savedProjects.stdout)).toMatchObject({
        account_id: 1234
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('refuses a project that is not in the account and saves nothing', async () => {
    const server = await startTestHttpServer({
      'GET /gpu/users/iam-accounts/': () => ({ body: ACCOUNTS }),
      'GET /gpu/projects/': () => ({ body: PROJECTS })
    });
    const tempHome = await createTempHome();

    try {
      await seedProfile(tempHome);

      const result = await runBuiltCli(
        [
          'tir',
          'configure',
          '--account',
          '1234',
          '--project',
          '5',
          '--location',
          'Delhi'
        ],
        {
          env: {
            HOME: tempHome.path,
            [TIR_BASE_URL_ENV_VAR]: `${server.baseUrl}/gpu`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        'TIR project 5 was not found in account 1234.'
      );
      expect(result.stderr).toContain(
        'e2ectl tir project list --account-id <id>'
      );
      expect((await tempHome.readConfig()).profiles.work?.tir).toBeUndefined();
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('turns a TIR 403 into a next step about the account and project', async () => {
    const server = await startTestHttpServer({
      'GET /gpu/projects/': () => ({
        body: {
          code: 403,
          data: {},
          errors: 'User not found',
          message: 'Forbidden'
        },
        status: 403
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedProfile(tempHome);

      const result = await runBuiltCli(
        ['tir', 'project', 'list', '--account-id', '99'],
        {
          env: {
            HOME: tempHome.path,
            [TIR_BASE_URL_ENV_VAR]: `${server.baseUrl}/gpu`
          }
        }
      );

      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain('TIR API request failed: Forbidden');
      expect(result.stderr).toContain(
        'Next step: Check the TIR account and project'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('says how to pick an account when none is chosen', async () => {
    const tempHome = await createTempHome();

    try {
      await seedProfile(tempHome);

      const result = await runBuiltCli(['tir', 'project', 'list'], {
        env: { HOME: tempHome.path }
      });

      expect(result.exitCode).toBe(4);
      expect(result.stderr).toContain('No TIR account chosen.');
      expect(result.stderr).toContain('e2ectl tir account list');
    } finally {
      await tempHome.cleanup();
    }
  });
});
