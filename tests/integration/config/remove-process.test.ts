import type { ConfigFile } from '../../../src/config/index.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome, readJsonFile } from '../../helpers/temp-home.js';

describe('config remove process flow', () => {
  it('removes a saved alias and preserves the remaining config', async () => {
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'prod-api-key',
            auth_token: 'prod-auth-token'
          },
          staging: {
            api_key: 'staging-api-key',
            auth_token: 'staging-auth-token'
          }
        }
      });

      const result = await runBuiltCli(
        ['config', 'remove', '--alias', 'staging'],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('Removed profile "staging".\n');
      expect(await readJsonFile<ConfigFile>(tempHome.configPath)).toEqual({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'prod-api-key',
            auth_token: 'prod-auth-token'
          }
        }
      });
    } finally {
      await tempHome.cleanup();
    }
  });

  it('fails cleanly when the alias does not exist', async () => {
    const tempHome = await createTempHome();

    try {
      const result = await runBuiltCli(
        ['config', 'remove', '--alias', 'missing'],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(result.exitCode).toBe(4);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Profile "missing" was not found.\n\nNext step: Run `e2ectl config list` to inspect the saved aliases.\n'
      );
    } finally {
      await tempHome.cleanup();
    }
  });
});
