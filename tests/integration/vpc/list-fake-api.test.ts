import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('vpc list against a fake MyAccount API', () => {
  it('uses the documented list endpoint and emits sorted deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/vpc/list/': () => ({
        body: {
          code: 200,
          data: [
            {
              created_at: '2026-03-13T08:00:00Z',
              ipv4_cidr: '10.20.0.0/23',
              is_e2e_vpc: true,
              name: 'zeta-vpc',
              network_id: 22,
              state: 'Active',
              subnets: [],
              vm_count: 2
            },
            {
              created_at: '2026-03-13T09:00:00Z',
              ipv4_cidr: '10.10.0.0/23',
              is_e2e_vpc: false,
              name: 'alpha-vpc',
              network_id: 11,
              state: 'Creating',
              subnets: [],
              vm_count: 0
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

      const result = await runBuiltCli(['--json', 'vpc', 'list'], {
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
              attached_vm_count: 0,
              cidr: '10.10.0.0/23',
              cidr_source: 'custom',
              created_at: '2026-03-13T09:00:00Z',
              gateway_ip: null,
              location: null,
              name: 'alpha-vpc',
              network_id: 11,
              project_name: null,
              state: 'Creating',
              subnet_count: 0,
              subnets: []
            },
            {
              attached_vm_count: 2,
              cidr: '10.20.0.0/23',
              cidr_source: 'e2e',
              created_at: '2026-03-13T08:00:00Z',
              gateway_ip: null,
              location: null,
              name: 'zeta-vpc',
              network_id: 22,
              project_name: null,
              state: 'Active',
              subnet_count: 0,
              subnets: []
            }
          ],
          total_count: 2,
          total_page_number: 1
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'GET',
        pathname: '/myaccount/api/v1/vpc/list/',
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
