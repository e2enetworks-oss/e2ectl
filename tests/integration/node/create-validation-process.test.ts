import { runBuiltCli } from '../../helpers/process.js';

describe('node create validation through the built CLI', () => {
  it('requires --image for node create', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'plan-123'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--image is required for node create.');
  });

  it('rejects a non-numeric --saved-image-template-id', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--saved-image-template-id',
      'not-a-number'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Saved image template ID must be numeric.');
  });
});
