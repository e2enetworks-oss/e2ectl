import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('volume plans validation through the built CLI', () => {
  it('rejects non-numeric size filters before making network calls', async () => {
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['volume', 'plans', '--size', 'two-fifty'],
        {
          env: {
            HOME: tempHome.path
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'Error: Size must be a positive integer.\n\nNext step: Pass a whole-number GB value with --size, for example 250.\n'
      );
    } finally {
      await tempHome.cleanup();
    }
  });

  it('fails clearly when a requested size is only unavailable inventory', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/block_storage/plans/': () => ({
        body: {
          code: 200,
          data: [
            {
              available_inventory_status: false,
              bs_size: 0.25,
              committed_sku: [],
              currency: 'INR',
              iops: 5000,
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
        ['volume', 'plans', '--size', '250', '--available-only'],
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
        'Error: Volume size 250 GB is currently unavailable in inventory.\n\nNext step: Remove --available-only to inspect that size, or choose another size marked as available.\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
