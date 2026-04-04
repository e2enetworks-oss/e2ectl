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
          node_id: 101,
          reserve_public_ip_requested: false
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

  it('adds reserve_ip_required=true only when --reserve-public-ip is supplied', async () => {
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
        ['--json', 'node', 'delete', '101', '--reserve-public-ip', '--force'],
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
          node_id: 101,
          reserve_public_ip_requested: true
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'DELETE',
        pathname: '/myaccount/api/v1/nodes/101/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429',
          reserve_ip_required: 'true'
        }
      });
      expect(server.requests[0]!.body).toBe('');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails before network in non-interactive mode when delete omits --force', async () => {
    const server = await startTestHttpServer({});
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['node', 'delete', '101'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Deleting a node requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
      );
      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
