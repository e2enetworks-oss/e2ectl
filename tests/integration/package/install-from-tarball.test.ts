import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { stableStringify } from '../../../src/core/json.js';
import { runCommand } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('package install smoke from tarball', () => {
  it('packs, installs, and runs the published binary from a local tgz', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-package-'));
    const packDirectory = path.join(root, 'pack');
    const prefixDirectory = path.join(root, 'prefix');
    const cacheDirectory = path.join(root, 'npm-cache');
    const tempHome = await createTempHome();

    try {
      await mkdir(packDirectory, { recursive: true });
      await mkdir(prefixDirectory, { recursive: true });

      const packResult = await runCommand(
        'npm',
        ['pack', '--pack-destination', packDirectory],
        {
          env: {
            HOME: tempHome.path,
            npm_config_cache: cacheDirectory
          }
        }
      );

      expect(packResult.exitCode).toBe(0);
      const tarballName = packResult.stdout.trim().split('\n').at(-1);

      expect(tarballName).toBeTruthy();

      const tarballPath = path.join(packDirectory, tarballName!);
      const installResult = await runCommand(
        'npm',
        ['install', '--prefix', prefixDirectory, tarballPath],
        {
          env: {
            HOME: tempHome.path,
            npm_config_cache: cacheDirectory
          }
        }
      );

      expect(installResult.exitCode).toBe(0);

      const installedCliPath = path.join(
        prefixDirectory,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'e2ectl.cmd' : 'e2ectl'
      );
      const helpResult = await runCommand(installedCliPath, ['--help'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stderr).toBe('');
      expect(helpResult.stdout).toContain('Usage: e2ectl');

      const jsonResult = await runCommand(
        installedCliPath,
        ['--json', 'config', 'list'],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(jsonResult.exitCode).toBe(0);
      expect(jsonResult.stderr).toBe('');
      expect(jsonResult.stdout).toBe(
        `${stableStringify({
          action: 'list',
          default: null,
          profiles: []
        })}\n`
      );
    } finally {
      await tempHome.cleanup();
      await rm(root, { force: true, recursive: true });
    }
  }, 15000);
});
