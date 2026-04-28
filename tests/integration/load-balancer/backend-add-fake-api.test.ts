import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

interface JsonActionResult {
  action: string;
}

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
      appliance_instance: [
        {
          context: {
            acl_list: [],
            acl_map: [],
            backends: [],
            tcp_backend: [
              {
                backend_name: 'grp',
                port: 3000,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-1',
                    backend_ip: '10.0.0.1',
                    backend_port: 3000
                  }
                ]
              }
            ],
            lb_port: '3000',
            plan_name: 'LB-2',
            cn_id: 901,
            cn_status: 'auto_renew',
            lb_type: 'external',
            vpc_list: []
          }
        }
      ]
    },
    errors: {},
    message: 'OK'
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

describe('lb backend commands against a fake MyAccount API', () => {
  it('lb get — GET and renders details', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['lb', 'get', '10'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('my-alb');
      expect(result.stdout).toContain('Backend Groups');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group add — GET then PUT for new group', async () => {
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
          'lb',
          'backend-group',
          'add',
          '10',
          '--name',
          'web',
          '--backend-protocol',
          'HTTPS',
          '--backend-server',
          'server-2:10.0.0.5:8080'
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
      expect(result.stdout).toContain('added');
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
            http_check: true,
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

  it('backend-server add — GET then PUT adding server to existing group', async () => {
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
          'lb',
          'backend-server',
          'add',
          '10',
          '--backend-group',
          'web',
          '--backend-server',
          'server-2:10.0.0.5:8080'
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

  it('backend-group update — ALB changes algorithm and protocol', async () => {
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
          'lb',
          'backend-group',
          'update',
          '10',
          'web',
          '--algorithm',
          'leastconn',
          '--backend-protocol',
          'HTTPS'
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
      expect(result.stdout).toContain('Backend group "web" updated.');
      expect(result.stdout).toContain('leastconn');
      expect(result.stdout).toContain('HTTPS');
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toMatchObject({
        backends: [
          {
            name: 'web',
            backend_mode: 'https',
            backend_ssl: true,
            balance: 'leastconn'
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-server update — ALB changes server IP and port', async () => {
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
          'lb',
          'backend-server',
          'update',
          '10',
          '--backend-group',
          'web',
          '--backend-server-name',
          'server-1',
          '--ip',
          '10.0.0.9',
          '--port',
          '9090'
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
      expect(result.stdout).toContain('Server "server-1" updated');
      expect(result.stdout).toContain('10.0.0.9');
      expect(result.stdout).toContain('9090');
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toMatchObject({
        backends: [
          {
            name: 'web',
            servers: [
              {
                backend_name: 'server-1',
                backend_ip: '10.0.0.9',
                backend_port: 9090
              }
            ]
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-server update — fails before network when no changes are provided', async () => {
    const result = await runBuiltCli([
      'lb',
      'backend-server',
      'update',
      '10',
      '--backend-group',
      'web',
      '--backend-server-name',
      'server-1'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      'Provide --ip, --port, or both to update a backend server.'
    );
  });

  it('backend-group remove — GET then PUT removing group and stale ACLs', async () => {
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
        ['lb', 'backend-group', 'remove', '10', 'api'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Backend group "api" removed.');
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

  it('backend-server remove — GET then PUT removing one server from group', async () => {
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
          'lb',
          'backend-server',
          'remove',
          '10',
          '--backend-group',
          'web',
          '--backend-server-name',
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
        'Server "server-2" removed from backend group "web".'
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

  it('backend-group add — NLB', async () => {
    const nlbGetResponse = {
      code: 200,
      data: {
        id: 20,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '1.2.3.4',
        appliance_instance: [
          {
            context: {
              acl_list: [],
              acl_map: [],
              backends: [],
              tcp_backend: [],
              lb_port: '3000',
              plan_name: 'LB-2',
              cn_id: 901,
              cn_status: 'auto_renew',
              lb_type: 'external',
              vpc_list: []
            }
          }
        ]
      },
      errors: {},
      message: 'OK'
    };

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: nlbGetResponse
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/20/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'backend-group',
          'add',
          '20',
          '--name',
          'grp',
          '--backend-server',
          'srv-1:10.0.0.5:80'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('added');
      expect(result.stdout).toContain('grp');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group remove — NLB with multiple groups', async () => {
    const nlbTwoGroupsGetResponse = {
      code: 200,
      data: {
        id: 20,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '1.2.3.4',
        appliance_instance: [
          {
            context: {
              acl_list: [],
              acl_map: [],
              backends: [],
              tcp_backend: [
                {
                  backend_name: 'grp1',
                  port: 3000,
                  balance: 'roundrobin',
                  servers: [
                    {
                      backend_name: 'srv-1',
                      backend_ip: '10.0.0.1',
                      backend_port: 3000
                    }
                  ]
                },
                {
                  backend_name: 'grp2',
                  port: 3001,
                  balance: 'roundrobin',
                  servers: [
                    {
                      backend_name: 'srv-2',
                      backend_ip: '10.0.0.2',
                      backend_port: 3001
                    }
                  ]
                }
              ],
              lb_port: '3000',
              plan_name: 'LB-2',
              cn_id: 901,
              cn_status: 'auto_renew',
              lb_type: 'external',
              vpc_list: []
            }
          }
        ]
      },
      errors: {},
      message: 'OK'
    };

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: nlbTwoGroupsGetResponse
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/20/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['lb', 'backend-group', 'remove', '20', 'grp1'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('grp1');
      expect(result.stdout).toContain('removed');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-server add — NLB', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: buildNlbGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/20/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'backend-server',
          'add',
          '20',
          '--backend-group',
          'grp',
          '--backend-server',
          'srv-2:10.0.0.5:8080'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group update — NLB changes algorithm', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: buildNlbGetResponse()
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
        ['lb', 'backend-group', 'update', '20', 'grp', '--algorithm', 'source'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Backend group "grp" updated.');
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toMatchObject({
        lb_mode: 'TCP',
        tcp_backend: [
          {
            backend_name: 'grp',
            balance: 'source'
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-server update — NLB changes server port', async () => {
    const receivedPutBodies: unknown[] = [];

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: buildNlbGetResponse()
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
          'lb',
          'backend-server',
          'update',
          '20',
          '--backend-group',
          'grp',
          '--backend-server-name',
          'srv-1',
          '--port',
          '9090'
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
      expect(result.stdout).toContain('Server "srv-1" updated');
      expect(receivedPutBodies).toHaveLength(1);
      expect(
        JSON.parse((receivedPutBodies[0] as { body: string }).body)
      ).toMatchObject({
        lb_mode: 'TCP',
        tcp_backend: [
          {
            backend_name: 'grp',
            servers: [
              {
                backend_name: 'srv-1',
                backend_port: 9090
              }
            ]
          }
        ]
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-server remove — NLB', async () => {
    const nlbGetResponse = {
      code: 200,
      data: {
        id: 20,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '1.2.3.4',
        appliance_instance: [
          {
            context: {
              acl_list: [],
              acl_map: [],
              backends: [],
              tcp_backend: [
                {
                  backend_name: 'grp',
                  port: 3000,
                  balance: 'roundrobin',
                  servers: [
                    {
                      backend_name: 'srv-1',
                      backend_ip: '10.0.0.1',
                      backend_port: 3000
                    },
                    {
                      backend_name: 'srv-2',
                      backend_ip: '10.0.0.2',
                      backend_port: 3000
                    }
                  ]
                }
              ],
              lb_port: '3000',
              plan_name: 'LB-2',
              cn_id: 901,
              cn_status: 'auto_renew',
              lb_type: 'external',
              vpc_list: []
            }
          }
        ]
      },
      errors: {},
      message: 'OK'
    };

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: nlbGetResponse
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/20/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'backend-server',
          'remove',
          '20',
          '--backend-group',
          'grp',
          '--backend-server-name',
          'srv-2'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('srv-2');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group add — fails when ALB group name already exists (BACKEND_GROUP_EXISTS)', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'backend-group',
          'add',
          '10',
          '--name',
          'web',
          '--backend-server',
          'srv-1:10.0.0.5:80'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('already exists');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group add — fails when NLB already has a group (NLB_SINGLE_BACKEND_GROUP)', async () => {
    const nlbOneGroupGetResponse = {
      code: 200,
      data: {
        id: 20,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '1.2.3.4',
        appliance_instance: [
          {
            context: {
              acl_list: [],
              acl_map: [],
              backends: [],
              tcp_backend: [
                {
                  backend_name: 'grp',
                  port: 3000,
                  balance: 'roundrobin',
                  servers: [
                    {
                      backend_name: 'srv-1',
                      backend_ip: '10.0.0.1',
                      backend_port: 3000
                    }
                  ]
                }
              ],
              lb_port: '3000',
              plan_name: 'LB-2',
              cn_id: 901,
              cn_status: 'auto_renew',
              lb_type: 'external',
              vpc_list: []
            }
          }
        ]
      },
      errors: {},
      message: 'OK'
    };

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: nlbOneGroupGetResponse
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'backend-group',
          'add',
          '20',
          '--name',
          'newgrp',
          '--backend-server',
          'srv-1:10.0.0.5:80'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('already has a backend group');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group add — fails when --backend-server is missing (required option)', async () => {
    const nlbNoGroupsGetResponse = {
      code: 200,
      data: {
        id: 20,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '1.2.3.4',
        appliance_instance: [
          {
            context: {
              acl_list: [],
              acl_map: [],
              backends: [],
              tcp_backend: [],
              lb_port: '3000',
              plan_name: 'LB-2',
              cn_id: 901,
              cn_status: 'auto_renew',
              lb_type: 'external',
              vpc_list: []
            }
          }
        ]
      },
      errors: {},
      message: 'OK'
    };

    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/20/': () => ({
        body: nlbNoGroupsGetResponse
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'backend-group',
          'add',
          '20',
          '--name',
          'grp',
          '--backend-server',
          ':10.0.0.1:80'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--backend-server name');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('lb get — JSON output', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbGetResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(['--json', 'lb', 'get', '10'], {
        env: {
          HOME: tempHome.path,
          [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
        }
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as JsonActionResult;
      expect(parsed.action).toBe('get');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('backend-group remove — JSON output', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliances/10/': () => ({
        body: buildAlbWithTwoGroupsGetResponse()
      }),
      'PUT /myaccount/api/v1/appliances/load-balancers/10/': () => ({
        body: buildUpdateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        ['--json', 'lb', 'backend-group', 'remove', '10', 'api'],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as JsonActionResult;
      expect(parsed.action).toBe('backend-group-remove');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
