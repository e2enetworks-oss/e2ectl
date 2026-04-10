import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('vpc create against a fake MyAccount API', () => {
  it('sends committed billing and custom CIDR fields to the backend', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/vpc/': () => ({
        body: {
          code: 201,
          data: {
            is_credit_sufficient: true,
            network_id: 27835,
            project_id: '46429',
            vpc_id: 3956,
            vpc_name: 'prod-vpc'
          },
          errors: {},
          message: 'Created Successfully'
        },
        status: 201
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'vpc',
          'create',
          '--name',
          'prod-vpc',
          '--billing-type',
          'committed',
          '--cidr-source',
          'custom',
          '--cidr',
          '10.10.0.0/23',
          '--committed-plan-id',
          '91',
          '--post-commit-behavior',
          'hourly-billing'
        ],
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
          action: 'create',
          billing: {
            committed_plan_id: 91,
            post_commit_behavior: 'hourly-billing',
            type: 'committed'
          },
          cidr: {
            source: 'custom',
            value: '10.10.0.0/23'
          },
          credit_sufficient: true,
          vpc: {
            name: 'prod-vpc',
            network_id: 27835,
            project_id: '46429',
            vpc_id: 3956
          }
        })}\n`
      );

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/myaccount/api/v1/vpc/',
        query: {
          apikey: 'prod-api-key',
          location: 'Delhi',
          project_id: '46429'
        }
      });
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        cn_id: 91,
        cn_status: 'hourly_billing',
        ipv4: '10.10.0.0/23',
        is_e2e_vpc: false,
        vpc_name: 'prod-vpc'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
