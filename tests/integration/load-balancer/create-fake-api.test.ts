import { MYACCOUNT_BASE_URL_ENV_VAR } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import { seedDefaultProfile } from '../../helpers/config-fixtures.js';
import { runBuiltCli } from '../../helpers/process.js';
import { startTestHttpServer } from '../../helpers/http-server.js';
import { createTempHome } from '../../helpers/temp-home.js';

function buildPlansResponse() {
  return {
    code: 200,
    data: [
      {
        appliance_config: [
          {
            committed_sku: [
              {
                committed_days: 90,
                committed_sku_id: 901,
                committed_sku_name: '90 Days',
                committed_sku_price: 5000
              }
            ],
            disk: 50,
            hourly: 3,
            name: 'LB-2',
            price: 2000,
            ram: 4,
            template_id: 'plan-1',
            vcpu: 2
          }
        ]
      }
    ],
    errors: {},
    message: 'OK'
  };
}

function buildPlansResponseWithoutCommittedOptions() {
  return {
    code: 200,
    data: [
      {
        appliance_config: [
          {
            committed_sku: [],
            disk: 50,
            hourly: 3,
            name: 'LB-2',
            price: 2000,
            ram: 4,
            template_id: 'plan-1',
            vcpu: 2
          }
        ]
      }
    ],
    errors: {},
    message: 'OK'
  };
}

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

function baseCreateArgs(overrides: string[] = []) {
  return [
    'lb',
    'create',
    '--name',
    'test',
    '--plan',
    'LB-2',
    '--frontend-protocol',
    'HTTP',
    '--port',
    '80',
    '--backend-group',
    'web',
    '--backend-server',
    's1:10.0.0.1:8080',
    ...overrides
  ];
}

