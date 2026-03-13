import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('ssh-key list against a fake MyAccount API', () => {
  it('uses the shared transport and emits clean deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ssh_keys/': () => ({
        body: {
          code: 200,
          data: [
            {
              label: 'zeta',
              pk: 1002,
              project_name: 'default-project',
              ssh_key: 'ssh-rsa AAAAB3Nza zeta',
              ssh_key_type: 'RSA',
              timestamp: '18-Feb-2025',
              total_attached_nodes: 1
            },
            {
              label: 'alpha',
              pk: 1001,
              project_name: 'default-project',
              ssh_key: 'ssh-ed25519 AAAAC3Nza alpha',
              ssh_key_type: 'ED25519',
              timestamp: '19-Feb-2025',
              total_attached_nodes: 2
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'ssh-key', 'list'], {
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
              attached_nodes: 2,
              created_at: '19-Feb-2025',
              id: 1001,
              label: 'alpha',
              project_id: null,
              project_name: 'default-project',
              public_key: 'ssh-ed25519 AAAAC3Nza alpha',
              type: 'ED25519'
            },
            {
              attached_nodes: 1,
              created_at: '18-Feb-2025',
              id: 1002,
              label: 'zeta',
              project_id: null,
              project_name: 'default-project',
              public_key: 'ssh-rsa AAAAB3Nza zeta',
              type: 'RSA'
            }
          ]
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/ssh_keys/',
        query: {
          apikey: 'prod-api-key',
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
