import { spawn } from 'node:child_process';
import path from 'node:path';

import { createTempHome } from '../../helpers/temp-home.js';

// `e2ectl ... | head -1` closes the pipe before the CLI finishes writing.
describe('built CLI writing into a closed pipe', () => {
  it('ends quietly with exit 0 instead of crashing', async () => {
    const tempHome = await createTempHome();

    try {
      const child = spawn(
        process.execPath,
        [path.join(process.cwd(), 'dist', 'app', 'index.js'), '--help'],
        {
          env: { ...process.env, HOME: tempHome.path },
          stdio: ['ignore', 'pipe', 'pipe']
        }
      );
      child.stdout.destroy();
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on('close', resolve);
      });

      expect(exitCode).toBe(0);
      expect(stderr).not.toContain('EPIPE');
    } finally {
      await tempHome.cleanup();
    }
  });
});
