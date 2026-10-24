import {
  MYACCOUNT_BASE_URL_ENV_VAR,
  TIR_BASE_URL_ENV_VAR
} from '../../../src/app/runtime.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

function ok(data: unknown) {
  return { body: { code: 200, data, errors: {}, message: 'OK' } };
}

describe('e2ectl configure against fake APIs', () => {
  it('sets up a new profile from flags and later commands run there with no flags', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/iam/multi-crn/': () => ok([]),
      'GET /myaccount/api/v1/gpu/users/iam-accounts/': () =>
        ok([
          { has_tir_access: true, id: 11, owner: { email: 'o@example.com' } }
        ]),
      'GET /myaccount/api/v1/gpu/projects/': () =>
        ok([{ project_id: 33, project_name: 'research' }]),
      'GET /myaccount/api/v1/gpu/gpu_service/image/': () => ok([])
    });
    const tempHome = await createTempHome();
    const env = {
      E2E_API_KEY: 'env-key',
      E2E_AUTH_TOKEN: 'env-token',
      HOME: tempHome.path,
      [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`,
      [TIR_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1/gpu`
    };

    try {
      const result = await runBuiltCli(
        [
          'configure',
          '--tir-account-id',
          '11',
          '--tir-project-id',
          '33',
          '--tir-location',
          'Delhi'
        ],
        { env }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        'Saved the key and token in profile "default".'
      );
      expect((await tempHome.readConfig()).profiles.default).toMatchObject({
        api_key: 'env-key',
        tir: { account_id: '11', location: 'Delhi', project_id: '33' }
      });

      const images = await runBuiltCli(['tir', 'image', 'list'], {
        env: {
          HOME: tempHome.path,
          [TIR_BASE_URL_ENV_VAR]: env[TIR_BASE_URL_ENV_VAR]
        }
      });
      expect(images.exitCode).toBe(0);
      expect(server.requests.at(-1)?.query).toMatchObject({
        active_iam: '11',
        location: 'Delhi',
        project_id: '33'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('myaccount configure saves the project and location, and later commands use them', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/pbac/project/': () =>
        ok([
          { is_default: true, is_starred: false, name: 'main', project_id: 46 }
        ]),
      'GET /myaccount/api/v1/nodes/': () => ({
        body: {
          code: 200,
          data: [],
          errors: {},
          message: 'OK',
          total_count: 0,
          total_page_number: 1
        }
      })
    });
    const tempHome = await createTempHome();
    const env = {
      HOME: tempHome.path,
      [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
    };

    try {
      await tempHome.writeConfig({
        default: 'work',
        profiles: { work: { api_key: 'saved-key', auth_token: 'saved-token' } }
      });

      const saved = await runBuiltCli(
        [
          'myaccount',
          'configure',
          '--project-id',
          '46',
          '--location',
          'Chennai'
        ],
        { env }
      );
      expect(saved.exitCode).toBe(0);
      expect((await tempHome.readConfig()).profiles.work).toMatchObject({
        default_location: 'Chennai',
        default_project_id: '46'
      });

      const nodes = await runBuiltCli(['myaccount', 'node', 'list'], { env });
      expect(nodes.exitCode).toBe(0);
      expect(server.requests.at(-1)?.query).toMatchObject({
        location: 'Chennai',
        project_id: '46'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('without a terminal and without --platform, says how to choose one', async () => {
    const tempHome = await createTempHome();

    try {
      const result = await runBuiltCli(['configure'], {
        env: { HOME: tempHome.path }
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Choose at least one platform.');
    } finally {
      await tempHome.cleanup();
    }
  });
});
