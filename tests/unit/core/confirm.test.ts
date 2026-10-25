import { confirmUnlessForced } from '../../../src/core/confirm.js';

describe('confirmUnlessForced', () => {
  it('skips the question with --force', async () => {
    const confirm = vi.fn(() => Promise.resolve(false));

    expect(
      await confirmUnlessForced({ confirm, isInteractive: false }, true, 'Go?')
    ).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks in a terminal and returns the answer', async () => {
    const confirm = vi.fn(() => Promise.resolve(false));

    expect(
      await confirmUnlessForced({ confirm, isInteractive: true }, false, 'Go?')
    ).toBe(false);
    expect(confirm).toHaveBeenCalledWith('Go?');
  });

  it('fails without a terminal, naming the question and --force', async () => {
    await expect(
      confirmUnlessForced(
        { confirm: vi.fn(), isInteractive: false },
        undefined,
        'Delete it?'
      )
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      details: ['Delete it?'],
      suggestion: expect.stringContaining('--force') as string
    });
  });
});
