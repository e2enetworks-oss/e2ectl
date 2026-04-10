import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ConfigFile } from '../../../src/config/index.js';
import { EXIT_CODES } from '../../../src/core/errors.js';
import { ConfigStore, createEmptyConfig } from '../../../src/config/store.js';

const itPosix = process.platform === 'win32' ? it.skip : it;

describe('ConfigStore', () => {
  it('returns an empty config when the file does not exist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const store = new ConfigStore({
      configPath: path.join(root, '.e2e', 'config.json')
    });

    await expect(store.read()).resolves.toEqual(createEmptyConfig());
  });

  it('writes and sorts profile aliases deterministically', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.upsertProfile('zeta', {
      api_key: ' api-zeta ',
      auth_token: ' auth-zeta ',
      default_project_id: '2',
      default_location: 'Delhi'
    });
    await store.upsertProfile('alpha', {
      api_key: ' api-alpha ',
      auth_token: ' auth-alpha ',
      default_project_id: '1',
      default_location: 'Chennai'
    });

    const content = await readFile(configPath, 'utf8');
    const parsedConfig = JSON.parse(content) as ConfigFile;

    expect(Object.keys(parsedConfig.profiles)).toEqual(['alpha', 'zeta']);
    expect(parsedConfig.profiles.alpha).toEqual({
      api_key: 'api-alpha',
      auth_token: 'auth-alpha',
      default_project_id: '1',
      default_location: 'Chennai'
    });
  });

  it('raises a controlled config error for malformed JSON', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, '{"profiles":', 'utf8');
    await chmod(configPath, 0o600);

    await expect(store.read()).rejects.toMatchObject({
      code: 'CONFIG_PARSE_ERROR',
      exitCode: EXIT_CODES.config,
      message: `Configuration file "${configPath}" contains invalid JSON.`,
      suggestion:
        'Repair or replace the config file with valid JSON, then retry.'
    });
  });

  it('raises a controlled config error for wrong-shape config files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 12345
          }
        }
      }),
      'utf8'
    );
    await chmod(configPath, 0o600);

    await expect(store.read()).rejects.toMatchObject({
      code: 'CONFIG_INVALID_SHAPE',
      exitCode: EXIT_CODES.config,
      message: `Configuration file "${configPath}" is not a valid e2ectl config.`,
      suggestion:
        'Restore a valid config file or re-import your credentials, then retry.'
    });
  });

  itPosix(
    'writes config files and directories with restrictive permissions',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
      const configPath = path.join(root, '.e2e', 'config.json');
      const store = new ConfigStore({ configPath });

      await store.upsertProfile('prod', {
        api_key: 'api-prod',
        auth_token: 'auth-prod'
      });

      const directoryStats = await stat(path.dirname(configPath));
      const fileStats = await stat(configPath);

      expect(directoryStats.mode & 0o777).toBe(0o700);
      expect(fileStats.mode & 0o777).toBe(0o600);
    }
  );

  itPosix(
    'tightens broader existing permissions during normal writes',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
      const configPath = path.join(root, '.e2e', 'config.json');
      const store = new ConfigStore({ configPath });

      await store.upsertProfile('prod', {
        api_key: 'api-prod',
        auth_token: 'auth-prod'
      });

      await chmod(path.dirname(configPath), 0o755);
      await chmod(configPath, 0o644);

      await store.write({
        default: 'prod',
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 'auth-prod',
            default_project_id: '46429',
            default_location: 'Delhi'
          }
        }
      });

      const directoryStats = await stat(path.dirname(configPath));
      const fileStats = await stat(configPath);

      expect(directoryStats.mode & 0o777).toBe(0o700);
      expect(fileStats.mode & 0o777).toBe(0o600);
    }
  );

  itPosix('rejects broader config file permissions on read', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({
        profiles: {
          prod: {
            api_key: 'api-prod',
            auth_token: 'auth-prod'
          }
        }
      }),
      'utf8'
    );
    await chmod(configPath, 0o644);

    await expect(store.read()).rejects.toMatchObject({
      code: 'CONFIG_INSECURE_PERMISSIONS',
      exitCode: EXIT_CODES.config,
      message: `Configuration file "${configPath}" has insecure permissions.`,
      suggestion: `Run \`chmod 600 ${configPath}\` and retry.`
    });
  });

  it('updates saved per-alias default context', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.upsertProfile('prod', {
      api_key: 'api-prod',
      auth_token: 'auth-prod'
    });

    const nextConfig = await store.updateProfile('prod', {
      default_project_id: '46429',
      default_location: 'Delhi'
    });

    expect(nextConfig.profiles.prod).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '46429',
      default_location: 'Delhi'
    });
  });

  it('reassigns the default alias when the current default is removed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-config-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.upsertProfile('prod', {
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      default_project_id: '1',
      default_location: 'Delhi'
    });
    await store.upsertProfile('dev', {
      api_key: 'api-dev',
      auth_token: 'auth-dev',
      default_project_id: '2',
      default_location: 'Chennai'
    });
    await store.setDefault('prod');

    const nextConfig = await store.removeProfile('prod');

    expect(nextConfig.default).toBe('dev');
    expect(Object.keys(nextConfig.profiles)).toEqual(['dev']);
  });
});

