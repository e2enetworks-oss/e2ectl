import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildAlbGetResponse() {
  return {
    code: 200,
    data: {
      id: 10,
      appliance_name: 'my-alb',
      status: 'RUNNING',
      lb_mode: 'HTTP',
      lb_type: 'external',
      public_ip: '1.2.3.4',
      context: [
        {
          backends: [
            {
              name: 'web',
              domain_name: 'example.com',
              backend_mode: 'http',
              balance: 'roundrobin',
              backend_ssl: false,
              http_check: false,
              check_url: '/',
              servers: [
                {
                  backend_name: 'server-1',
                  backend_ip: '10.0.0.1',
                  backend_port: 8080
                }
              ]
            }
          ],
          tcp_backend: [],
          lb_port: '80',
          plan_name: 'LB-2'
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

function buildEmptyAlbGetResponse() {
  return {
    code: 200,
    data: {
      id: 10,
      appliance_name: 'my-alb',
      status: 'RUNNING',
      lb_mode: 'HTTP',
      lb_type: 'external',
      public_ip: '1.2.3.4',
      context: [
        {
          backends: [],
          tcp_backend: [],
          lb_port: '80',
          plan_name: 'LB-2'
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

function buildUpdateResponse() {
  return {
    code: 200,
    data: {},
    errors: {},
    message: 'Load balancer updated.'
  };
}

describe('load-balancer backend commands against a fake MyAccount API', () => {
  it('backend group list — GET and renders groups', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['load-balancer', 'backend', 'group', 'list', '10'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('web');
      expect(result.stdout).toContain('server-1');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend group create — GET then PUT for new group', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildEmptyAlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': (
        body: unknown
      ) => {
        receivedPutBodies.push(body);
        return { body: buildUpdateResponse() };
      }
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'load-balancer',
          'backend',
          'group',
          'create',
          '10',
          '--name',
          'web',
          '--server-ip',
          '10.0.0.5',
          '--server-port',
          '8080',
          '--server-name',
          'server-2'
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
      expect(result.stdout).toContain('web');
      expect(result.stdout).toContain('created');
      expect(receivedPutBodies).toHaveLength(1);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend server add — GET then PUT adding server to existing group', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildAlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': (
        body: unknown
      ) => {
        receivedPutBodies.push(body);
        return { body: buildUpdateResponse() };
      }
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'load-balancer',
          'backend',
          'server',
          'add',
          '10',
          '--backend-name',
          'web',
          '--server-ip',
          '10.0.0.5',
          '--server-port',
          '8080',
          '--server-name',
          'server-2'
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
      expect(result.stdout).toContain('server-2');
      expect(result.stdout).toContain('web');
      expect(receivedPutBodies).toHaveLength(1);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
