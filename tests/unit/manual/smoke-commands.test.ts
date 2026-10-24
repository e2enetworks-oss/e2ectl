import { retryWhileBusy } from '../../../scripts/helpers/manual-smoke-cleanup.mjs';

const serverError = new Error(
  'Command failed: e2ectl myaccount node action volume detach 1\n- HTTP status: 500 Internal Server Error'
);

describe('retryWhileBusy', () => {
  it('retries a 500 until the command works', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('detached');

    await expect(
      retryWhileBusy(run, { attempts: 5, delayMs: 1 })
    ).resolves.toBe('detached');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt', async () => {
    const run = vi.fn(() => Promise.reject(serverError));

    await expect(retryWhileBusy(run, { attempts: 3, delayMs: 1 })).rejects.toBe(
      serverError
    );
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('retries when E2E asks to try again later', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Error(
          'Errors: "Failed to detach vpc. Please try again after some time."'
        )
      )
      .mockResolvedValueOnce('detached');

    await expect(
      retryWhileBusy(run, { attempts: 3, delayMs: 1 })
    ).resolves.toBe('detached');
  });

  it('does not retry a failure whose only "try again" is the CLI footer', async () => {
    const badRequest = new Error(
      'Command failed: e2ectl myaccount vpc delete 7\nNext step: Check the request inputs and try again.'
    );
    const run = vi.fn(() => Promise.reject(badRequest));

    await expect(retryWhileBusy(run, { attempts: 3, delayMs: 1 })).rejects.toBe(
      badRequest
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('sees a busy refusal kept in the error details', async () => {
    const busyError = Object.assign(
      new Error('MyAccount API request failed: Bad Request'),
      { details: ["Invalid node state to perform 'Delete' action."] }
    );
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(busyError)
      .mockResolvedValueOnce('deleted');

    await expect(
      retryWhileBusy(run, { attempts: 3, delayMs: 1 })
    ).resolves.toBe('deleted');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not retry other failures', async () => {
    const badRequest = new Error('- HTTP status: 400 Bad Request');
    const run = vi.fn(() => Promise.reject(badRequest));

    await expect(retryWhileBusy(run, { attempts: 3, delayMs: 1 })).rejects.toBe(
      badRequest
    );
    expect(run).toHaveBeenCalledTimes(1);
  });
});
