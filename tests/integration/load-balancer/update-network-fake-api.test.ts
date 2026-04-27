import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

interface UpdateRequestBody {
  backends?: Array<{
    check_url?: unknown;
    http_check?: unknown;
  }>;
  lb_mode?: unknown;
  lb_reserve_ip?: unknown;
  lb_type?: unknown;
  ssl_certificate_id?: unknown;
  vpc_list?: unknown;
}

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
      appliance_instance: [
        {
          context: {
            acl_list: [],
            acl_map: [],
            backends: [
              {
                name: 'web',
                domain_name: 'example.com',
                backend_mode: 'http',
                balance: 'roundrobin',
                backend_ssl: false,
                http_check: true,
                check_url: '/',
                servers: [
                  {
                    backend_name: 'web-1',
                    backend_ip: '10.0.0.1',
                    backend_port: 8080
                  }
                ]
              }
            ],
            lb_port: '80',
            plan_name: 'LB-2',
            ssl_context: { redirect_to_https: false },
            tcp_backend: [],
            vpc_list: []
          }
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

function buildVpcGetResponse() {
  return {
    code: 200,
    data: {
      ipv4_cidr: '10.10.0.0/16',
      name: 'prod-vpc',
      network_id: 12345,
      state: 'Active'
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

describe('lb update and network commands against a fake MyAccount API', () => {
  it('lb update patches ALB protocol and SSL certificate into the full PUT body', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'update',
          '10',
          '--frontend-protocol',
          'HTTPS',
          '--ssl-certificate-id',
          '123'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const body = JSON.parse(server.requests[1]!.body) as UpdateRequestBody;
      expect(body.lb_mode).toBe('HTTPS');
      expect(body.ssl_certificate_id).toBe(123);
      expect(body.backends?.[0]?.http_check).toBe(true);
      expect(body.backends?.[0]?.check_url).toBe('/');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lb network reserve-ip attach sets the reserved public IP', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'reserve-ip', 'attach', '10', '203.0.113.10'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const body = JSON.parse(server.requests[1]!.body) as UpdateRequestBody;
      expect(body.lb_reserve_ip).toBe('203.0.113.10');
      expect(body.lb_type).toBe('external');
      expect(body.vpc_list).toEqual([]);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lb network vpc attach resolves VPC details and switches to internal', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      }),
      'GET /myaccount/api/v1/vpc/12345/': () => ({
        body: buildVpcGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'vpc', 'attach', '10', '--vpc', '12345'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const body = JSON.parse(server.requests[2]!.body) as UpdateRequestBody;
      expect(body.lb_type).toBe('internal');
      expect(body.lb_reserve_ip).toBe('');
      expect(body.vpc_list).toEqual([
        {
          ipv4_cidr: '10.10.0.0/16',
          network_id: 12345,
          vpc_name: 'prod-vpc'
        }
      ]);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
