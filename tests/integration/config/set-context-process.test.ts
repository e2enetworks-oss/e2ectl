import type { ConfigFile } from '../../../src/config/index.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome, readJsonFile } from '../../helpers/temp-home.js';

describe('config set-context process flow', () => {
  it('updates the saved default project and location for an existing alias', async () => {
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'api-key',
            auth_token: 'auth-token'
          }
        }
      });

      const result = await runBuiltCli(
        [
          'config',
          'set-context',
          '--alias',
          'prod',
          '--default-project-id',
          '46429',
          '--default-location',
          'Delhi'
        ],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('Updated default context for "prod".\n');
      expect(await readJsonFile<ConfigFile>(tempHome.configPath)).toEqual({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'api-key',
            auth_token: 'auth-token',
            default_project_id: '46429',
            default_location: 'Delhi'
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
        [
          'config',
          'set-context',
          '--alias',
          'missing',
          '--default-project-id',
          '46429'
        ],
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
