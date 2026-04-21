import { runBuiltCli } from '../../helpers/process.js';

describe('node create validation through the built CLI', () => {
  it('requires either a catalog image or a saved image id', async () => {
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
    expect(result.stderr).toBe(
      'Error: Either --image or --saved-image-id is required for node create.\n\nNext step: Use --image for a catalog image, or use --saved-image-id for a saved image.\n'
    );
  });

  it('rejects conflicting catalog image and saved image options', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--saved-image-id',
      '1001'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Pass either --image or --saved-image-id, not both.\n\nNext step: Use --image for catalog images, or use --saved-image-id for saved images.\n'
    );
  });
});
