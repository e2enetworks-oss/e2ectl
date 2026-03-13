import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('ssh-key create from stdin against a fake MyAccount API', () => {
  it('reads stdin when --public-key-file - is used', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/ssh_keys/': () => ({
        body: {
          code: 200,
          data: {
            label: 'demo',
            pk: 15399,
            project_id: '46429',
            ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop',
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

      const result = await runBuiltCli(
        [
          '--json',
          'ssh-key',
          'create',
          '--label',
          'demo',
          '--public-key-file',
          '-'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          },
          stdin: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop\n'
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
            id: 15399,
            label: 'demo',
            project_id: '46429',
            project_name: null,
            public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop',
            type: 'RSA'
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        label: 'demo',
        ssh_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ demo@laptop'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
