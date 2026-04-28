import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import type { LoadBalancerClient } from '../../../src/load-balancer/client.js';
import { LoadBalancerService } from '../../../src/load-balancer/service.js';
import type {
  LoadBalancerCreateRequest,
  LoadBalancerDetails
} from '../../../src/load-balancer/index.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '12345'
      }
    }
  };
}

function createAlbDetails(
  overrides?: Partial<LoadBalancerDetails>
): LoadBalancerDetails {
  return {
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
        node_list_type: 'S',
        plan_name: 'LB-2'
      }
    ],
    ...overrides
  };
}

function createNlbDetails(): LoadBalancerDetails {
  return {
    id: 20,
    appliance_name: 'my-nlb',
    status: 'RUNNING',
    lb_mode: 'TCP',
    lb_type: 'external',
    public_ip: '5.6.7.8',
    context: [
      {
        backends: [],
        tcp_backend: [
          {
            backend_name: 'tcp-grp',
            port: 8080,
            balance: 'roundrobin',
            servers: [
              {
                backend_name: 'srv-1',
                backend_ip: '10.0.0.2',
                backend_port: 8080
              }
            ]
          }
        ],
        lb_port: '80',
        node_list_type: 'S',
        plan_name: 'LB-2'
      }
    ]
  };
}

function createEmptyAlbDetails(
  overrides?: Partial<LoadBalancerDetails>
): LoadBalancerDetails {
  return {
    id: 30,
    appliance_name: 'empty-alb',
    status: 'RUNNING',
    lb_mode: 'HTTP',
    lb_type: 'external',
    public_ip: '9.9.9.9',
    context: [
      {
        backends: [],
        tcp_backend: [],
        lb_port: '80',
        node_list_type: 'S',
        plan_name: 'LB-2'
      }
    ],
    ...overrides
  };
}

function createEmptyNlbDetails(
  overrides?: Partial<LoadBalancerDetails>
): LoadBalancerDetails {
  return {
    id: 40,
    appliance_name: 'empty-nlb',
    status: 'RUNNING',
    lb_mode: 'TCP',
    lb_type: 'external',
    public_ip: '8.8.8.8',
    context: [
      {
        backends: [],
        tcp_backend: [],
        lb_port: '80',
        node_list_type: 'S',
        plan_name: 'LB-2'
      }
    ],
    ...overrides
  };
}

function createAlbDetailsWithTwoGroups(): LoadBalancerDetails {
  return createAlbDetails({
    context: [
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
        ],
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
        tcp_backend: [],
        lb_port: '80',
        node_list_type: 'S',
        plan_name: 'LB-2'
      }
    ]
  });
}

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
  createLoadBalancer: ReturnType<typeof vi.fn>;
  createLoadBalancerClient: ReturnType<typeof vi.fn>;
  createReservedIpClient: ReturnType<typeof vi.fn>;
  createVpcClient: ReturnType<typeof vi.fn>;
  deleteLoadBalancer: ReturnType<typeof vi.fn>;
  getLoadBalancer: ReturnType<typeof vi.fn>;
  getVpc: ReturnType<typeof vi.fn>;
  lbClient: LoadBalancerClient;
  listReservedIps: ReturnType<typeof vi.fn>;
  listLoadBalancers: ReturnType<typeof vi.fn>;
  listLoadBalancerPlans: ReturnType<typeof vi.fn>;
  reserveNodePublicIp: ReturnType<typeof vi.fn>;
  readConfig: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: LoadBalancerService;
  updateLoadBalancer: ReturnType<typeof vi.fn>;
} {
  const createLoadBalancer = vi.fn(() =>
    Promise.resolve({
      appliance_id: 42,
      id: 'lb-42',
      resource_type: 'load_balancer',
      label_id: 'label-1'
    })
  );
  const listLoadBalancers = vi.fn(() => Promise.resolve([]));
  const getLoadBalancer = vi.fn(() => Promise.resolve(createAlbDetails()));
  const deleteLoadBalancer = vi.fn(() =>
    Promise.resolve({ message: 'Deleted.' })
  );
  const updateLoadBalancer = vi.fn(() =>
    Promise.resolve({ message: 'Updated.' })
  );
  const listLoadBalancerPlans = vi.fn(() =>
    Promise.resolve([
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
    ])
  );

  const lbClient: LoadBalancerClient = {
    createLoadBalancer,
    deleteLoadBalancer,
    getLoadBalancer,
    listLoadBalancerPlans,
    listLoadBalancers,
    updateLoadBalancer
  };

  let capturedCredentials: ResolvedCredentials | undefined;
  const createLoadBalancerClient = vi.fn((creds: ResolvedCredentials) => {
    capturedCredentials = creds;
    return lbClient;
  });
  const listReservedIps = vi.fn(() =>
    Promise.resolve([
      {
        ip_address: '203.0.113.10',
        status: 'Reserved'
      }
    ])
  );
  const reserveNodePublicIp = vi.fn(() =>
    Promise.resolve({
      ip_address: '1.2.3.4',
      message: 'IP reserved successfully.',
      status: 'Available',
      vm_id: 1001,
      vm_name: 'my-alb'
    })
  );
  const reservedIpClient: ReservedIpClient = {
    attachReservedIpToNode: vi.fn(),
    createReservedIp: vi.fn(),
    deleteReservedIp: vi.fn(),
    detachNodePublicIp: vi.fn(),
    detachReservedIpFromNode: vi.fn(),
    listReservedIps,
    reserveNodePublicIp
  };
  const createReservedIpClient = vi.fn(() => reservedIpClient);
  const getVpc = vi.fn(() =>
    Promise.resolve({
      ipv4_cidr: '10.10.0.0/16',
      is_e2e_vpc: false,
      name: 'prod-vpc',
      network_id: 12345,
      state: 'Active'
    })
  );
  const vpcClient: VpcClient = {
    attachNodeVpc: vi.fn(),
    createVpc: vi.fn(),
    deleteVpc: vi.fn(),
    detachNodeVpc: vi.fn(),
    getVpc,
    listVpcPlans: vi.fn(),
    listVpcs: vi.fn()
  };
  const createVpcClient = vi.fn(() => vpcClient);

  const readConfig = vi.fn(() => Promise.resolve(createConfig()));
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));

  const service = new LoadBalancerService({
    confirm,
    createLoadBalancerClient,
    createReservedIpClient,
    createVpcClient,
    isInteractive: options?.isInteractive ?? true,
    store: { configPath: '/tmp/.e2ectl/config.json', read: readConfig }
  });

  return {
    confirm,
    createLoadBalancer,
    createLoadBalancerClient,
    createReservedIpClient,
    createVpcClient,
    deleteLoadBalancer,
    getLoadBalancer,
    getVpc,
    lbClient,
    listReservedIps,
    listLoadBalancers,
    listLoadBalancerPlans,
    readConfig,
    receivedCredentials: () => capturedCredentials,
    service,
    reserveNodePublicIp,
    updateLoadBalancer
  };
}

