import process from 'node:process';

import { runCommand } from '../../helpers/process.js';

describe('process helper', () => {
  it('kills timed out commands and includes command metadata in the error', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10_000);'], {
        timeoutMs: 50
      })
    ).rejects.toThrow(
      /Command timed out after \d+ms\.\nCommand: .*node.*\nArgs: -e setTimeout/
    );
  });
});
