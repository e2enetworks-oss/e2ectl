import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { runBuiltCli } from '../../helpers/process.js';
import { createTempHome } from '../../helpers/temp-home.js';

describe('node VPC actions against a fake MyAccount API', () => {
  it('attaches VPCs with the minimal backend payload and optional private IP', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/vpc/node/attach/': () => ({
        body: {
          code: 200,
          data: {
            project_id: '46429',
            vpc_id: 23082,
            vpc_name: 'prod-vpc'
          },
          errors: {},
          message: 'VPC attached successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'action',
          'vpc',
          'attach',
          '101',
          '--vpc-id',
          '23082',
          '--subnet-id',
          '991',
          '--private-ip',
          '10.0.0.25'
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
          action: 'vpc-attach',
          node_id: 101,
          result: {
            message: 'VPC attached successfully.',
            project_id: '46429'
          },
          vpc: {
            id: 23082,
            name: 'prod-vpc',
            private_ip: '10.0.0.25',
            subnet_id: 991
          }
        })}\n`
      );
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        action: 'attach',
        input_ip: '10.0.0.25',
        network_id: 23082,
        node_id: 101,
        subnet_id: 991
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('detaches VPCs without frontend-only fields', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/vpc/node/detach/': () => ({
        body: {
          code: 200,
          data: {
            project_id: '46429',
            vpc_id: 23082,
            vpc_name: 'prod-vpc'
          },
          errors: {},
          message: 'VPC detached successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'node',
          'action',
          'vpc',
          'detach',
          '101',
          '--vpc-id',
          '23082'
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
          action: 'vpc-detach',
          node_id: 101,
          result: {
            message: 'VPC detached successfully.',
            project_id: '46429'
          },
          vpc: {
            id: 23082,
            name: 'prod-vpc',
            private_ip: null,
            subnet_id: null
          }
        })}\n`
      );
      expect(JSON.parse(server.requests[0]!.body)).toEqual({
        action: 'detach',
        network_id: 23082,
        node_id: 101
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
