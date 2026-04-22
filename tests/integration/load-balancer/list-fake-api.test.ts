import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildListResponse() {
  return {
    code: 200,
    data: [
      {
        id: 1,
        appliance_name: 'my-alb',
        status: 'RUNNING',
        lb_mode: 'HTTP',
        lb_type: 'external',
        public_ip: '1.2.3.4'
      }
    ],
    errors: {},
    message: 'OK'
  };
}

describe('load-balancer list against a fake MyAccount API', () => {
  it('fetches load balancers and emits deterministic JSON', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildListResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'load-balancer', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        stableStringify({
          action: 'list',
          items: [
            {
              appliance_name: 'my-alb',
              id: 1,
              lb_mode: 'HTTP',
              lb_type: 'external',
              public_ip: '1.2.3.4',
              status: 'RUNNING'
            }
          ]
        }) + '\n'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('outputs human-readable table when --json is not passed', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildListResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['load-balancer', 'list'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('my-alb');
      expect(result.stdout).toContain('RUNNING');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
