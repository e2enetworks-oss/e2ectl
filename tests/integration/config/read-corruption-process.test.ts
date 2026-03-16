import { chmod, mkdir, writeFile } from 'node:fs/promises';

import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('config read process flow', () => {
  it('fails with a controlled config error for malformed JSON', async () => {
    const tempHome = await createTempHome();

    try {
      await mkdir(tempHome.configDirectoryPath, { recursive: true });
      await writeFile(tempHome.configPath, '{"profiles":', 'utf8');
      await chmod(tempHome.configPath, 0o600);

      const result = await runBuiltCli(['config', 'list'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(result.exitCode).toBe(4);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Configuration file "~/.e2e/config.json" contains invalid JSON.\n' +
          '\n' +
          'Details:\n' +
          '- Path: ~/.e2e/config.json\n' +
          '\n' +
          'Next step: Repair or replace the config file with valid JSON, then retry.\n'
      );
    } finally {
      await tempHome.cleanup();
    }
  });

  it('fails with a controlled config error for wrong-shape config files', async () => {
    const tempHome = await createTempHome();

    try {
      await mkdir(tempHome.configDirectoryPath, { recursive: true });
      await writeFile(
        tempHome.configPath,
        JSON.stringify({
          profiles: []
        }),
        'utf8'
      );
      await chmod(tempHome.configPath, 0o600);

      const result = await runBuiltCli(['config', 'list'], {
        env: {
          HOME: tempHome.path
        }
      });

      expect(result.exitCode).toBe(4);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Configuration file "~/.e2e/config.json" is not a valid e2ectl config.\n' +
          '\n' +
          'Details:\n' +
          '- Path: ~/.e2e/config.json\n' +
          '- Problem: "profiles" must be an object keyed by alias.\n' +
          '\n' +
          'Next step: Restore a valid config file or re-import your credentials, then retry.\n'
      );
    } finally {
      await tempHome.cleanup();
    }
  });
});
