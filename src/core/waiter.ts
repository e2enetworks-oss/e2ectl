// Shared waiting helpers: pauses between retries, and loops that wait for the
// platform to catch up after a change.

export interface PollOptions {
  attempts: number;
  intervalMs: number;
}

export async function sleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// Calls `check` until it returns a value or the attempts run out, sleeping
// between tries. Returns undefined when nothing turned up.
export async function pollUntilFound<TResult>(
  check: () => Promise<TResult | undefined>,
  options: PollOptions
): Promise<TResult | undefined> {
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    const result = await check();

    if (result !== undefined) {
      return result;
    }

    if (attempt < options.attempts) {
      await sleep(options.intervalMs);
    }
  }

  return undefined;
}
