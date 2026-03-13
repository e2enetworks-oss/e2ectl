import { createTempHome } from '../../helpers/temp-home.js';
import { runBuiltCli } from '../../helpers/process.js';

describe('ssh-key create validation through the built CLI', () => {
  it('rejects blank public key content before making network calls', async () => {
    const tempHome = await createTempHome();

    try {
      const publicKeyPath = await tempHome.writeImportFile(
        'keys/blank.pub',
        '   '
      );

      const result = await runBuiltCli([
        'ssh-key',
        'create',
        '--label',
        'demo',
        '--public-key-file',
        publicKeyPath
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Public key content cannot be empty.\n\nNext step: Provide a file with SSH public key material, or pipe it in with --public-key-file -.\n'
      );
    } finally {
      await tempHome.cleanup();
    }
  });
});
