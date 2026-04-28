import { runBuiltCli } from '../../helpers/process.js';

describe('built CLI errors', () => {
  it('formats missing required options through the CLI contract', async () => {
    const result = await runBuiltCli(['node', 'create', '--plan', 'plan-123']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--name <name>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('formats invalid node ids through the CLI contract', async () => {
    const result = await runBuiltCli(['node', 'get', 'node-abc']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Node ID must be numeric.\n\nNext step: Pass the numeric node id as the first argument.\n'
    );
  });

  it('formats non-interactive delete confirmation failures through the CLI contract', async () => {
    const result = await runBuiltCli(['node', 'delete', '101']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Deleting a node requires confirmation in an interactive terminal.\n\nNext step: Re-run the command with --force to skip the prompt.\n'
    );
  });

  it('rejects retired load-balancer command aliases through the CLI contract', async () => {
    const result = await runBuiltCli(['load-balancer', 'list']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Unknown command "load-balancer".\n\nNext step: Use "lb" instead.\n'
    );
  });

  it('rejects retired lb network reserve-ip attach alias through the CLI contract', async () => {
    const result = await runBuiltCli([
      'lb',
      'network',
      'reserve-ip',
      'attach',
      '10'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Unknown command "lb network reserve-ip attach".\n\nNext step: Use "lb network reserve-ip reserve <lbId>" to reserve the current public IP.\n'
    );
  });
});
