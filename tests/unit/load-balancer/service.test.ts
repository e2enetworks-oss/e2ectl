import type { ConfigFile, ResolvedCredentials } from '../../../src/config/index.js';
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
              { backend_name: 'server-1', backend_ip: '10.0.0.1', backend_port: 8080 }
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
              { backend_name: 'srv-1', backend_ip: '10.0.0.2', backend_port: 8080 }
            ]
          }
        ],
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
  const deleteLoadBalancer = vi.fn(() => Promise.resolve({ message: 'Deleted.' }));
  const updateLoadBalancer = vi.fn(() => Promise.resolve({ message: 'Updated.' }));

  const lbClient: LoadBalancerClient = {
    createLoadBalancer,
    deleteLoadBalancer,
    getLoadBalancer,
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

      const body = createLoadBalancer.mock.calls[0][0] as LoadBalancerCreateRequest;
      expect(body.lb_mode).toBe('HTTP');
      expect(body.backends).toHaveLength(1);
      expect(body.tcp_backend).toHaveLength(0);
      expect(body.backends[0].name).toBe('web');
      expect(body.backends[0].servers[0].backend_ip).toBe('10.0.0.1');
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

      const body = createLoadBalancer.mock.calls[0][0] as LoadBalancerCreateRequest;
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

      const body = createLoadBalancer.mock.calls[0][0] as LoadBalancerCreateRequest;
      expect(body.client_timeout).toBe(60);
      expect(body.server_timeout).toBe(60);
      expect(body.connection_timeout).toBe(60);
      expect(body.http_keep_alive_timeout).toBe(60);
    });

    it('throws on invalid mode', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({ name: 'lb', plan: 'LB-2', mode: 'FTP', port: '80' })
      ).rejects.toThrow('Invalid --mode');
    });

    it('throws on invalid port', async () => {
      const { service } = createServiceFixture();

      await expect(
        service.createLoadBalancer({ name: 'lb', plan: 'LB-2', mode: 'HTTP', port: 'abc' })
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

  describe('listBackends', () => {
    it('returns ALB backends from context', async () => {
      const { service } = createServiceFixture();

      const result = await service.listBackends('10', {});

      expect(result.action).toBe('backend-list');
      expect(result.backends).toHaveLength(1);
      expect(result.backends[0].name).toBe('web');
      expect(result.tcp_backends).toHaveLength(0);
    });

    it('returns NLB tcp_backends from context', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      const result = await service.listBackends('20', {});

      expect(result.action).toBe('backend-list');
      expect(result.tcp_backends).toHaveLength(1);
      expect(result.tcp_backends[0].backend_name).toBe('tcp-grp');
      expect(result.backends).toHaveLength(0);
    });
  });

  describe('addBackend', () => {
    it('adds a server to an existing ALB backend group', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      const result = await service.addBackend('10', {
        backendName: 'web',
        serverIp: '10.0.0.5',
        serverPort: '8080',
        serverName: 'server-2'
      });

      expect(result.action).toBe('backend-add');
      const updatedBody = updateLoadBalancer.mock.calls[0][1];
      const webGroup = updatedBody.backends.find(
        (b: { name: string }) => b.name === 'web'
      );
      expect(webGroup.servers).toHaveLength(2);
      expect(webGroup.servers[1].backend_ip).toBe('10.0.0.5');
    });

    it('creates a new ALB backend group when name does not exist', async () => {
      const { service, updateLoadBalancer } = createServiceFixture();

      await service.addBackend('10', {
        backendName: 'api',
        serverIp: '10.0.0.9',
        serverPort: '9090',
        serverName: 'api-server-1'
      });

      const updatedBody = updateLoadBalancer.mock.calls[0][1];
      expect(updatedBody.backends).toHaveLength(2);
      const apiGroup = updatedBody.backends.find(
        (b: { name: string }) => b.name === 'api'
      );
      expect(apiGroup).toBeDefined();
    });

    it('adds a server to an existing NLB backend group', async () => {
      const { service, getLoadBalancer, updateLoadBalancer } =
        createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await service.addBackend('20', {
        backendName: 'tcp-grp',
        serverIp: '10.0.0.3',
        serverPort: '8080',
        serverName: 'srv-2',
        backendPort: '8080'
      });

      const updatedBody = updateLoadBalancer.mock.calls[0][1];
      expect(updatedBody.tcp_backend[0].servers).toHaveLength(2);
    });

    it('rejects adding a second NLB backend group', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(createNlbDetails());

      await expect(
        service.addBackend('20', {
          backendName: 'different-group',
          serverIp: '10.0.0.4',
          serverPort: '8080',
          serverName: 'srv-3'
        })
      ).rejects.toThrow('NLB supports only one backend group');
    });

    it('throws when LB context is undefined', async () => {
      const { service, getLoadBalancer } = createServiceFixture();
      getLoadBalancer.mockResolvedValue(
        createAlbDetails({ context: undefined })
      );

      await expect(
        service.addBackend('10', {
          backendName: 'web',
          serverIp: '10.0.0.5',
          serverPort: '8080',
          serverName: 'server-2'
        })
      ).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
    });
  });
});
