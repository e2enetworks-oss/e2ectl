import { formatCliCommand } from '../../../src/app/metadata.js';
import { runBuiltCli } from '../../helpers/process.js';

describe('node billing validation through the built CLI', () => {
  it('rejects invalid billing types for catalog plans', async () => {
    const result = await runBuiltCli([
      'node',
      'catalog',
      'plans',
      '--display-category',
      'Linux Virtual Node',
      '--category',
      'Ubuntu',
      '--os',
      'Ubuntu',
      '--os-version',
      '24.04',
      '--billing-type',
      'weekly'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: option '--billing-type <billingType>' argument 'weekly' is invalid. Allowed choices are hourly, committed, all.\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('rejects committed node create without a committed plan id', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--billing-type',
      'committed'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      `Error: Committed plan ID is required when --billing-type committed is used.\n\nNext step: Run ${formatCliCommand('node catalog plans')} first, then pass one plan id with --committed-plan-id.\n`
    );
  });

  it('rejects committed plan ids on hourly node create', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--billing-type',
      'hourly',
      '--committed-plan-id',
      '2711'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Committed plan ID can only be used with --billing-type committed.\n\nNext step: Remove --committed-plan-id, or switch to --billing-type committed.\n'
    );
  });
});
