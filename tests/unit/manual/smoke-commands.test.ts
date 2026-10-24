import { retryOnServerError } from '../../manual/helpers/smoke-commands.js';

const serverError = new Error(
  'Command failed: e2ectl myaccount node action volume detach 1\n- HTTP status: 500 Internal Server Error'
);

describe('retryOnServerError', () => {
  it('retries a 500 until the command works', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('detached');

    await expect(
      retryOnServerError(run, { attempts: 5, delayMs: 1 })
    ).resolves.toBe('detached');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt', async () => {
    const run = vi.fn(() => Promise.reject(serverError));

    await expect(
      retryOnServerError(run, { attempts: 3, delayMs: 1 })
    ).rejects.toBe(serverError);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('does not retry other failures', async () => {
    const badRequest = new Error('- HTTP status: 400 Bad Request');
    const run = vi.fn(() => Promise.reject(badRequest));

    await expect(
      retryOnServerError(run, { attempts: 3, delayMs: 1 })
    ).rejects.toBe(badRequest);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
