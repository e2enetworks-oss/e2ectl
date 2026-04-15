import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { stableStringify } from '../../../src/core/json.js';
import { getNpmInvocation } from '../../helpers/npm.js';
import { runCommand } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('package install smoke from tarball', () => {
  it('packs, installs, and runs the published binary from a local tgz', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'e2ectl-package-'));
    const packDirectory = path.join(root, 'pack');
    const prefixDirectory = path.join(root, 'prefix');
    const cacheDirectory = path.join(root, 'npm-cache');
    const npmInvocation = getNpmInvocation();
    const tempHome = await createTempHome();
    const homeEnv = buildHomeEnv(tempHome.path);

    try {
      await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
      await mkdir(packDirectory, { recursive: true });
      await mkdir(prefixDirectory, { recursive: true });

      const packResult = await runCommand(
        npmInvocation.command,
        [
          ...npmInvocation.args,
          'pack',
          '--ignore-scripts',
          '--pack-destination',
          packDirectory
        ],
        {
          env: {
            ...homeEnv,
            npm_config_cache: cacheDirectory
          },
          timeoutMs: 30_000
        }
      );

      expect(packResult.exitCode).toBe(0);
      const tarballName = packResult.stdout.trim().split('\n').at(-1);

      expect(tarballName).toBeTruthy();

      const tarballPath = path.join(packDirectory, tarballName!);
      const installResult = await runCommand(
        npmInvocation.command,
        [
          ...npmInvocation.args,
          'install',
          '--prefix',
          prefixDirectory,
          tarballPath
        ],
        {
          env: {
            ...homeEnv,
            npm_config_cache: cacheDirectory
          },
          timeoutMs: 30_000
        }
      );

      expect(installResult.exitCode).toBe(0);

      const installedCliPath = path.join(
        prefixDirectory,
        'node_modules',
        '.bin',
        process.platform === 'win32'
          ? `${CLI_COMMAND_NAME}.cmd`
          : CLI_COMMAND_NAME
      );
      await access(installedCliPath);

      const installedEntrypointPath = path.join(
        prefixDirectory,
        'node_modules',
        '@e2enetworks-oss',
        'e2ectl',
        'dist',
        'app',
        'index.js'
      );
      const executableCommand =
        process.platform === 'win32' ? process.execPath : installedCliPath;
      const executableArgs =
        process.platform === 'win32'
          ? [installedEntrypointPath, '--help']
          : ['--help'];
      const helpResult = await runCommand(executableCommand, executableArgs, {
        env: homeEnv,
        timeoutMs: 30_000
      });

      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stderr).toBe('');
      expect(helpResult.stdout).toContain(`Usage: ${CLI_COMMAND_NAME}`);

      const jsonResult = await runCommand(
        executableCommand,
        process.platform === 'win32'
          ? [installedEntrypointPath, '--json', 'config', 'list']
          : ['--json', 'config', 'list'],
        {
          env: homeEnv,
          timeoutMs: 30_000
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
  }, 45_000);
});

function buildHomeEnv(homePath: string): NodeJS.ProcessEnv {
  return {
    HOME: homePath,
    USERPROFILE: homePath
  };
}
