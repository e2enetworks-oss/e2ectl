import { runBuiltCli } from '../../helpers/process.js';

describe('image import validation through the built CLI', () => {
  it('rejects blank urls before making network calls', async () => {
    const result = await runBuiltCli([
      'image',
      'import',
      '--name',
      'imported-image',
      '--url',
      '   '
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: URL cannot be empty.\n\nNext step: Pass a non-empty value with --url.\n'
    );
  });
});
