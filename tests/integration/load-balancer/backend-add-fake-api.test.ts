import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildAlbContext(
  backends: object[],
  overrides?: {
    acl_list?: object[];
    acl_map?: object[];
  }
) {
  return {
    acl_list: overrides?.acl_list ?? [],
    acl_map: overrides?.acl_map ?? [],
    backends,
    cn_id: 901,
    cn_status: 'auto_renew',
    tcp_backend: [],
    lb_port: '80',
    plan_name: 'LB-2',
    ssl_context: {
      redirect_to_https: true
    },
    vpc_list: [
      {
        ipv4_cidr: '10.10.0.0/16',
        network_id: 12345,
        vpc_name: 'prod-vpc'
      }
    ]
  };
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
          context: buildAlbContext([
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
          ])
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
      appliance_instance: [
        {
          context: buildAlbContext([])
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

function buildAlbWithTwoGroupsGetResponse() {
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
          context: buildAlbContext(
            [
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
                  },
                  {
                    backend_name: 'server-2',
                    backend_ip: '10.0.0.5',
                    backend_port: 8080
                  }
                ]
              },
              {
                name: 'api',
                domain_name: 'api.example.com',
                backend_mode: 'http',
                balance: 'leastconn',
                backend_ssl: false,
                http_check: true,
                check_url: '/health',
                servers: [
                  {
                    backend_name: 'api-1',
                    backend_ip: '10.0.0.9',
                    backend_port: 9000
                  }
                ]
              }
            ],
            {
              acl_list: [
                {
                  acl_condition: 'path_beg',
                  acl_matching_path: '/web',
                  acl_name: 'acl-web'
                },
                {
                  acl_condition: 'path_beg',
                  acl_matching_path: '/api',
                  acl_name: 'acl-api'
                }
              ],
              acl_map: [
                {
                  acl_backend: 'web',
                  acl_condition_state: true,
                  acl_name: 'acl-web'
                },
                {
                  acl_backend: 'api',
                  acl_condition_state: true,
                  acl_name: 'acl-api'
                }
              ]
            }
          )
        }
      ]
    },
    errors: {},
    message: 'OK'
  };
}

describe('load-balancer backend commands against a fake MyAccount API', () => {
  it('backend group list — GET and renders groups', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
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
      expect(result.stdout).toContain('1');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend group create — GET then PUT for new group', async () => {
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
          'web',
          '--backend-protocol',
          'HTTPS',
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
      expect(result.stdout).toContain('Protocol');
      expect(result.stdout).toContain('HTTPS');
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toEqual({
        acl_list: [],
        acl_map: [],
        backends: [
          {
            backend_mode: 'https',
            backend_ssl: true,
            balance: 'roundrobin',
            check_url: '/',
            domain_name: 'localhost',
            http_check: false,
            name: 'web',
            servers: [
              {
                backend_ip: '10.0.0.5',
                backend_name: 'server-2',
                backend_port: 8080
              }
            ]
          }
        ],
        client_timeout: 60,
        cn_id: 901,
        cn_status: 'auto_renew',
        connection_timeout: 60,
        http_keep_alive_timeout: 60,
        lb_mode: 'HTTP',
        lb_name: 'my-alb',
        lb_port: '80',
        lb_type: 'external',
        node_list_type: 'D',
        plan_name: 'LB-2',
        server_timeout: 60,
        ssl_context: {
          redirect_to_https: true
        },
        tcp_backend: [],
        vpc_list: [
          {
            ipv4_cidr: '10.10.0.0/16',
            network_id: 12345,
            vpc_name: 'prod-vpc'
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend server add — GET then PUT adding server to existing group', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
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
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toEqual({
        acl_list: [],
        acl_map: [],
        backends: [
          {
            backend_mode: 'http',
            backend_ssl: false,
            balance: 'roundrobin',
            check_url: '/',
            domain_name: 'example.com',
            http_check: false,
            name: 'web',
            servers: [
              {
                backend_ip: '10.0.0.1',
                backend_name: 'server-1',
                backend_port: 8080
              },
              {
                backend_ip: '10.0.0.5',
                backend_name: 'server-2',
                backend_port: 8080
              }
            ]
          }
        ],
        client_timeout: 60,
        cn_id: 901,
        cn_status: 'auto_renew',
        connection_timeout: 60,
        http_keep_alive_timeout: 60,
        lb_mode: 'HTTP',
        lb_name: 'my-alb',
        lb_port: '80',
        lb_type: 'external',
        node_list_type: 'D',
        plan_name: 'LB-2',
        server_timeout: 60,
        ssl_context: {
          redirect_to_https: true
        },
        tcp_backend: [],
        vpc_list: [
          {
            ipv4_cidr: '10.10.0.0/16',
            network_id: 12345,
            vpc_name: 'prod-vpc'
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend group delete — GET then PUT removing group and stale ACLs', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbWithTwoGroupsGetResponse()
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
        ['load-balancer', 'backend', 'group', 'delete', '10', 'api'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Backend group "api" deleted.');
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toMatchObject({
        acl_list: [
          {
            acl_condition: 'path_beg',
            acl_matching_path: '/web',
            acl_name: 'acl-web'
          }
        ],
        acl_map: [
          {
            acl_backend: 'web',
            acl_condition_state: true,
            acl_name: 'acl-web'
          }
        ],
        backends: [
          {
            name: 'web'
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend server delete — GET then PUT removing one server from group', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbWithTwoGroupsGetResponse()
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
          'server',
          'delete',
          '10',
          '--backend-name',
          'web',
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
      expect(result.stdout).toContain(
        'Server "server-2" deleted from backend group "web".'
      );
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toMatchObject({
        backends: [
          {
            name: 'web',
            servers: [
              {
                backend_ip: '10.0.0.1',
                backend_name: 'server-1',
                backend_port: 8080
              }
            ]
          },
          {
            name: 'api'
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
