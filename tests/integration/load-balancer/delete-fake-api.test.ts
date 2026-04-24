import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildDeleteResponse() {
  return {
    code: 200,
    data: {},
    errors: {},
    message: 'Load balancer deleted successfully.'
  };
}

describe('load-balancer delete against a fake MyAccount API', () => {
  it('deletes a load balancer with --force and emits JSON', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/appliances/42/': () => ({
        body: buildDeleteResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'load-balancer', 'delete', '42', '--force'],
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
        stableStringify({
          action: 'delete',
          cancelled: false,
          lb_id: '42',
          message: 'Load balancer deleted successfully.'
        }) + '\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('deletes a load balancer with --force and renders human output (without --json)', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/appliances/42/': () => ({
        body: buildDeleteResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['load-balancer', 'delete', '42', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Load balancer deleted.');
      expect(result.stdout).toContain('42');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
