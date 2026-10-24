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
    expect(result.stdout).toContain('myaccount');
  });

  it('lists every MyAccount product in the myaccount help', async () => {
    const result = await runBuiltCli(['myaccount', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    for (const product of [
      'project',
      'dbaas',
      'lb',
      'node',
      'image',
      'reserved-ip',
      'volume',
      'vpc',
      'security-group',
      'ssh-key',
      'ssl',
      'support-ticket'
    ]) {
      expect(result.stdout).toMatch(new RegExp(`^\\s+${product}\\b`, 'm'));
    }
  });

  it('does not expose config add in compiled help output', async () => {
    const result = await runBuiltCli(['config', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('import');
    expect(result.stdout).toContain('list');
    expect(result.stdout).not.toContain('set-context');
    expect(result.stdout).toContain('set-default');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).not.toMatch(/^\s+add\b/m);
  });
});