describe('LoadBalancerService', () => {
  describe('listPlans', () => {
    it('returns a plans result with items', async () => {
      const { service, listLoadBalancerPlans } = createServiceFixture();

      const result = await service.listPlans({});

      expect(result.action).toBe('plans');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe('LB-2');
      expect(listLoadBalancerPlans).toHaveBeenCalled();
    });

    it('returns empty items when no plans are available', async () => {
      const { service, listLoadBalancerPlans } = createServiceFixture();
      listLoadBalancerPlans.mockResolvedValue([]);

      const result = await service.listPlans({});

      expect(result.action).toBe('plans');
      expect(result.items).toHaveLength(0);
    });
  });

  describe('listLoadBalancers', () => {
    it('returns a list result', async () => {
      const { service, listLoadBalancers } = createServiceFixture();
      listLoadBalancers.mockResolvedValue([
        { id: 1, appliance_name: 'alb-1', status: 'RUNNING', lb_mode: 'HTTP' }
      ]);

      const result = await service.listLoadBalancers({});

      expect(result.action).toBe('list');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.appliance_name).toBe('alb-1');
    });
  });

  describe('createLoadBalancer', () => {
    it('creates an ALB with HTTP mode and puts backends in backends[]', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      const result = await service.createLoadBalancer({
        name: 'my-alb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        port: '80',
        backendGroup: 'web',
        backendServer: ['server-1:10.0.0.1:8080']
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('HTTP');
      expect(body.backends).toHaveLength(1);
      expect(body.tcp_backend).toHaveLength(0);
      expect(body.backends[0]!.name).toBe('web');
      expect(body.backends[0]?.backend_mode).toBe('http');
      expect(body.backends[0]?.backend_ssl).toBe(false);
      expect(body.backends[0]?.servers?.[0]?.backend_ip).toBe('10.0.0.1');
      expect(result.requested.name).toBe('my-alb');
      expect(result.backend.protocol).toBe('HTTP');
    });

    it('maps --backend-protocol HTTPS to backend_ssl for ALB create', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'my-alb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        port: '80',
        backendGroup: 'web',
        backendProtocol: 'HTTPS',
        backendServer: ['server-1:10.0.0.1:8080']
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.backends[0]?.backend_mode).toBe('https');
      expect(body.backends[0]?.backend_ssl).toBe(true);
    });

    it('uses only unattached reserved IPs from inventory during create', async () => {
      const { service, createLoadBalancer, listReservedIps } =
        createServiceFixture();

      await service.createLoadBalancer({
        name: 'my-alb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        port: '80',
        backendGroup: 'web',
        backendServer: ['server-1:10.0.0.1:8080'],
        reserveIp: '203.0.113.10'
      });

      expect(listReservedIps).toHaveBeenCalled();
      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.lb_reserve_ip).toBe('203.0.113.10');
    });

    it('rejects create when --reserve-ip is not in inventory', async () => {
      const { service, listReservedIps, createLoadBalancer } =
        createServiceFixture();
      listReservedIps.mockResolvedValue([
        { ip_address: '203.0.113.11', status: 'Reserved' }
      ]);

      await expect(
        service.createLoadBalancer({
          name: 'my-alb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          backendGroup: 'web',
          backendServer: ['server-1:10.0.0.1:8080'],
          reserveIp: '203.0.113.10'
        })
      ).rejects.toMatchObject({ code: 'RESERVE_IP_NOT_FOUND' });
      expect(createLoadBalancer).not.toHaveBeenCalled();
    });

    it('rejects create when --reserve-ip is already attached', async () => {
      const { service, listReservedIps, createLoadBalancer } =
        createServiceFixture();
      listReservedIps.mockResolvedValue([
        {
          floating_ip_attached_nodes: [{ id: 101, vm_id: 1001 }],
          ip_address: '203.0.113.10',
          status: 'Assigned',
          vm_id: 1001
        }
      ]);

      await expect(
        service.createLoadBalancer({
          name: 'my-alb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          backendGroup: 'web',
          backendServer: ['server-1:10.0.0.1:8080'],
          reserveIp: '203.0.113.10'
        })
      ).rejects.toMatchObject({ code: 'RESERVE_IP_NOT_AVAILABLE' });
      expect(createLoadBalancer).not.toHaveBeenCalled();
    });

    it('creates an NLB with TCP mode and puts backend in tcp_backend[]', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'my-nlb',
        plan: 'LB-2',
        frontendProtocol: 'TCP',
        port: '80',
        backendGroup: 'tcp-grp',
        backendServer: ['srv-1:10.0.0.2:8080'],
        backendPort: '8080'
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('TCP');
      expect(body.tcp_backend).toHaveLength(1);
      expect(body.backends).toHaveLength(0);
      expect(body.tcp_backend[0]!.backend_name).toBe('tcp-grp');
    });

    it('applies default timeouts of 60', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'lb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.client_timeout).toBe(60);
      expect(body.server_timeout).toBe(60);
      expect(body.connection_timeout).toBe(60);
      expect(body.http_keep_alive_timeout).toBe(60);
    });

    it('creates an internal LB by resolving the VPC into vpc_list[]', async () => {
      const { service, createLoadBalancer, getVpc } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'internal-alb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        networkId: '12345',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      expect(getVpc).toHaveBeenCalledWith(12345);
      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.lb_type).toBe('internal');
      expect(body.vpc_list).toEqual([
        {
          ipv4_cidr: '10.10.0.0/16',
          network_id: 12345,
          vpc_name: 'prod-vpc'
        }
      ]);
    });

    it('creates a committed LB with cn_id and cn_status', async () => {
      const { service, createLoadBalancer, listLoadBalancerPlans } =
        createServiceFixture();

      const result = await service.createLoadBalancer({
        committedPlan: '90 Days',
        frontendProtocol: 'HTTP',
        name: 'committed-alb',
        plan: 'LB-2',
        port: '80',
        postCommitBehavior: 'hourly-billing',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      expect(listLoadBalancerPlans).toHaveBeenCalled();
      expect(result.billing).toEqual({
        committed_plan_id: 901,
        committed_plan_name: '90 Days',
        post_commit_behavior: 'hourly_billing',
        type: 'committed'
      });
      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.cn_id).toBe(901);
      expect(body.cn_status).toBe('hourly_billing');
      expect(body.plan_name).toBe('LB-2');
    });

    it('throws MISSING_SSL_CERTIFICATE_ID when mode is HTTPS and no cert provided', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTPS',
          port: '443',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'MISSING_SSL_CERTIFICATE_ID' });
    });

    it('throws MISSING_SSL_CERTIFICATE_ID when mode is BOTH and no cert provided', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'BOTH',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'MISSING_SSL_CERTIFICATE_ID' });
    });

    it('passes ssl_certificate_id when mode is HTTPS and cert is provided', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'lb',
        plan: 'LB-2',
        frontendProtocol: 'HTTPS',
        port: '443',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80'],
        sslCertificateId: '99'
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.ssl_certificate_id).toBe(99);
    });

    it('throws on invalid mode', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'FTP',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toThrow('Invalid --frontend-protocol');
    });

    it('throws on invalid port', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: 'abc',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toThrow('--port must be an integer');
    });

    it('creates a committed LB with --billing-type committed and --committed-plan', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      const result = await service.createLoadBalancer({
        billingType: 'committed',
        committedPlan: '90 Days',
        frontendProtocol: 'HTTP',
        name: 'committed-alb',
        plan: 'LB-2',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      expect(result.billing.type).toBe('committed');
      expect(result.billing.committed_plan_name).toBe('90 Days');
      expect(createLoadBalancer).toHaveBeenCalledOnce();
    });

    it('creates an hourly LB with explicit --billing-type hourly', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      const result = await service.createLoadBalancer({
        billingType: 'hourly',
        frontendProtocol: 'HTTP',
        name: 'hourly-alb',
        plan: 'LB-2',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      expect(result.billing.type).toBe('hourly');
      expect(result.billing.committed_plan_id).toBeNull();
      expect(createLoadBalancer).toHaveBeenCalledOnce();
    });

    it('rejects --billing-type hourly with --committed-plan', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          billingType: 'hourly',
          committedPlan: '90 Days',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'BILLING_TYPE_CONFLICT' });
    });

    it('rejects --billing-type hourly with --committed-plan-id', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          billingType: 'hourly',
          committedPlanId: '901',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'BILLING_TYPE_CONFLICT' });
    });

    it('rejects --billing-type committed without a committed selector', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          billingType: 'committed',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'COMMITTED_PLAN_SELECTOR_REQUIRED' });
    });

    it('rejects selecting both committed selectors', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          committedPlan: '90 Days',
          committedPlanId: '901',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'COMMITTED_PLAN_SELECTOR_CONFLICT' });
    });

    it('rejects post-commit behavior without a committed selector', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          postCommitBehavior: 'hourly-billing',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({
        code: 'LOAD_BALANCER_POST_COMMIT_BEHAVIOR_REQUIRES_COMMITTED_PLAN'
      });
    });

    it('creates an internal LB using --vpc option instead of networkId', async () => {
      const { service, createLoadBalancer, getVpc } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'internal-alb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        vpc: '12345',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      expect(getVpc).toHaveBeenCalledWith(12345);
      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.lb_type).toBe('internal');
    });

    it('attaches security_group_id when securityGroupId is provided', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'alb',
        plan: 'LB-2',
        frontendProtocol: 'HTTP',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80'],
        securityGroupId: '55'
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.security_group_id).toBe(55);
    });

    it('creates a committed LB when committedPlanId is used', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      const result = await service.createLoadBalancer({
        committedPlanId: '901',
        frontendProtocol: 'HTTP',
        name: 'committed-alb',
        plan: 'LB-2',
        port: '80',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      expect(result.billing.committed_plan_id).toBe(901);
      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.cn_id).toBe(901);
    });

    it('throws LOAD_BALANCER_PLAN_NOT_FOUND when base plan is not in the list', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          committedPlan: '90 Days',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'nonexistent-plan',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_PLAN_NOT_FOUND' });
    });

    it('throws LOAD_BALANCER_COMMITTED_PLAN_UNAVAILABLE when plan has empty committed_sku', async () => {
      const { service, listLoadBalancerPlans } = createServiceFixture();
      listLoadBalancerPlans.mockResolvedValue([
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
      ]);

      await expect(
        service.createLoadBalancer({
          committedPlan: '90 Days',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({
        code: 'LOAD_BALANCER_COMMITTED_PLAN_UNAVAILABLE'
      });
    });

    it('throws LOAD_BALANCER_COMMITTED_PLAN_NOT_FOUND when committed plan name does not match', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          committedPlan: 'nonexistent-option',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({
        code: 'LOAD_BALANCER_COMMITTED_PLAN_NOT_FOUND'
      });
    });

    it('throws LOAD_BALANCER_COMMITTED_PLAN_NOT_FOUND when committedPlanId does not match', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          committedPlanId: '999',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({
        code: 'LOAD_BALANCER_COMMITTED_PLAN_NOT_FOUND'
      });
    });

    it('throws INVALID_LOAD_BALANCER_POST_COMMIT_BEHAVIOR for unknown post-commit value', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          committedPlan: '90 Days',
          postCommitBehavior: 'invalid-behavior',
          frontendProtocol: 'HTTP',
          name: 'lb',
          plan: 'LB-2',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({
        code: 'INVALID_LOAD_BALANCER_POST_COMMIT_BEHAVIOR'
      });
    });

    it('throws INVALID_LB_ALGORITHM for unknown algorithm', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          algorithm: 'invalid-algo',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'INVALID_LB_ALGORITHM' });
    });

    it('throws INVALID_LB_BACKEND_PROTOCOL for unknown backend protocol', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          backendProtocol: 'FTP',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'INVALID_LB_BACKEND_PROTOCOL' });
    });

    it('throws MISSING_SERVER_IP when serverIp is empty string', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1::80']
        })
      ).rejects.toMatchObject({ code: 'MISSING_SERVER_IP' });
    });

    it('throws INVALID_SERVER_IP when serverIp is not a valid IPv4', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          backendGroup: 'web',
          backendServer: ['srv-1:not-an-ip:80']
        })
      ).rejects.toMatchObject({ code: 'INVALID_SERVER_IP' });
    });

    it('throws MISSING_REQUIRED_OPTION when serverName is empty string', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'HTTP',
          port: '80',
          backendGroup: 'web',
          backendServer: [':10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_OPTION' });
    });
  });

  describe('deleteLoadBalancer', () => {
    it('prompts for confirmation when interactive', async () => {
      const { service, confirm, deleteLoadBalancer } = createServiceFixture({
        confirmResult: true,
        isInteractive: true
      });

      const result = await service.deleteLoadBalancer('42', {});

      expect(confirm).toHaveBeenCalled();
      expect(deleteLoadBalancer).toHaveBeenCalledWith('42', undefined);
      expect(result.action).toBe('delete');
      expect(result.cancelled).toBe(false);
    });

    it('cancels when user declines confirmation', async () => {
      const { service, confirm, deleteLoadBalancer } = createServiceFixture({
        confirmResult: false,
        isInteractive: true
      });

      const result = await service.deleteLoadBalancer('42', {});

      expect(confirm).toHaveBeenCalled();
      expect(deleteLoadBalancer).not.toHaveBeenCalled();
      expect(result.cancelled).toBe(true);
    });

    it('skips confirmation with --force', async () => {
      const { service, confirm, deleteLoadBalancer } = createServiceFixture({
        isInteractive: true
      });

      await service.deleteLoadBalancer('42', { force: true });

      expect(confirm).not.toHaveBeenCalled();
      expect(deleteLoadBalancer).toHaveBeenCalled();
    });

    it('passes reserve_ip_required when reservePublicIp is true', async () => {
      const { service, deleteLoadBalancer } = createServiceFixture();

      await service.deleteLoadBalancer('42', {
        force: true,
        reservePublicIp: true
      });

      expect(deleteLoadBalancer).toHaveBeenCalledWith('42', {
        reserve_ip_required: 'true'
      });
    });

    it('throws CONFIRMATION_REQUIRED when not interactive and force is not set', async () => {
      const { service } = createServiceFixture({ isInteractive: false });

      await expect(service.deleteLoadBalancer('42', {})).rejects.toMatchObject({
        code: 'CONFIRMATION_REQUIRED'
      });
    });

    it('throws when lbId is not a numeric string', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.deleteLoadBalancer('not-a-number', { force: true })
      ).rejects.toThrow();
    });
  });

  describe('reservePublicIp', () => {
    it('reserves the current LB public IP through the reserved IP live-reserve path', async () => {
      const { service, reserveNodePublicIp } = createServiceFixture();

      const result = await service.reservePublicIp('10', {});

      expect(reserveNodePublicIp).toHaveBeenCalledWith('1.2.3.4', {
        type: 'live-reserve',
        vm_id: 1001
      });
      expect(result.action).toBe('network-reserve-ip-reserve');
      expect(result.reserve_ip).toBe('1.2.3.4');
    });

    it('rejects reserve when the LB public IP is already reserved', async () => {
      const { service, getLoadBalancer, reserveNodePublicIp } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createAlbDetails({ public_ip_reserved: true })
      );

      await expect(service.reservePublicIp('10', {})).rejects.toMatchObject({
        code: 'LOAD_BALANCER_PUBLIC_IP_ALREADY_RESERVED'
      });
      expect(reserveNodePublicIp).not.toHaveBeenCalled();
    });

    it('rejects reserve when context already marks the public IP as reserved', async () => {
      const { service, getLoadBalancer, reserveNodePublicIp } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createAlbDetails({
          public_ip_reserved: false,
          context: [
            {
              backends: [],
              lb_port: '80',
              lb_reserve_ip: '1.2.3.4',
              node_list_type: 'S',
              plan_name: 'LB-2',
              tcp_backend: []
            }
          ]
        })
      );

      await expect(service.reservePublicIp('10', {})).rejects.toMatchObject({
        code: 'LOAD_BALANCER_PUBLIC_IP_ALREADY_RESERVED'
      });
      expect(reserveNodePublicIp).not.toHaveBeenCalled();
    });

    it('uses node_detail.public_ip when the top-level public IP is absent', async () => {
      const { service, getLoadBalancer, reserveNodePublicIp } =
        createServiceFixture();
      reserveNodePublicIp.mockResolvedValue({
        ip_address: '2.2.2.2',
        message: 'Reserved.'
      });
      const details = createAlbDetails({
        node_detail: {
          public_ip: '2.2.2.2',
          vm_id: 1001
        }
      });
      delete details.public_ip;
      getLoadBalancer.mockResolvedValue(details);

      const result = await service.reservePublicIp('10', {});

      expect(reserveNodePublicIp).toHaveBeenCalledWith('2.2.2.2', {
        type: 'live-reserve',
        vm_id: 1001
      });
      expect(result.reserve_ip).toBe('2.2.2.2');
    });

    it('rejects reserve for internal load balancers', async () => {
      const { service, getLoadBalancer, reserveNodePublicIp } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createAlbDetails({
          lb_type: 'internal',
          context: [
            {
              backends: [],
              lb_port: '80',
              node_list_type: 'S',
              plan_name: 'LB-2',
              tcp_backend: [],
              vpc_list: [
                {
                  ipv4_cidr: '10.10.0.0/16',
                  network_id: 12345,
                  vpc_name: 'prod-vpc'
                }
              ]
            }
          ]
        })
      );

      await expect(service.reservePublicIp('10', {})).rejects.toMatchObject({
        code: 'RESERVE_IP_REQUIRES_EXTERNAL_LB'
      });
      expect(reserveNodePublicIp).not.toHaveBeenCalled();
    });
  });

  describe('listBackendGroups', () => {
    it('returns ALB backends from context', async () => {
      const { service } = createServiceFixture();

      const result = await service.listBackendGroups('10', {});

      expect(result.action).toBe('backend-group-list');
      expect(result.backends).toHaveLength(1);
      expect(result.backends[0]?.name).toBe('web');
      expect(result.tcp_backends).toHaveLength(0);
    });

    it('returns NLB tcp_backends from context', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      const result = await service.listBackendGroups('20', {});

      expect(result.action).toBe('backend-group-list');
      expect(result.tcp_backends).toHaveLength(1);
      expect(result.tcp_backends[0]!.backend_name).toBe('tcp-grp');
      expect(result.backends).toHaveLength(0);
    });
  });

  describe('createBackendGroup', () => {
    it('creates a new ALB backend group with initial server', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyAlbDetails());

      const result = await service.createBackendGroup('30', {
        name: 'web',
        backendServer: ['server-1:10.0.0.5:8080']
      });

      expect(result.action).toBe('backend-group-add');
      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.backends[0]?.servers).toHaveLength(1);
      expect(body.backends[0]?.servers?.[0]?.backend_ip).toBe('10.0.0.5');
    });

    it('preserves internal-LB context when creating a backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createEmptyAlbDetails({
          lb_type: 'internal',
          context: [
            {
              acl_list: [],
              acl_map: [],
              backends: [],
              cn_id: 901,
              cn_status: 'auto_renew',
              lb_port: '80',
              node_list_type: 'S',
              plan_name: 'LB-2',
              ssl_context: { redirect_to_https: true },
              tcp_backend: [],
              vpc_list: [
                {
                  ipv4_cidr: '10.10.0.0/16',
                  network_id: 12345,
                  vpc_name: 'prod-vpc'
                }
              ]
            }
          ]
        })
      );

      await service.createBackendGroup('30', {
        name: 'api',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_type).toBe('internal');
      expect(body.cn_id).toBe(901);
      expect(body.cn_status).toBe('auto_renew');
      expect(body.ssl_context).toEqual({ redirect_to_https: true });
      expect(body.vpc_list).toEqual([
        {
          ipv4_cidr: '10.10.0.0/16',
          network_id: 12345,
          vpc_name: 'prod-vpc'
        }
      ]);
    });

    it('creates a new NLB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyNlbDetails());

      const result = await service.createBackendGroup('40', {
        name: 'tcp-grp',
        backendPort: '8080',
        backendServer: ['srv-1:10.0.0.2:8080']
      });

      expect(result.action).toBe('backend-group-add');
      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.tcp_backend).toHaveLength(1);
      expect(body.tcp_backend[0]?.backend_name).toBe('tcp-grp');
      expect(body.tcp_backend[0]?.port).toBe(8080);
    });

    it('throws BACKEND_GROUP_EXISTS if group name already exists on ALB', async () => {
      const { service } = createServiceFixture();
      // default getLoadBalancer returns ALB with 'web' group

      await expect(
        service.createBackendGroup('10', {
          name: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_EXISTS' });
    });

    it('throws NLB_SINGLE_BACKEND_GROUP if NLB already has a group', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.createBackendGroup('20', {
          name: 'new-group',
          backendPort: '9000',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'NLB_SINGLE_BACKEND_GROUP' });
    });

    it('throws LOAD_BALANCER_CONTEXT_MISSING when context is undefined', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createAlbDetails(),
        context: undefined
      } as LoadBalancerDetails);

      await expect(
        service.createBackendGroup('10', {
          name: 'api',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });

    it('throws MISSING_REQUIRED_OPTION when serverName is empty', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyAlbDetails());

      await expect(
        service.createBackendGroup('30', {
          name: 'api',
          backendServer: [':10.0.0.1:80']
        })
      ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_OPTION' });
    });

    it('preserves numeric timeout values from context during update', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createEmptyAlbDetails({
          context: [
            {
              backends: [],
              tcp_backend: [],
              lb_port: '80',
              node_list_type: 'S',
              plan_name: 'LB-2',
              client_timeout: 120,
              server_timeout: 90,
              connection_timeout: 30,
              http_keep_alive_timeout: 45
            }
          ]
        })
      );

      await service.createBackendGroup('30', {
        name: 'api',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.client_timeout).toBe(120);
      expect(body.server_timeout).toBe(90);
      expect(body.connection_timeout).toBe(30);
      expect(body.http_keep_alive_timeout).toBe(45);
    });

    it('falls back to external lb_type when lb_type is unrecognized', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createEmptyAlbDetails({ lb_type: 'unknown-type' })
      );

      await service.createBackendGroup('30', {
        name: 'api',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_type).toBe('external');
    });

    it('falls back to internal lb_type when lb_type is unrecognized but vpc_list is non-empty', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createEmptyAlbDetails({
          lb_type: 'unrecognized-type',
          context: [
            {
              backends: [],
              tcp_backend: [],
              lb_port: '80',
              node_list_type: 'S',
              plan_name: 'LB-2',
              vpc_list: [
                { ipv4_cidr: '10.0.0.0/16', network_id: 1, vpc_name: 'vpc1' }
              ]
            }
          ]
        })
      );

      await service.createBackendGroup('30', {
        name: 'api',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_type).toBe('internal');
    });

    it('falls back to HTTP lb_mode when lb_mode is an empty string', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyAlbDetails({ lb_mode: '' }));

      await service.createBackendGroup('30', {
        name: 'api',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('HTTP');
    });

    it('falls back to HTTP lb_mode when lb_mode value is not a valid mode', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createEmptyAlbDetails({ lb_mode: 'INVALID' })
      );

      await service.createBackendGroup('30', {
        name: 'api',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('HTTP');
    });

    it('uses lb_port 443 for HTTPS LB when context.lb_port is missing', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createEmptyAlbDetails({
          lb_mode: 'HTTPS',
          context: [
            {
              backends: [],
              tcp_backend: [],
              node_list_type: 'S',
              plan_name: 'LB-2'
            }
          ]
        })
      );

      await service.createBackendGroup('30', {
        name: 'api',
        backendProtocol: 'HTTP',
        backendServer: ['srv-1:10.0.0.1:80']
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_port).toBe('443');
    });
  });

  describe('deleteBackendGroup', () => {
    it('deletes an ALB backend group and removes stale ACL references', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createAlbDetailsWithTwoGroups());

      const result = await service.deleteBackendGroup('10', 'api', {});

      expect(result.action).toBe('backend-group-remove');
      expect(result.group_name).toBe('api');

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.backends.map((backend) => backend.name)).toEqual(['web']);
      expect(body.acl_map).toEqual([
        {
          acl_backend: 'web',
          acl_condition_state: true,
          acl_name: 'acl-web'
        }
      ]);
      expect(body.acl_list).toEqual([
        {
          acl_condition: 'path_beg',
          acl_matching_path: '/web',
          acl_name: 'acl-web'
        }
      ]);
    });

    it('throws LAST_BACKEND_GROUP_NOT_DELETABLE when ALB has only one backend group', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.deleteBackendGroup('10', 'web', {})
      ).rejects.toMatchObject({
        code: 'LAST_BACKEND_GROUP_NOT_DELETABLE'
      });
    });

    it('throws LAST_BACKEND_GROUP_NOT_DELETABLE when NLB has only one backend group', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.deleteBackendGroup('20', 'tcp-grp', {})
      ).rejects.toMatchObject({
        code: 'LAST_BACKEND_GROUP_NOT_DELETABLE'
      });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on ALB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createAlbDetailsWithTwoGroups());

      await expect(
        service.deleteBackendGroup('10', 'nonexistent', {})
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createNlbDetails(),
        context: [
          {
            backends: [],
            tcp_backend: [
              {
                backend_name: 'tcp-grp',
                port: 8080,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-1',
                    backend_ip: '10.0.0.2',
                    backend_port: 8080
                  }
                ]
              },
              {
                backend_name: 'tcp-grp-2',
                port: 9090,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-2',
                    backend_ip: '10.0.0.3',
                    backend_port: 9090
                  }
                ]
              }
            ],
            lb_port: '80',
            node_list_type: 'S',
            plan_name: 'LB-2'
          }
        ]
      });

      await expect(
        service.deleteBackendGroup('20', 'nonexistent', {})
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('successfully deletes an NLB backend group when multiple groups exist', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createNlbDetails(),
        context: [
          {
            backends: [],
            tcp_backend: [
              {
                backend_name: 'tcp-grp-1',
                port: 8080,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-1',
                    backend_ip: '10.0.0.2',
                    backend_port: 8080
                  }
                ]
              },
              {
                backend_name: 'tcp-grp-2',
                port: 9090,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-2',
                    backend_ip: '10.0.0.3',
                    backend_port: 9090
                  }
                ]
              }
            ],
            lb_port: '80',
            node_list_type: 'S',
            plan_name: 'LB-2'
          }
        ]
      });

      const result = await service.deleteBackendGroup('20', 'tcp-grp-2', {});

      expect(result.action).toBe('backend-group-remove');
      expect(result.group_name).toBe('tcp-grp-2');
      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.tcp_backend).toHaveLength(1);
      expect(body.tcp_backend[0]?.backend_name).toBe('tcp-grp-1');
    });

    it('throws LOAD_BALANCER_CONTEXT_MISSING when deleteBackendGroup context is undefined', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createAlbDetails(),
        context: undefined
      } as LoadBalancerDetails);

      await expect(
        service.deleteBackendGroup('10', 'web', {})
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });
  });

  describe('addBackendServer', () => {
    it('adds a server to an existing ALB backend group', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.addBackendServer('10', {
        backendGroup: 'web',
        backendServer: 'server-2:10.0.0.5:8080'
      });

      expect(result.action).toBe('backend-server-add');
      const updatedBody = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      const webGroup = updatedBody.backends?.find((b) => b.name === 'web');
      expect(webGroup?.servers).toHaveLength(2);
      expect(webGroup?.servers?.[1]?.backend_ip).toBe('10.0.0.5');
    });

    it('adds a server to an existing NLB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      const result = await service.addBackendServer('20', {
        backendGroup: 'tcp-grp',
        backendServer: 'srv-2:10.0.0.3:8080'
      });

      expect(result.action).toBe('backend-server-add');
      const updatedBody = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(updatedBody.tcp_backend?.[0]?.servers).toHaveLength(2);
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on ALB', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.addBackendServer('10', {
          backendGroup: 'nonexistent',
          backendServer: 'server-2:10.0.0.5:8080'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.addBackendServer('20', {
          backendGroup: 'nonexistent',
          backendServer: 'srv-3:10.0.0.4:8080'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws LOAD_BALANCER_CONTEXT_MISSING when context is undefined', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createAlbDetails(),
        context: undefined
      } as LoadBalancerDetails);

      await expect(
        service.addBackendServer('10', {
          backendGroup: 'web',
          backendServer: 'server-2:10.0.0.5:8080'
        })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });

    it('uses tcp_backend[0].port for TCP LB when context.lb_port is missing', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        id: 20,
        appliance_name: 'my-nlb',
        status: 'RUNNING',
        lb_mode: 'TCP',
        lb_type: 'external',
        public_ip: '5.6.7.8',
        context: [
          {
            backends: [],
            tcp_backend: [
              {
                backend_name: 'tcp-grp',
                port: 8080,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-1',
                    backend_ip: '10.0.0.2',
                    backend_port: 8080
                  }
                ]
              }
            ],
            node_list_type: 'S',
            plan_name: 'LB-2'
          }
        ]
      } satisfies LoadBalancerDetails);

      await service.addBackendServer('20', {
        backendGroup: 'tcp-grp',
        backendServer: 'srv-2:10.0.0.3:8080'
      });

      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(body.lb_port).toBe('8080');
    });
  });

  describe('deleteBackendServer', () => {
    it('deletes a server from an existing ALB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createAlbDetailsWithTwoGroups());

      const result = await service.deleteBackendServer('10', {
        backendGroup: 'web',
        backendServerName: 'server-2'
      });

      expect(result.action).toBe('backend-server-remove');
      const updatedBody = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      const webGroup = updatedBody.backends?.find((b) => b.name === 'web');
      expect(webGroup?.servers).toEqual([
        {
          backend_name: 'server-1',
          backend_ip: '10.0.0.1',
          backend_port: 8080
        }
      ]);
    });

    it('deletes a server from an existing NLB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createNlbDetails(),
        context: [
          {
            backends: [],
            tcp_backend: [
              {
                backend_name: 'tcp-grp',
                port: 8080,
                balance: 'roundrobin',
                servers: [
                  {
                    backend_name: 'srv-1',
                    backend_ip: '10.0.0.2',
                    backend_port: 8080
                  },
                  {
                    backend_name: 'srv-2',
                    backend_ip: '10.0.0.3',
                    backend_port: 8080
                  }
                ]
              }
            ],
            lb_port: '80',
            node_list_type: 'S',
            plan_name: 'LB-2'
          }
        ]
      });

      const result = await service.deleteBackendServer('20', {
        backendGroup: 'tcp-grp',
        backendServerName: 'srv-2'
      });

      expect(result.action).toBe('backend-server-remove');
      const updatedBody = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      expect(updatedBody.tcp_backend?.[0]?.servers).toEqual([
        {
          backend_name: 'srv-1',
          backend_ip: '10.0.0.2',
          backend_port: 8080
        }
      ]);
    });

    it('throws LAST_BACKEND_SERVER_NOT_DELETABLE when backend group has only one server', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.deleteBackendServer('10', {
          backendGroup: 'web',
          backendServerName: 'server-1'
        })
      ).rejects.toMatchObject({
        code: 'LAST_BACKEND_SERVER_NOT_DELETABLE'
      });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on ALB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createAlbDetailsWithTwoGroups());

      await expect(
        service.deleteBackendServer('10', {
          backendGroup: 'nonexistent',
          backendServerName: 'server-1'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.deleteBackendServer('20', {
          backendGroup: 'nonexistent',
          backendServerName: 'srv-1'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws BACKEND_SERVER_NOT_FOUND when server name does not exist in group', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createAlbDetailsWithTwoGroups());

      await expect(
        service.deleteBackendServer('10', {
          backendGroup: 'web',
          backendServerName: 'nonexistent-server'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_SERVER_NOT_FOUND' });
    });

    it('throws BACKEND_SERVER_AMBIGUOUS when multiple servers share the same name', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createAlbDetails({
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
                      backend_name: 'dup',
                      backend_ip: '10.0.0.1',
                      backend_port: 8080
                    },
                    {
                      backend_name: 'dup',
                      backend_ip: '10.0.0.2',
                      backend_port: 8080
                    }
                  ]
                }
              ],
              tcp_backend: [],
              lb_port: '80',
              node_list_type: 'S',
              plan_name: 'LB-2'
            }
          ]
        })
      );

      await expect(
        service.deleteBackendServer('10', {
          backendGroup: 'web',
          backendServerName: 'dup'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_SERVER_AMBIGUOUS' });
    });

    it('throws LOAD_BALANCER_CONTEXT_MISSING when context is undefined', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue({
        ...createAlbDetails(),
        context: undefined
      } as LoadBalancerDetails);

      await expect(
        service.deleteBackendServer('10', {
          backendGroup: 'web',
          backendServerName: 'server-1'
        })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });

    it('deletes a server using serverIp and serverPort for disambiguation', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createAlbDetailsWithTwoGroups());

      const result = await service.deleteBackendServer('10', {
        backendGroup: 'web',
        backendServerName: 'server-1',
        serverIp: '10.0.0.1',
        serverPort: '8080'
      });

      expect(result.action).toBe('backend-server-remove');
      const body = updateLoadBalancer.mock
        .calls[0]![1] as LoadBalancerCreateRequest;
      const webGroup = body.backends?.find((b) => b.name === 'web');
      expect(webGroup?.servers).toHaveLength(1);
      expect(webGroup?.servers?.[0]?.backend_name).toBe('server-2');
    });

    it('throws LAST_BACKEND_SERVER_NOT_DELETABLE when NLB group has only one server', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.deleteBackendServer('20', {
          backendGroup: 'tcp-grp',
          backendServerName: 'srv-1'
        })
      ).rejects.toMatchObject({ code: 'LAST_BACKEND_SERVER_NOT_DELETABLE' });
    });
  });

  describe('updateLoadBalancer', () => {
    it('renames an ALB', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.updateLoadBalancer('10', {
        name: 'new-name'
      });

      expect(result.action).toBe('update');
      expect(result.lb_id).toBe('10');
      expect(result.changes.name).toBe('new-name');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('changes protocol from HTTP to HTTPS with ssl cert', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.updateLoadBalancer('10', {
        frontendProtocol: 'HTTPS',
        sslCertificateId: '99'
      });

      expect(result.action).toBe('update');
      expect(result.changes.protocol).toBe('HTTPS');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('throws LOAD_BALANCER_PROTOCOL_FAMILY_CHANGE when changing NLB to HTTP', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.updateLoadBalancer('20', { frontendProtocol: 'HTTP' })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_PROTOCOL_FAMILY_CHANGE' });
    });

    it('throws LOAD_BALANCER_PROTOCOL_FAMILY_CHANGE when changing ALB to TCP', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.updateLoadBalancer('10', { frontendProtocol: 'TCP' })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_PROTOCOL_FAMILY_CHANGE' });
    });

    it('throws SSL_UPDATE_REQUIRES_ALB when setting ssl cert on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.updateLoadBalancer('20', { sslCertificateId: '42' })
      ).rejects.toMatchObject({ code: 'SSL_UPDATE_REQUIRES_ALB' });
    });

    it('throws MISSING_SSL_CERTIFICATE_ID when changing to HTTPS without cert', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.updateLoadBalancer('10', { frontendProtocol: 'HTTPS' })
      ).rejects.toMatchObject({ code: 'MISSING_SSL_CERTIFICATE_ID' });
    });

    it('throws REDIRECT_REQUIRES_BOTH_PROTOCOL when redirect used without BOTH', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.updateLoadBalancer('10', { redirectHttpToHttps: true })
      ).rejects.toMatchObject({ code: 'REDIRECT_REQUIRES_BOTH_PROTOCOL' });
    });
  });

  describe('updateBackendGroup', () => {
    it('updates ALB backend group algorithm', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.updateBackendGroup('10', 'web', {
        algorithm: 'leastconn'
      });

      expect(result.action).toBe('backend-group-update');
      expect(result.group_name).toBe('web');
      expect(result.algorithm).toBe('leastconn');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('updates ALB backend group protocol to HTTPS', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.updateBackendGroup('10', 'web', {
        backendProtocol: 'HTTPS'
      });

      expect(result.action).toBe('backend-group-update');
      expect(result.backend_protocol).toBe('HTTPS');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('updates NLB backend group algorithm', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      const result = await service.updateBackendGroup('20', 'tcp-grp', {
        algorithm: 'leastconn'
      });

      expect(result.action).toBe('backend-group-update');
      expect(result.group_name).toBe('tcp-grp');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('throws NLB_BACKEND_PROTOCOL_NOT_SUPPORTED for NLB with backend-protocol', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.updateBackendGroup('20', 'tcp-grp', { backendProtocol: 'HTTP' })
      ).rejects.toMatchObject({ code: 'NLB_BACKEND_PROTOCOL_NOT_SUPPORTED' });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on ALB', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.updateBackendGroup('10', 'nonexistent', {
          algorithm: 'roundrobin'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.updateBackendGroup('20', 'nonexistent', {
          algorithm: 'roundrobin'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });
  });

  describe('updateBackendServer', () => {
    it('updates ALB server IP', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.updateBackendServer('10', {
        backendGroup: 'web',
        backendServerName: 'server-1',
        ip: '10.0.0.9'
      });

      expect(result.action).toBe('backend-server-update');
      expect(result.server_name).toBe('server-1');
      expect(result.ip).toBe('10.0.0.9');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('updates NLB server port', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      const result = await service.updateBackendServer('20', {
        backendGroup: 'tcp-grp',
        backendServerName: 'srv-1',
        port: '9090'
      });

      expect(result.action).toBe('backend-server-update');
      expect(result.port).toBe('9090');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('throws BACKEND_SERVER_UPDATE_EMPTY when neither ip nor port is provided', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.updateBackendServer('10', {
          backendGroup: 'web',
          backendServerName: 'server-1'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_SERVER_UPDATE_EMPTY' });
    });

    it('throws BACKEND_SERVER_NOT_FOUND when server does not exist on ALB', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.updateBackendServer('10', {
          backendGroup: 'web',
          backendServerName: 'nonexistent',
          ip: '10.0.0.1'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_SERVER_NOT_FOUND' });
    });

    it('throws BACKEND_SERVER_NOT_FOUND when server does not exist on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.updateBackendServer('20', {
          backendGroup: 'tcp-grp',
          backendServerName: 'nonexistent',
          port: '8080'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_SERVER_NOT_FOUND' });
    });
  });

  describe('attachVpc', () => {
    it('attaches a VPC to an ALB', async () => {
      const { service, updateLoadBalancer, createVpcClient } =
        createServiceFixture();

      const result = await service.attachVpc('10', { vpc: '12345' });

      expect(result.action).toBe('network-vpc-attach');
      expect(result.lb_id).toBe('10');
      expect(result.vpc_id).toBe('12345');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
      expect(createVpcClient).toHaveBeenCalledOnce();
    });

    it('attaches a VPC with subnet and includes subnet_id in result', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.attachVpc('10', {
        vpc: '12345',
        subnet: '1'
      });

      expect(result.action).toBe('network-vpc-attach');
      expect(result.subnet_id).toBe('1');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });
  });

  describe('detachVpc', () => {
    it('detaches a VPC from an ALB', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createAlbDetails({
          context: [
            {
              backends: [],
              tcp_backend: [],
              lb_port: '80',
              node_list_type: 'S',
              plan_name: 'LB-2',
              vpc_list: [
                {
                  vpc_name: 'prod-vpc',
                  network_id: 100,
                  ipv4_cidr: '10.0.0.0/16'
                }
              ]
            }
          ]
        })
      );

      const result = await service.detachVpc('10', { vpc: '100' });

      expect(result.action).toBe('network-vpc-detach');
      expect(result.lb_id).toBe('10');
      expect(result.vpc_id).toBe('100');
      expect(updateLoadBalancer).toHaveBeenCalledOnce();
    });

    it('throws VPC_NOT_ATTACHED when VPC is not in vpc_list', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.detachVpc('10', { vpc: '9999' })
      ).rejects.toMatchObject({ code: 'VPC_NOT_ATTACHED' });
    });
  });

  describe('createLoadBalancer – defaultPortForProtocol', () => {
    it('uses default port 443 when HTTPS LB is created without --port', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'lb',
        plan: 'LB-2',
        frontendProtocol: 'HTTPS',
        backendGroup: 'web',
        backendServer: ['srv-1:10.0.0.1:80'],
        sslCertificateId: '99'
      });

      const body = createLoadBalancer.mock
        .calls[0]![0] as LoadBalancerCreateRequest;
      expect(body.lb_port).toBe('443');
    });

    it('throws when TCP LB is created without --port', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          frontendProtocol: 'TCP',
          backendGroup: 'web',
          backendServer: ['srv-1:10.0.0.1:80']
        })
      ).rejects.toThrow('--port is required for TCP load balancers');
    });
  });
});
