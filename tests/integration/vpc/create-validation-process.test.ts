import { formatCliCommand } from '../../../src/app/metadata.js';
import { runBuiltCli } from '../../helpers/process.js';

describe('vpc create validation through the built CLI', () => {
  it('formats missing cidr-source usage failures through the CLI contract', async () => {
    const result = await runBuiltCli([
      'vpc',
      'create',
      '--name',
      'prod-vpc',
      '--billing-type',
      'hourly'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      "Error: required option '--cidr-source <cidrSource>' not specified\n\nNext step: Run the command again with --help for usage.\n"
    );
  });

  it('rejects missing custom CIDR values before making network calls', async () => {
    const result = await runBuiltCli([
      'vpc',
      'create',
      '--name',
      'prod-vpc',
      '--billing-type',
      'hourly',
      '--cidr-source',
      'custom'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: CIDR is required when --cidr-source custom is used.\n\nNext step: Pass a private CIDR block with --cidr, for example 10.10.0.0/23.\n'
    );
  });

  it('rejects missing committed plan ids before making network calls', async () => {
    const result = await runBuiltCli([
      'vpc',
      'create',
      '--name',
      'prod-vpc',
      '--billing-type',
      'committed',
      '--cidr-source',
      'e2e'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      `Error: Committed plan ID is required when --billing-type committed is used.\n\nNext step: Run ${formatCliCommand('vpc plans')} first, then pass one plan id with --committed-plan-id.\n`
    );
  });

  it('rejects invalid custom CIDR values before making network calls', async () => {
    const result = await runBuiltCli([
      'vpc',
      'create',
      '--name',
      'prod-vpc',
      '--billing-type',
      'hourly',
      '--cidr-source',
      'custom',
      '--cidr',
      '10.10.0.1/23'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: CIDR must be a valid IPv4 CIDR block.\n\nNext step: Pass a CIDR like 10.10.0.0/23 with a valid network address.\n'
    );
  });
});
