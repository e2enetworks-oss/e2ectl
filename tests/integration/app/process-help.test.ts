import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { runBuiltCli } from '../../helpers/process.js';

describe('built CLI help', () => {
  it('renders root help from the compiled entrypoint', async () => {
    const result = await runBuiltCli(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`Usage: ${CLI_COMMAND_NAME}`);
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('config');
    expect(result.stdout).toContain('node');
  });
});
