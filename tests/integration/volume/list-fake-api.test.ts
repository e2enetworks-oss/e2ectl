import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('volume list against a fake MyAccount API', () => {
  it('uses the block storage list endpoint and emits sorted deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/block_storage/': () => ({
        body: {
          code: 200,
          data: [
            {
              block_id: 22,
              name: 'zeta-data',
              size: 476837,
              size_string: '500 GB',
              status: 'Attached',
              vm_detail: {
                node_id: 301,
                vm_id: 100157,
                vm_name: 'node-b'
              }
            },
            {
              block_id: 11,
              name: 'alpha-data',
              size: 238419,
              size_string: '250 GB',
              status: 'Available',
              vm_detail: {}
            }
          ],
          errors: {},
          message: 'OK',
          total_count: 2,
          total_page_number: 1
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'volume', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'list',
          items: [
            {
              attached: false,
              attachment: null,
              id: 11,
              name: 'alpha-data',
              size_gb: 250,
              size_label: '250 GB',
              status: 'Available'
            },
            {
              attached: true,
              attachment: {
                node_id: 301,
                vm_id: 100157,
                vm_name: 'node-b'
              },
              id: 22,
              name: 'zeta-data',
              size_gb: 500,
              size_label: '500 GB',
              status: 'Attached'
            }
          ],
          total_count: 2,
          total_page_number: 1
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/block_storage/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          page_no: '1',
          per_page: '100',
          project_id: '46429'
        }
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
