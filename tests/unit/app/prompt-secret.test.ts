import type { Writable } from 'node:stream';

import { createRuntime } from '../../../src/app/runtime.js';

// A stand-in terminal: it prints the question, then echoes what is typed,
// the way readline does, so the test can see whether the echo is hidden.
vi.mock('node:readline/promises', () => ({
  createInterface: ({ output }: { output: Writable }) => ({
    close: vi.fn(),
    question: (message: string) => {
      output.write(message);
      return new Promise<string>((resolve) => {
        setImmediate(() => {
          output.write('typed-secret');
          resolve('typed-secret');
        });
      });
    }
  })
}));

describe('promptSecret', () => {
  it('shows the question but not the typed secret', async () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    try {
      expect(await createRuntime().promptSecret('API key: ')).toBe(
        'typed-secret'
      );
      const printed = write.mock.calls.map((call) => String(call[0])).join('');
      expect(printed).toContain('API key: ');
      expect(printed).not.toContain('typed-secret');
    } finally {
      write.mockRestore();
    }
  });
});
