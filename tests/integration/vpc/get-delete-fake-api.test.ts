import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('vpc get/delete against a fake MyAccount API', () => {
  it('gets one VPC and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/vpc/27835/': () => ({
        body: {
          code: 200,
          data: {
            created_at: '2026-03-13T08:00:00Z',
            gateway_ip: '10.20.0.1',
            ipv4_cidr: '10.20.0.0/23',
            is_e2e_vpc: true,
            location: 'Delhi',
            name: 'prod-vpc',
            network_id: 27835,
            project_name: 'default-project',
            state: 'Active',
            subnets: [],
            vm_count: 2
          },
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'vpc', 'get', '27835'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'get',
          vpc: {
            attached_vm_count: 2,
            cidr: '10.20.0.0/23',
            cidr_source: 'e2e',
            created_at: '2026-03-13T08:00:00Z',
            gateway_ip: '10.20.0.1',
            id: 27835,
            location: 'Delhi',
            name: 'prod-vpc',
            network_id: 27835,
            project_name: 'default-project',
            state: 'Active',
            subnet_count: 0,
            subnets: []
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('deletes one VPC with --force and emits deterministic json', async () => {
    const server = await startTestHttpServer({
      'DELETE /myaccount/api/v1/vpc/27835/': () => ({
        body: {
          code: 200,
          data: {
            project_id: '46429',
            vpc_id: 27835,
            vpc_name: 'prod-vpc'
          },
          errors: {},
          message: 'Delete Vpc Initiated Successfully'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'vpc', 'delete', '27835', '--force'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        `${stableStringify({
          action: 'delete',
          cancelled: false,
          message: 'Delete Vpc Initiated Successfully',
          vpc: {
            id: 27835,
            name: 'prod-vpc',
            project_id: '46429'
          }
        })}\n`
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
