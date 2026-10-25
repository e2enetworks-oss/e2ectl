import { stableStringify } from '../../../src/core/json.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('config list json process flow', () => {
  it('prints the saved profiles with the deterministic json contract', async () => {
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          dev: {
            api_key: 'dev-api-key-1111',
            auth_token: 'dev-auth-token-2222',
            myaccount: { location: 'Chennai', project_id: '12345' }
          },
          prod: {
            api_key: 'prod-api-key-3333',
            auth_token: 'prod-auth-token-4444',
            myaccount: { location: 'Delhi', project_id: '46429' }
          }
        }
      });

      const result = await runBuiltCli(['--json', 'config', 'list'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'list',
          default: 'prod',
          profiles: [
            {
              alias: 'dev',
              api_key: '****1111',
              auth_token: '****2222',
              isDefault: false,
              myaccount: { location: 'Chennai', project_id: '12345' },
              tir: null
            },
            {
              alias: 'prod',
              api_key: '****3333',
              auth_token: '****4444',
              isDefault: true,
              myaccount: { location: 'Delhi', project_id: '46429' },
              tir: null
            }
          ]
        })}\n`
      );
    } finally {
      await tempHome.cleanup();
    }
  });
});
