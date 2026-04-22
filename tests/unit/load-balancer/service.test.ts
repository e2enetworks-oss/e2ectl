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
        plan_name: 'LB-2'
      }
    ]
  };
}

function createEmptyAlbDetails(): LoadBalancerDetails {
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
        plan_name: 'LB-2'
      }
    ]
  };
}

function createEmptyNlbDetails(): LoadBalancerDetails {
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
        plan_name: 'LB-2'
      }
    ]
  };
}

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
  createLoadBalancer: ReturnType<typeof vi.fn>;
  createLoadBalancerClient: ReturnType<typeof vi.fn>;
  deleteLoadBalancer: ReturnType<typeof vi.fn>;
  getLoadBalancer: ReturnType<typeof vi.fn>;
  lbClient: LoadBalancerClient;
  listLoadBalancers: ReturnType<typeof vi.fn>;
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
  const listLoadBalancerPlans = vi.fn(() => Promise.resolve([]));

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

  const readConfig = vi.fn(() => Promise.resolve(createConfig()));
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));

  const service = new LoadBalancerService({
    confirm,
    createLoadBalancerClient,
    isInteractive: options?.isInteractive ?? true,
    store: { configPath: '/tmp/.e2ectl/config.json', read: readConfig }
  });

  return {
    confirm,
    createLoadBalancer,
    createLoadBalancerClient,
    deleteLoadBalancer,
    getLoadBalancer,
    lbClient,
    listLoadBalancers,
    readConfig,
    receivedCredentials: () => capturedCredentials,
    service,
    updateLoadBalancer
  };
}

