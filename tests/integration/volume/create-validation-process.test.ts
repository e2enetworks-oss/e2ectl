import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { formatCliCommand } from '../../../src/app/metadata.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('volume create validation through the built CLI', () => {
  it('rejects blank names before making network calls', async () => {
    const result = await runBuiltCli([
      'volume',
      'create',
      '--name',
      '',
      '--size',
      '250',
      '--billing-type',
      'hourly'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Name cannot be empty.\n\nNext step: Pass a non-empty value with --name.\n'
    );
  });

  it('rejects missing committed plan ids before making network calls', async () => {
    const result = await runBuiltCli([
      'volume',
      'create',
      '--name',
      'data-01',
      '--size',
      '250',
      '--billing-type',
      'committed'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      `Error: Committed plan ID is required when --billing-type committed is used.\n\nNext step: Run ${formatCliCommand('volume plans --size 250')}, then pass one plan id with --committed-plan-id.\n`
    );
  });

  it('rejects unexpected committed plan ids on hourly billing', async () => {
    const result = await runBuiltCli([
      'volume',
      'create',
      '--name',
      'data-01',
      '--size',
      '250',
      '--billing-type',
      'hourly',
      '--committed-plan-id',
      '31'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Committed plan ID can only be used with --billing-type committed.\n\nNext step: Remove --committed-plan-id, or switch to --billing-type committed.\n'
    );
  });

  it('rejects unexpected post-commit behavior on hourly billing', async () => {
    const result = await runBuiltCli([
      'volume',
      'create',
      '--name',
      'data-01',
      '--size',
      '250',
      '--billing-type',
      'hourly',
      '--post-commit-behavior',
      'auto-renew'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: --post-commit-behavior can only be used with --billing-type committed.\n\nNext step: Remove --post-commit-behavior, or switch to --billing-type committed.\n'
    );
  });

  it('rejects non-numeric volume sizes before making network calls', async () => {
    const result = await runBuiltCli([
      'volume',
      'create',
      '--name',
      'data-01',
      '--size',
      'two-fifty',
      '--billing-type',
      'hourly'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Size must be a positive integer.\n\nNext step: Pass a whole-number GB value with --size, for example 250.\n'
    );
  });

  it('rejects zero and negative volume sizes before making network calls', async () => {
    const zeroResult = await runBuiltCli([
      'volume',
      'create',
      '--name',
      'data-01',
      '--size',
      '0',
      '--billing-type',
      'hourly'
    ]);
    const negativeResult = await runBuiltCli([
      'volume',
      'create',
      '--name',
      'data-01',
      '--size=-1',
      '--billing-type',
      'hourly'
    ]);

    expect(zeroResult.exitCode).toBe(2);
    expect(zeroResult.stderr).toBe(
      'Error: Size must be greater than zero.\n\nNext step: Pass a positive GB value with --size, for example 250.\n'
    );
    expect(negativeResult.exitCode).toBe(2);
    expect(negativeResult.stderr).toBe(
      'Error: Size must be a positive integer.\n\nNext step: Pass a whole-number GB value with --size, for example 250.\n'
    );
  });

  it('fails clearly when no plan matches the requested size', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/block_storage/plans/': () => ({
        body: {
          code: 200,
          data: [
            {
              available_inventory_status: true,
              bs_size: 0.5,
              committed_sku: [],
              currency: 'INR',
              iops: 7500,
              name: '500 GB',
              price: 5
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'volume',
          'create',
          '--name',
          'data-01',
          '--size',
          '250',
          '--billing-type',
          'hourly'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        `Error: No active volume plan matches 250 GB in the selected location.\n\nNext step: Run ${formatCliCommand('volume plans')} to inspect available sizes, then retry with one of the listed GB values.\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails clearly when multiple active plans match the same size', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/block_storage/plans/': () => ({
        body: {
          code: 200,
          data: [
            {
              available_inventory_status: true,
              bs_size: 0.25,
              committed_sku: [],
              currency: 'INR',
              iops: 5000,
              name: '250 GB',
              price: 5
            },
            {
              available_inventory_status: true,
              bs_size: 0.25,
              committed_sku: [],
              currency: 'INR',
              iops: 6000,
              name: '250 GB',
              price: 5
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'volume',
          'create',
          '--name',
          'data-01',
          '--size',
          '250',
          '--billing-type',
          'hourly'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        `Error: Multiple active volume plans match 250 GB, so the CLI cannot derive a unique IOPS value safely.\n\nDetails:\n- size_gb=250, iops=5000, available=true, hourly_price=1.71\n- size_gb=250, iops=6000, available=true, hourly_price=1.71\n\nNext step: Review ${formatCliCommand('volume plans')} and wait for the platform plan set to become unambiguous for that size.\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
