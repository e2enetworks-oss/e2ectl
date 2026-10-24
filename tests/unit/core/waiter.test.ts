import { pollUntilFound, sleep } from '../../../src/core/waiter.js';

describe('pollUntilFound', () => {
  it('returns the first value without waiting', async () => {
    const check = vi.fn(() => Promise.resolve('ready'));

    await expect(
      pollUntilFound(check, { attempts: 3, intervalMs: 1 })
    ).resolves.toBe('ready');
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('keeps checking until a value turns up', async () => {
    const check = vi
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('ready');

    await expect(
      pollUntilFound(check, { attempts: 5, intervalMs: 1 })
    ).resolves.toBe('ready');
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt', async () => {
    const check = vi.fn(() => Promise.resolve(undefined));

    await expect(
      pollUntilFound(check, { attempts: 3, intervalMs: 1 })
    ).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('passes errors from the check straight through', async () => {
    const check = vi.fn(() => Promise.reject(new Error('boom')));

    await expect(
      pollUntilFound(check, { attempts: 3, intervalMs: 1 })
    ).rejects.toThrow('boom');
    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe('sleep', () => {
  it('resolves after the given time', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      const pending = sleep(250).then(done);

      await vi.advanceTimersByTimeAsync(249);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(done).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