describe('lb create against a fake MyAccount API', () => {
  it('fails before network when --reserve-ip is combined with --vpc', async () => {
    const result = await runBuiltCli([
      'lb',
      'create',
      '--name',
      'bad-lb',
      '--plan',
      'LB-2',
      '--frontend-protocol',
      'HTTP',
      '--vpc',
      '12345',
      '--reserve-ip',
      '1.2.3.4',
      '--backend-group',
      'web',
      '--backend-server',
      'server-1:10.0.0.1:8080'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--reserve-ip cannot be used with --vpc.');
  });

  it('fails before network when TCP create omits --port', async () => {
    const result = await runBuiltCli([
      'lb',
      'create',
      '--name',
      'bad-nlb',
      '--plan',
      'LB-2',
      '--frontend-protocol',
      'TCP',
      '--backend-group',
      'tcp',
      '--backend-server',
      'server-1:10.0.0.1:8080'
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      '--port is required for TCP load balancers.'
    );
  });

  it('creates an ALB and emits deterministic JSON', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      }),
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
          'lb',
          'create',
          '--name',
          'my-alb',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--backend-group',
          'web',
          '--backend-server',
          'server-1:10.0.0.1:8080'
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
          backend: {
            backend_port: null,
            health_check: true,
            name: 'web',
            protocol: 'HTTP',
            routing_policy: 'roundrobin',
            servers: [
              {
                backend_ip: '10.0.0.1',
                backend_name: 'server-1',
                backend_port: 8080
              }
            ]
          },
          billing: {
            committed_plan_id: null,
            committed_plan_name: null,
            post_commit_behavior: null,
            type: 'hourly'
          },
          requested: {
            frontend_port: 80,
            mode: 'HTTP',
            name: 'my-alb',
            plan_name: 'LB-2',
            type: 'external'
          },
          result: {
            appliance_id: 42,
            id: 'lb-42',
            label_id: 'label-1',
            resource_type: 'load_balancer'
          }
        }) + '\n'
      );
      expect(server.requests).toHaveLength(2);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        acl_list: [],
        acl_map: [],
        backends: [
          {
            target: 'networkMappingNode',
            backend_mode: 'http',
            backend_ssl: false,
            balance: 'roundrobin',
            checkbox_enable: true,
            check_url: '/',
            domain_name: 'localhost',
            http_check: true,
            name: 'web',
            scaler_id: null,
            scaler_port: null,
            servers: [
              {
                backend_ip: '10.0.0.1',
                backend_name: 'server-1',
                backend_port: 8080,
                target: 'backend'
              }
            ],
            websocket_timeout: null
          }
        ],
        checkbox_enable: '',
        client_timeout: 60,
        connection_timeout: 60,
        http_keep_alive_timeout: 60,
        is_ipv6_attached: false,
        lb_mode: 'HTTP',
        lb_name: 'my-alb',
        lb_port: '80',
        lb_reserve_ip: '',
        lb_type: 'external',
        default_backend: '',
        enable_bitninja: false,
        node_list_type: 'D',
        ssl_certificate_id: null,
        ssl_context: { redirect_to_https: false },
        plan_name: 'LB-2',
        server_timeout: 60,
        tcp_backend: [],
        vpc_list: []
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('creates an NLB with TCP mode', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      }),
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
          'lb',
          'create',
          '--name',
          'my-nlb',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'TCP',
          '--port',
          '80',
          '--backend-group',
          'tcp-grp',
          '--backend-server',
          'srv-1:10.0.0.2:8080'
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
      expect(server.requests).toHaveLength(2);
      expect(JSON.parse(server.requests[1]!.body)).toEqual({
        acl_list: [],
        acl_map: [],
        backends: [],
        checkbox_enable: '',
        client_timeout: 60,
        connection_timeout: 60,
        http_keep_alive_timeout: 60,
        is_ipv6_attached: false,
        lb_mode: 'TCP',
        lb_name: 'my-nlb',
        lb_port: '80',
        lb_reserve_ip: '',
        lb_type: 'external',
        default_backend: '',
        enable_bitninja: false,
        node_list_type: 'D',
        ssl_certificate_id: null,
        ssl_context: { redirect_to_https: false },
        plan_name: 'LB-2',
        server_timeout: 60,
        tcp_backend: [
          {
            backend_name: 'tcp-grp',
            balance: 'roundrobin',
            port: 80,
            servers: [
              {
                backend_ip: '10.0.0.2',
                backend_name: 'srv-1',
                backend_port: 8080,
                target: 'backend'
              }
            ]
          }
        ],
        vpc_list: []
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('creates an external ALB with an available reserved IP', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/reserve_ips/': () => ({
        body: {
          code: 200,
          data: [
            {
              floating_ip_attached_nodes: [],
              ip_address: '9.9.9.9',
              status: 'Reserved'
            }
          ],
          errors: {},
          message: 'OK'
        }
      }),
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      }),
      'POST /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'create',
          '--name',
          'reserved-alb',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--backend-group',
          'web',
          '--backend-server',
          's1:10.0.0.1:8080',
          '--reserve-ip',
          '9.9.9.9'
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
      expect(JSON.parse(server.requests[2]!.body)).toMatchObject({
        lb_name: 'reserved-alb',
        lb_reserve_ip: '9.9.9.9',
        lb_type: 'external'
      });
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('creates a committed internal LB with vpc_list and cn_* fields', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: {
          code: 200,
          data: [
            {
              appliance_config: [
                {
                  committed_sku: [
                    {
                      committed_days: 90,
                      committed_sku_id: 901,
                      committed_sku_name: '90 Days',
                      committed_sku_price: 5000
                    }
                  ],
                  disk: 50,
                  hourly: 3,
                  name: 'LB-2',
                  price: 2000,
                  ram: 4,
                  template_id: 'plan-1',
                  vcpu: 2
                }
              ]
            }
          ],
          errors: {},
          message: 'OK'
        }
      }),
      'GET /myaccount/api/v1/vpc/12345/': () => ({
        body: {
          code: 200,
          data: {
            ipv4_cidr: '10.10.0.0/16',
            is_e2e_vpc: false,
            name: 'prod-vpc',
            network_id: 12345,
            state: 'Active'
          },
          errors: {},
          message: 'OK'
        }
      }),
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
          'lb',
          'create',
          '--name',
          'internal-committed-alb',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--vpc',
          '12345',
          '--committed-plan',
          '90 Days',
          '--post-commit-behavior',
          'hourly-billing',
          '--backend-group',
          'web',
          '--backend-server',
          'server-1:10.0.0.1:80'
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
          backend: {
            backend_port: null,
            health_check: true,
            name: 'web',
            protocol: 'HTTP',
            routing_policy: 'roundrobin',
            servers: [
              {
                backend_ip: '10.0.0.1',
                backend_name: 'server-1',
                backend_port: 80
              }
            ]
          },
          billing: {
            committed_plan_id: 901,
            committed_plan_name: '90 Days',
            post_commit_behavior: 'hourly_billing',
            type: 'committed'
          },
          requested: {
            frontend_port: 80,
            mode: 'HTTP',
            name: 'internal-committed-alb',
            plan_name: 'LB-2',
            type: 'internal'
          },
          result: {
            appliance_id: 42,
            id: 'lb-42',
            label_id: 'label-1',
            resource_type: 'load_balancer'
          }
        }) + '\n'
      );
      expect(server.requests).toHaveLength(3);
      expect(JSON.parse(server.requests[2]!.body)).toEqual({
        acl_list: [],
        acl_map: [],
        backends: [
          {
            target: 'networkMappingNode',
            backend_mode: 'http',
            backend_ssl: false,
            balance: 'roundrobin',
            checkbox_enable: true,
            check_url: '/',
            domain_name: 'localhost',
            http_check: true,
            name: 'web',
            scaler_id: null,
            scaler_port: null,
            servers: [
              {
                backend_ip: '10.0.0.1',
                backend_name: 'server-1',
                backend_port: 80,
                target: 'backend'
              }
            ],
            websocket_timeout: null
          }
        ],
        checkbox_enable: '',
        client_timeout: 60,
        cn_id: 901,
        cn_status: 'hourly_billing',
        connection_timeout: 60,
        http_keep_alive_timeout: 60,
        is_ipv6_attached: false,
        lb_mode: 'HTTP',
        lb_name: 'internal-committed-alb',
        lb_port: '80',
        lb_reserve_ip: '',
        lb_type: 'internal',
        default_backend: '',
        enable_bitninja: false,
        node_list_type: 'D',
        ssl_certificate_id: null,
        ssl_context: { redirect_to_https: false },
        plan_name: 'LB-2',
        server_timeout: 60,
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

  it('creates an ALB and renders human output (without --json)', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      }),
      'POST /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'create',
          '--name',
          'my-alb',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--backend-group',
          'web',
          '--backend-server',
          'server-1:10.0.0.1:8080'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Load balancer created.');
      expect(result.stdout).toContain('my-alb');
      expect(result.stdout).toContain('Backend');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when --frontend-protocol HTTPS but --ssl-certificate-id not provided', async () => {
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
          'lb',
          'create',
          '--name',
          'test',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTPS',
          '--port',
          '443',
          '--backend-group',
          'web',
          '--backend-server',
          's1:10.0.0.1:8080'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(
        result.stderr.includes('ssl-certificate-id') ||
          result.stderr.includes('HTTPS')
      ).toBe(true);
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when both --committed-plan and --committed-plan-id are specified', async () => {
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
          'lb',
          'create',
          '--name',
          'test',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--backend-group',
          'web',
          '--backend-server',
          's1:10.0.0.1:8080',
          '--committed-plan',
          '90 Days',
          '--committed-plan-id',
          '901'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Choose either');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when --post-commit-behavior is specified without a committed plan', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      }),
      'POST /myaccount/api/v1/appliances/load-balancers/': () => ({
        body: buildCreateResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'create',
          '--name',
          'test',
          '--plan',
          'LB-2',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--backend-group',
          'web',
          '--backend-server',
          's1:10.0.0.1:8080',
          '--post-commit-behavior',
          'auto-renew'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('post-commit-behavior');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when --billing-type hourly is combined with committed options', async () => {
    const result = await runBuiltCli(
      baseCreateArgs(['--billing-type', 'hourly', '--committed-plan-id', '901'])
    );

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--billing-type hourly cannot be used');
  });

  it('fails when --billing-type committed omits the committed plan selector', async () => {
    const result = await runBuiltCli(
      baseCreateArgs(['--billing-type', 'committed'])
    );

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--billing-type committed requires');
  });

  it('fails when the requested base plan is not available', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        [
          'lb',
          'create',
          '--name',
          'test',
          '--plan',
          'missing',
          '--frontend-protocol',
          'HTTP',
          '--port',
          '80',
          '--backend-group',
          'web',
          '--backend-server',
          's1:10.0.0.1:8080'
        ],
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        'Load balancer plan "missing" was not found'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when the base plan has no committed options', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponseWithoutCommittedOptions()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        baseCreateArgs(['--committed-plan', '90 Days']),
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        'Plan "LB-2" has no committed load balancer options'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when the committed plan selector does not match the base plan', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/appliance-type/': () => ({
        body: buildPlansResponse()
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        baseCreateArgs(['--committed-plan-id', '902']),
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        'Committed plan ID 902 does not exist for base plan "LB-2"'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when a reserved IP is not in inventory', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/reserve_ips/': () => ({
        body: { code: 200, data: [], errors: {}, message: 'OK' }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        baseCreateArgs(['--reserve-ip', '9.9.9.9']),
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        'Reserved IP 9.9.9.9 was not found in your reserved IP inventory'
      );
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });

  it('fails when a reserved IP is already attached', async () => {
    const server = await startTestHttpServer({
      'GET /myaccount/api/v1/reserve_ips/': () => ({
        body: {
          code: 200,
          data: [
            {
              floating_ip_attached_nodes: [{ vm_id: 1001 }],
              ip_address: '9.9.9.9',
              status: 'Reserved'
            }
          ],
          errors: {},
          message: 'OK'
        }
      })
    });
    const tempHome = await createTempHome();

    try {
      await seedDefaultProfile(tempHome);

      const result = await runBuiltCli(
        baseCreateArgs(['--reserve-ip', '9.9.9.9']),
        {
          env: {
            HOME: tempHome.path,
            [MYACCOUNT_BASE_URL_ENV_VAR]: `${server.baseUrl}/myaccount/api/v1`
          }
        }
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Reserved IP 9.9.9.9 is not available');
    } finally {
      await server.close();
      await tempHome.cleanup();
    }
  });
});
