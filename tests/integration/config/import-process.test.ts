import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import type { ConfigFile } from '../../../src/config/index.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import {
  createTempHome,
  readFileMode,
  readJsonFile
} from '../../helpers/temp-home.js';

describe('config import process flow', () => {
  it('imports aliases into a clean HOME with secure persistence', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/iam/multi-crn/': () => ({
        body: {
          code: 200,
          data: {
            multi_crn: []
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      const importFilePath = await tempHome.writeImportFile('config.json', {
        prod: {
          api_auth_token: 'auth-token-5678',
          api_key: 'api-key-1234'
        }
      });
      const result = await runBuiltCli(
        [
          'config',
          'import',
          '--file',
          importFilePath,
          '--default',
          'prod',
          '--default-project-id',
          '46429',
          '--default-location',
          'Delhi',
          '--no-input'
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
      expect(result.stdout).toContain(
        `Imported 1 profile from "${importFilePath}".`
      );
      expect(result.stdout).toContain('Set "prod" as the default profile.');

      const savedConfig = await readJsonFile<ConfigFile>(tempHome.configPath);
      expect(savedConfig).toEqual({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'api-key-1234',
            auth_token: 'auth-token-5678',
            default_project_id: '46429',
            default_location: 'Delhi'
          }
        }
      });

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/iam/multi-crn/',
        query: {
          apikey: 'api-key-1234'
        }
      });

      if (process.platform !== 'win32') {
        expect(await readFileMode(tempHome.configDirectoryPath)).toBe(0o700);
        expect(await readFileMode(tempHome.configPath)).toBe(0o600);
      }
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('preserves saved per-alias defaults when overwriting an existing alias', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/iam/multi-crn/': () => ({
        body: {
          code: 200,
          data: {
            multi_crn: []
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await tempHome.writeConfig({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'api-existing',
            auth_token: 'auth-existing',
            default_project_id: '46429',
            default_location: 'Delhi'
          }
        }
      });
      const importFilePath = await tempHome.writeImportFile('overwrite.json', {
        prod: {
          api_auth_token: 'auth-imported',
          api_key: 'api-imported'
        }
      });

      const result = await runBuiltCli(
        ['config', 'import', '--file', importFilePath, '--force', '--no-input'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain(
        `Imported 1 profile from "${importFilePath}".`
      );
      expect(result.stdout).toContain('Default profile remains "prod".');

      const savedConfig = await readJsonFile<ConfigFile>(tempHome.configPath);
      expect(savedConfig).toEqual({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'api-imported',
            auth_token: 'auth-imported',
            default_project_id: '46429',
            default_location: 'Delhi'
          }
        }
      });

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/iam/multi-crn/',
        query: {
          apikey: 'api-imported'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('surfaces alias-specific invalid credential errors during import', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/iam/multi-crn/': () => ({
        status: 401,
        body: {
          detail: 'Authentication credentials were not provided.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      const importFilePath = await tempHome.writeImportFile('invalid.json', {
        prod: {
          api_auth_token: 'auth-token-5678',
          api_key: 'api-key-1234'
        }
      });

      const result = await runBuiltCli(
        ['config', 'import', '--file', importFilePath, '--no-input'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(3);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Imported credentials for alias "prod" are invalid.\n\nDetails:\n- MyAccount API request failed: Authentication credentials were not provided.\n\nNext step: Verify the API key and auth token for that alias, then re-import the credentials.\n'
      );
      await expect(tempHome.readConfig()).resolves.toEqual({
        profiles: {}
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
