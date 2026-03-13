import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('ssh-key create from a file against a fake MyAccount API', () => {
  it('reads file content locally and posts the normalized key payload', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ssh_keys/': () => ({
        body: {
          code: 200,
          data: {
            label: 'demo',
            pk: 15398,
            project_id: '46429',
            ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
            timestamp: '19-Feb-2025'
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);
      const publicKeyPath = await tempHome.writeImportFile(
        'keys/demo.pub',
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop'
      );

      const result = await runBuiltCli(
        [
          '--json',
          'ssh-key',
          'create',
          '--label',
          'demo',
          '--public-key-file',
          publicKeyPath
        ],
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
          item: {
            attached_nodes: 0,
            created_at: '19-Feb-2025',
            id: 15398,
            label: 'demo',
            project_id: '46429',
            project_name: null,
            public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop',
            type: 'ED25519'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/ssh_keys/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        label: 'demo',
        ssh_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA demo@laptop'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