describe('LoadBalancerService', () => {
  describe('listLoadBalancers', () => {
    it('returns a list result', async () => {
      const { service, listLoadBalancers } = createServiceFixture();
      listLoadBalancers.mockResolvedValue([
        { id: 1, appliance_name: 'alb-1', status: 'RUNNING', lb_mode: 'HTTP' }
      ]);

      const result = await service.listLoadBalancers({});

      expect(result.action).toBe('list');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].appliance_name).toBe('alb-1');
    });
  });

  describe('createLoadBalancer', () => {
    it('creates an ALB with HTTP mode and puts backends in backends[]', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'my-alb',
        plan: 'LB-2',
        mode: 'HTTP',
        port: '80',
        backendName: 'web',
        serverIp: '10.0.0.1',
        serverPort: '8080',
        serverName: 'server-1'
      });

      const body = createLoadBalancer.mock
        .calls[0][0] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('HTTP');
      expect(body.backends).toHaveLength(1);
      expect(body.tcp_backend).toHaveLength(0);
      expect(body.backends[0].name).toBe('web');
      expect(body.backends[0]?.servers?.[0]?.backend_ip).toBe('10.0.0.1');
    });

    it('creates an NLB with TCP mode and puts backend in tcp_backend[]', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'my-nlb',
        plan: 'LB-2',
        mode: 'TCP',
        port: '80',
        backendName: 'tcp-grp',
        serverIp: '10.0.0.2',
        serverPort: '8080',
        serverName: 'srv-1',
        backendPort: '8080'
      });

      const body = createLoadBalancer.mock
        .calls[0][0] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('TCP');
      expect(body.tcp_backend).toHaveLength(1);
      expect(body.backends).toHaveLength(0);
      expect(body.tcp_backend[0].backend_name).toBe('tcp-grp');
    });

    it('applies default timeouts of 60', async () => {
      const { service, createLoadBalancer } = createServiceFixture();

      await service.createLoadBalancer({
        name: 'lb',
        plan: 'LB-2',
        mode: 'HTTP',
        port: '80'
      });

      const body = createLoadBalancer.mock
        .calls[0][0] as LoadBalancerCreateRequest;
      expect(body.client_timeout).toBe(60);
      expect(body.server_timeout).toBe(60);
      expect(body.connection_timeout).toBe(60);
      expect(body.http_keep_alive_timeout).toBe(60);
    });

    it('throws on invalid mode', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          mode: 'FTP',
          port: '80'
        })
      ).rejects.toThrow('Invalid --mode');
    });

    it('throws on invalid port', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({
          name: 'lb',
          plan: 'LB-2',
          mode: 'HTTP',
          port: 'abc'
        })
      ).rejects.toThrow('--port must be an integer');
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
      expect(result.tcp_backends[0].backend_name).toBe('tcp-grp');
      expect(result.backends).toHaveLength(0);
    });
  });

  describe('createBackendGroup', () => {
    it('creates a new ALB backend group (no server provided)', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyAlbDetails());

      const result = await service.createBackendGroup('30', {
        name: 'api',
        algorithm: 'leastconn',
        domainName: 'api.example.com'
      });

      expect(result.action).toBe('backend-group-create');
      expect(result.lb_id).toBe('30');
      expect(result.message).toContain('"api"');

      const body = updateLoadBalancer.mock
        .calls[0][1] as LoadBalancerCreateRequest;
      expect(body.backends).toHaveLength(1);
      expect(body.backends[0]?.name).toBe('api');
      expect(body.backends[0]?.servers).toHaveLength(0);
      expect(body.backends[0]?.balance).toBe('leastconn');
    });

    it('creates a new ALB backend group with initial server', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyAlbDetails());

      const result = await service.createBackendGroup('30', {
        name: 'web',
        serverIp: '10.0.0.5',
        serverPort: '8080',
        serverName: 'server-1'
      });

      expect(result.action).toBe('backend-group-create');
      const body = updateLoadBalancer.mock
        .calls[0][1] as LoadBalancerCreateRequest;
      expect(body.backends[0]?.servers).toHaveLength(1);
      expect(body.backends[0]?.servers?.[0]?.backend_ip).toBe('10.0.0.5');
    });

    it('creates a new NLB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createEmptyNlbDetails());

      const result = await service.createBackendGroup('40', {
        name: 'tcp-grp',
        backendPort: '8080',
        serverIp: '10.0.0.2',
        serverPort: '8080',
        serverName: 'srv-1'
      });

      expect(result.action).toBe('backend-group-create');
      const body = updateLoadBalancer.mock
        .calls[0][1] as LoadBalancerCreateRequest;
      expect(body.tcp_backend).toHaveLength(1);
      expect(body.tcp_backend[0]?.backend_name).toBe('tcp-grp');
      expect(body.tcp_backend[0]?.port).toBe(8080);
    });

    it('throws BACKEND_GROUP_EXISTS if group name already exists on ALB', async () => {
      const { service } = createServiceFixture();
      // default getLoadBalancer returns ALB with 'web' group

      await expect(
        service.createBackendGroup('10', { name: 'web' })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_EXISTS' });
    });

    it('throws NLB_SINGLE_BACKEND_GROUP if NLB already has a group', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.createBackendGroup('20', {
          name: 'new-group',
          backendPort: '9000'
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
        service.createBackendGroup('10', { name: 'api' })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });
  });

  describe('addBackendServer', () => {
    it('adds a server to an existing ALB backend group', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.addBackendServer('10', {
        backendName: 'web',
        serverIp: '10.0.0.5',
        serverPort: '8080',
        serverName: 'server-2'
      });

      expect(result.action).toBe('backend-server-add');
      const updatedBody = updateLoadBalancer.mock
        .calls[0][1] as LoadBalancerCreateRequest;
      const webGroup = updatedBody.backends?.find((b) => b.name === 'web');
      expect(webGroup?.servers).toHaveLength(2);
      expect(webGroup?.servers?.[1]?.backend_ip).toBe('10.0.0.5');
    });

    it('adds a server to an existing NLB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      const result = await service.addBackendServer('20', {
        backendName: 'tcp-grp',
        serverIp: '10.0.0.3',
        serverPort: '8080',
        serverName: 'srv-2'
      });

      expect(result.action).toBe('backend-server-add');
      const updatedBody = updateLoadBalancer.mock
        .calls[0][1] as LoadBalancerCreateRequest;
      expect(updatedBody.tcp_backend?.[0]?.servers).toHaveLength(2);
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on ALB', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.addBackendServer('10', {
          backendName: 'nonexistent',
          serverIp: '10.0.0.5',
          serverPort: '8080',
          serverName: 'server-2'
        })
      ).rejects.toMatchObject({ code: 'BACKEND_GROUP_NOT_FOUND' });
    });

    it('throws BACKEND_GROUP_NOT_FOUND when group does not exist on NLB', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.addBackendServer('20', {
          backendName: 'nonexistent',
          serverIp: '10.0.0.4',
          serverPort: '8080',
          serverName: 'srv-3'
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
          backendName: 'web',
          serverIp: '10.0.0.5',
          serverPort: '8080',
          serverName: 'server-2'
        })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });
  });
});
