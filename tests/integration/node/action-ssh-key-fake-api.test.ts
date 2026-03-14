import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node ssh-key attach against a fake MyAccount API', () => {
  it('resolves saved ssh key ids and sends add_ssh_keys payloads', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/ssh_keys/': () => ({
        body: {
          code: 200,
          data: [
            {
              label: 'admin',
              pk: 12,
              ssh_key: 'ssh-ed25519 AAAA admin@example.com',
              timestamp: '14-Mar-2026'
            },
            {
              label: 'deploy',
              pk: 13,
              ssh_key: 'ssh-ed25519 BBBB deploy@example.com',
              timestamp: '14-Mar-2026'
            }
          ],
          errors: {},
          message: 'OK'
        }
      }),
      'PUT /myaccount/api/v1/nodes/101/actions/': () => ({
        body: {
          code: 200,
          data: {
            action_type: 'Add SSH Keys',
            created_at: '2026-03-14T08:00:00Z',
            id: 801,
            resource_id: '101',
            status: 'Done'
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
          'node',
          'action',
          'ssh-key',
          'attach',
          '101',
          '--ssh-key-id',
          '12',
          '--ssh-key-id',
          '13',
          '--ssh-key-id',
          '12'
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
          action: 'ssh-key-attach',
          node_id: 101,
          result: {
            action_id: 801,
            created_at: '2026-03-14T08:00:00Z',
            image_id: null,
            status: 'Done'
          },
          ssh_keys: [
            {
              id: 12,
              label: 'admin'
            },
            {
              id: 13,
              label: 'deploy'
            }
          ]
        })}\n`
      );
      expect(server.requests).toHaveLength(2);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        ssh_keys: [
          {
            label: 'admin',
            ssh_key: 'ssh-ed25519 AAAA admin@example.com'
          },
          {
            label: 'deploy',
            ssh_key: 'ssh-ed25519 BBBB deploy@example.com'
          }
        ],
        type: 'add_ssh_keys'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
