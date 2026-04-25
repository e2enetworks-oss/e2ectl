import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildUpdateResponse() {
  return {
    code: 200,
    data: {},
    errors: {},
    message: 'Load balancer updated.'
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
      appliance_instance: [
        {
          context: {
            acl_list: [],
            acl_map: [],
            backends: [],
            tcp_backend: [],
            lb_port: '80',
            plan_name: 'LB-2',
            node_list_type: 'S',
            cn_id: 0,
            cn_status: 'auto_renew',
            vpc_list: []
          }
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

function buildEmptyNlbGetResponse() {
  return {
    code: 200,
    data: {
      id: 20,
      appliance_name: 'my-nlb',
      status: 'RUNNING',
      lb_mode: 'TCP',
      lb_type: 'external',
      public_ip: '5.6.7.8',
      appliance_instance: [
        {
          context: {
            acl_list: [],
            acl_map: [],
            backends: [],
            tcp_backend: [],
            lb_port: '3000',
            plan_name: 'LB-2',
            node_list_type: 'S',
            cn_id: 0,
            cn_status: 'auto_renew',
            vpc_list: []
          }
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

describe('load-balancer backend-group create against a fake MyAccount API', () => {
  it('ALB backend group create — PUT body has backends entry and empty tcp_backend', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildEmptyAlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': (request) => {
        receivedPutBodies.push(request);
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
          'mygroup',
          '--backend-protocol',
          'HTTP'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mygroup');

      expect(receivedPutBodies).toHaveLength(1);
      const body = JSON.parse(
        (receivedPutBodies[0] as { body: string }).body
      ) as Record<string, unknown>;

      expect(Array.isArray(body['backends'])).toBe(true);
      expect((body['backends'] as unknown[]).length).toBe(1);
      expect((body['backends'] as Array<{ name: string }>)[0]!.name).toBe(
        'mygroup'
      );

      expect(Array.isArray(body['tcp_backend'])).toBe(true);
      expect((body['tcp_backend'] as unknown[]).length).toBe(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('NLB backend group create — PUT body has tcp_backend entry and empty backends', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: buildEmptyNlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/20/': (request) => {
        receivedPutBodies.push(request);
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
          '20',
          '--name',
          'mygroup',
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
      expect(result.stdout).toContain('mygroup');

      expect(receivedPutBodies).toHaveLength(1);
      const body = JSON.parse(
        (receivedPutBodies[0] as { body: string }).body
      ) as Record<string, unknown>;

      expect(Array.isArray(body['tcp_backend'])).toBe(true);
      expect((body['tcp_backend'] as unknown[]).length).toBe(1);
      expect(
        (body['tcp_backend'] as Array<{ backend_name: string }>)[0]!
          .backend_name
      ).toBe('mygroup');

      expect(Array.isArray(body['backends'])).toBe(true);
      expect((body['backends'] as unknown[]).length).toBe(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