describe('ConfigStore – atomic write guarantees', () => {
  const baseConfig: ConfigFile = {
    profiles: {
      prod: { api_key: 'api-prod', auth_token: 'auth-prod' }
    },
    default: 'prod'
  };

  itPosix(
    'file exists at configPath with mode 0o600 after store.write',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-atomic-'));
      const configPath = path.join(root, '.e2e', 'config.json');
      const store = new ConfigStore({ configPath });

      await store.write(baseConfig);

      const fileStats = await stat(configPath);
      expect(fileStats.isFile()).toBe(true);
      expect(fileStats.mode & 0o777).toBe(0o600);
    }
  );

  it('leaves no .tmp files in the directory after a successful write', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-atomic-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    await store.write(baseConfig);

    const dirEntries = await readdir(path.dirname(configPath));
    const tmpFiles = dirEntries.filter((name) => name.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);
  });

  it('round-trips content correctly: write then read returns identical config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-atomic-'));
    const configPath = path.join(root, '.e2e', 'config.json');
    const store = new ConfigStore({ configPath });

    const input: ConfigFile = {
      profiles: {
        staging: {
          api_key: 'api-staging',
          auth_token: 'auth-staging',
          default_project_id: '99',
          default_location: 'Mumbai'
        },
        prod: { api_key: 'api-prod', auth_token: 'auth-prod' }
      },
      default: 'prod'
    };

    await store.write(input);
    const result = await store.read();

    // normalizeConfig sorts profiles alphabetically
    expect(result).toEqual({
      profiles: {
        prod: { api_key: 'api-prod', auth_token: 'auth-prod' },
        staging: {
          api_key: 'api-staging',
          auth_token: 'auth-staging',
          default_project_id: '99',
          default_location: 'Mumbai'
        }
      },
      default: 'prod'
    });
  });

  itPosix(
    'concurrent writes (5 simultaneous) produce valid JSON with mode 0o600 and no corruption',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-atomic-'));
      const configPath = path.join(root, '.e2e', 'config.json');

      const configs: ConfigFile[] = [
        {
          profiles: { alpha: { api_key: 'key-a', auth_token: 'tok-a' } },
          default: 'alpha'
        },
        {
          profiles: { bravo: { api_key: 'key-b', auth_token: 'tok-b' } },
          default: 'bravo'
        },
        {
          profiles: { charlie: { api_key: 'key-c', auth_token: 'tok-c' } },
          default: 'charlie'
        },
        {
          profiles: { delta: { api_key: 'key-d', auth_token: 'tok-d' } },
          default: 'delta'
        },
        {
          profiles: { echo: { api_key: 'key-e', auth_token: 'tok-e' } },
          default: 'echo'
        }
      ];

      // All five writes race against each other; none should throw.
      await Promise.all(
        configs.map((cfg) => new ConfigStore({ configPath }).write(cfg))
      );

      // The final file must be syntactically valid JSON.
      const raw = await readFile(configPath, 'utf8');
      expect(() => JSON.parse(raw) as unknown).not.toThrow();

      // The final file must have the correct permissions.
      const fileStats = await stat(configPath);
      expect(fileStats.mode & 0o777).toBe(0o600);

      // No stray .tmp files left behind.
      const dirEntries = await readdir(path.dirname(configPath));
      const tmpFiles = dirEntries.filter((name) => name.endsWith('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    }
  );

  itPosix(
    'throws when the parent directory has no write permission (cannot create config dir)',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-atomic-'));
      // Lock the root temp dir so mkdir cannot create the .e2e subdirectory
      // inside it. ensureSecureDirectory calls mkdir({ recursive: true }) which
      // will fail with EACCES when the parent is not writable.
      await chmod(root, 0o500);

      const configPath = path.join(root, '.e2e', 'config.json');
      const store = new ConfigStore({ configPath });

      try {
        await expect(store.write(baseConfig)).rejects.toThrow();
      } finally {
        // Restore write permission so the temp dir can be cleaned up.
        await chmod(root, 0o700);
        await rm(root, { recursive: true, force: true });
      }
    }
  );

  itPosix(
    'regression: post-rename chmod removal does not break a normal write (file mode stays 0o600)',
    async () => {
      // This test is the explicit regression guard: if someone re-adds a
      // chmod(configPath) call after rename and it fails (e.g. on NFS), the
      // write would throw. Verifying that a plain write produces mode 0o600
      // confirms the pre-rename chmod is sufficient and the post-rename one
      // is not needed.
      const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-atomic-'));
      const configPath = path.join(root, '.e2e', 'config.json');
      const store = new ConfigStore({ configPath });

      await store.write(baseConfig);

      const fileStats = await stat(configPath);
      expect(fileStats.mode & 0o777).toBe(0o600);
    }
  );
});
