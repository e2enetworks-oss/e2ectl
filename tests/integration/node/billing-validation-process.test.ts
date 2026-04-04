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

  it('rejects non-numeric disk sizes before making network calls', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
      '--image',
      'Ubuntu-24.04-Distro',
      '--disk',
      'large'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Disk size must be a whole number of GB.\n\nNext step: Pass a positive integer with --disk, for example --disk 100.\n'
    );
  });

  it('rejects zero disk sizes before making network calls', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
      '--image',
      'Ubuntu-24.04-Distro',
      '--disk',
      '0'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Disk size must be in the range 75 GB to 2400 GB.\n\nNext step: Pass --disk with an allowed size. Allowed sizes: 75-2400 GB; 25 GB steps below 150 GB; 50 GB steps at or above 150 GB.\n'
    );
  });

  it('rejects missing disk on E1 node create before making network calls', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
      '--image',
      'Ubuntu-24.04-Distro'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Disk size is required for E1 and E1WC plans.\n\nNext step: Run e2ectl node catalog plans first, then retry with --disk <size-gb>. Allowed sizes: 75-2400 GB; 25 GB steps below 150 GB; 50 GB steps at or above 150 GB.\n'
    );
  });

  it('rejects disk on non-E1 node create before making network calls', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
      '--image',
      'Ubuntu-24.04-Distro',
      '--disk',
      '150'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Disk size can only be used with E1 or E1WC plans.\n\nNext step: Remove --disk, or retry with an E1 or E1WC plan from node catalog plans.\n'
    );
  });

  it('rejects E1 disk sizes that do not match platform increments', async () => {
    const result = await runBuiltCli([
      'node',
      'create',
      '--name',
      'demo-node',
      '--plan',
      'E1-2vCPU-6RAM-0DISK-E1.6GB-Ubuntu-24.04-Delhi',
      '--image',
      'Ubuntu-24.04-Distro',
      '--disk',
      '175'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Disk size at or above 150 GB must be a multiple of 50 GB.\n\nNext step: Pass --disk with an allowed size. Allowed sizes: 75-2400 GB; 25 GB steps below 150 GB; 50 GB steps at or above 150 GB.\n'
    );
  });
});
