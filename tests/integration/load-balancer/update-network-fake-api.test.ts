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

interface AlbGetResponse {
  [key: string]: unknown;
  code: number;
  data: {
    appliance_instance: Array<{
      context: {
        acl_list: unknown[];
        acl_map: unknown[];
        backends: Array<Record<string, unknown>>;
        lb_port: string;
        lb_reserve_ip?: string;
        plan_name: string;
        ssl_context: {
          redirect_to_https: boolean;
          ssl_certificate_id?: number;
        };
        tcp_backend: unknown[];
        vpc_list: Array<{
          ipv4_cidr: string;
          network_id: number;
          vpc_name: string;
        }>;
      };
    }>;
    appliance_name: string;
    id: number;
    lb_mode: string;
    lb_type: string;
    node_detail: {
      allow_reserve_ip?: {
        is_already_reserved: boolean;
      };
      public_ip: string | null;
      vm_id?: number;
    };
    public_ip: string | null;
    status: string;
  };
  errors: Record<string, unknown>;
  message: string;
}

function buildAlbGetResponse(): AlbGetResponse {
  return {
    code: 200,
    data: {
      id: 10,
      appliance_name: 'my-alb',
      status: 'RUNNING',
      lb_mode: 'HTTP',
      lb_type: 'external',
      public_ip: '1.2.3.4',
      node_detail: {
        public_ip: '1.2.3.4',
        vm_id: 1001
      },
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

function buildNlbGetResponse() {
  return {
    code: 200,
    data: {
      id: 20,
      appliance_name: 'my-nlb',
      status: 'RUNNING',
      lb_mode: 'TCP',
      lb_type: 'external',
      public_ip: '1.2.3.4',
      node_detail: {
        public_ip: '1.2.3.4',
        vm_id: 1001
      },
      appliance_instance: [
        {
          context: {
            acl_list: [],
            acl_map: [],
            backends: [],
            lb_port: '3000',
            plan_name: 'LB-2',
            tcp_backend: [
              {
                backend_name: 'tcp',
                balance: 'roundrobin',
                port: 3000,
                servers: [
                  {
                    backend_name: 'srv-1',
                    backend_ip: '10.0.0.1',
                    backend_port: 3000
                  }
                ]
              }
            ],
            vpc_list: []
          }
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

function buildVpcAttachedAlbGetResponse() {
  const response = buildAlbGetResponse();
  response.data.lb_type = 'internal';
  response.data.appliance_instance[0]!.context.vpc_list = [
    {
      ipv4_cidr: '10.10.0.0/16',
      network_id: 12345,
      vpc_name: 'prod-vpc'
    }
  ];
  return response;
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

  it('lb network reserve-ip reserve reserves the current public IP', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      }),
      'POST /myaccount/api/v1/reserve_ips/1.2.3.4/actions/': () => ({
        body: {
          code: 200,
          data: {
            IP: '1.2.3.4',
            message: 'IP reserved successfully.',
            status: 'Available',
            vm_id: 1001,
            vm_name: 'my-alb'
          },
          errors: {},
          message: 'IP reserved successfully.'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'reserve-ip', 'reserve', '10'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const body = JSON.parse(server.requests[1]!.body) as {
        type?: string;
        vm_id?: number;
      };
      expect(body).toEqual({ type: 'live-reserve', vm_id: 1001 });
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

  it('fails when updating an NLB to an ALB protocol', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: buildNlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'update', '20', '--frontend-protocol', 'HTTP'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Cannot change an NLB');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when updating an ALB to TCP', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'update', '10', '--frontend-protocol', 'TCP'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Cannot change an ALB to TCP');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when updating an NLB with an SSL certificate', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: buildNlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'update', '20', '--ssl-certificate-id', '42'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        '--ssl-certificate-id is only valid for ALB'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when updating an ALB to HTTPS without an SSL certificate', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'update', '10', '--frontend-protocol', 'HTTPS'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('--ssl-certificate-id is required');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when redirect is requested without BOTH protocol', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'update', '10', '--redirect-http-to-https'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('--redirect-http-to-https');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lb network vpc detach removes the final VPC and switches to external', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildVpcAttachedAlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'vpc', 'detach', '10', '--vpc', '12345'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const body = JSON.parse(server.requests[1]!.body) as UpdateRequestBody;
      expect(body.lb_type).toBe('external');
      expect(body.vpc_list).toEqual([]);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when detaching a VPC that is not attached', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'vpc', 'detach', '10', '--vpc', '12345'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('is not attached');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when reserving a public IP that is already reserved', async () => {
    const response = buildAlbGetResponse();
    response.data.node_detail.allow_reserve_ip = {
      is_already_reserved: true
    };
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({ body: response })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'reserve-ip', 'reserve', '10'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('public IP is already reserved');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when reserving an LB without a public IPv4 address', async () => {
    const response = buildAlbGetResponse();
    response.data.public_ip = null;
    response.data.node_detail.public_ip = null;
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({ body: response })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'reserve-ip', 'reserve', '10'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('does not have a public IPv4 address');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when reserving an LB whose response omits VM ID', async () => {
    const response = buildAlbGetResponse();
    delete response.data.node_detail.vm_id;
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({ body: response })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'network', 'reserve-ip', 'reserve', '10'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(5);
      expect(result.stderr).toContain('did not include the VM ID');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
