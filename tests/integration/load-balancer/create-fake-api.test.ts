import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildCreateResponse() {
  return {
    code: 200,
    data: {
      appliance_id: 42,
      id: 'lb-42',
      resource_type: 'load_balancer',
      label_id: 'label-1'
    },
    errors: {},
    message: 'OK'
  };
}

describe('load-balancer create against a fake MyAccount API', () => {
  it('creates an ALB and emits deterministic JSON', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'load-balancer',
          'create',
          '--name',
          'my-alb',
          '--plan',
          'LB-2',
          '--mode',
          'HTTP',
          '--port',
          '80',
          '--backend-name',
          'web',
          '--server-ip',
          '10.0.0.1',
          '--server-port',
          '8080',
          '--server-name',
          'server-1'
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
        stableStringify({
          action: 'create',
          result: {
            appliance_id: 42,
            id: 'lb-42',
            label_id: 'label-1',
            resource_type: 'load_balancer'
          }
        }) + '\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('creates an NLB with TCP mode', async () => {
    const server = await startTestHttpServer({
      'POST /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          '--json',
          'load-balancer',
          'create',
          '--name',
          'my-nlb',
          '--plan',
          'LB-2',
          '--mode',
          'TCP',
          '--port',
          '80',
          '--backend-name',
          'tcp-grp',
          '--server-ip',
          '10.0.0.2',
          '--server-port',
          '8080',
          '--server-name',
          'srv-1',
          '--backend-port',
          '8080'
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
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
