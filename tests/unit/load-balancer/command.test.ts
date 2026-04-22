import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { LoadBalancerClient } from '../../../src/load-balancer/index.js';
import type { ReservedIpClient } from '../../../src/reserved-ip/index.js';
import type { SecurityGroupClient } from '../../../src/security-group/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createLbClientStub(): {
  stub: LoadBalancerClient;
  createLoadBalancer: ReturnType<typeof vi.fn>;
  listLoadBalancers: ReturnType<typeof vi.fn>;
  getLoadBalancer: ReturnType<typeof vi.fn>;
  updateLoadBalancer: ReturnType<typeof vi.fn>;
  deleteLoadBalancer: ReturnType<typeof vi.fn>;
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
  const getLoadBalancer = vi.fn(() =>
    Promise.resolve({
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
    })
  );
  const updateLoadBalancer = vi.fn(() =>
    Promise.resolve({ message: 'Updated.' })
  );
  const deleteLoadBalancer = vi.fn(() =>
    Promise.resolve({ message: 'Deleted.' })
  );

  const stub: LoadBalancerClient = {
    createLoadBalancer,
    deleteLoadBalancer,
    getLoadBalancer,
    listLoadBalancers,
    updateLoadBalancer
  };

  return {
    stub,
    createLoadBalancer,
    listLoadBalancers,
    getLoadBalancer,
    updateLoadBalancer,
    deleteLoadBalancer
  };
}

describe('load-balancer commands', () => {
  function createRuntimeFixture(options?: {
    confirmResult?: boolean;
    isInteractive?: boolean;
  }): {
    lbStub: ReturnType<typeof createLbClientStub>;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stderr: MemoryWriter;
    receivedCredentials: () => ResolvedCredentials | undefined;
  } {
    const configPath = createTestConfigPath('lb-command-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    const lbStub = createLbClientStub();
    const confirm = vi.fn(() =>
      Promise.resolve(options?.confirmResult ?? true)
    );
    let credentials: ResolvedCredentials | undefined;

    const throwNotUsed = (name: string) => () => {
      throw new Error(`${name} should not be called in this test`);
    };

    const runtime: CliRuntime = {
      confirm,
      createLoadBalancerClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return lbStub.stub;
      },
      createNodeClient: throwNotUsed(
        'NodeClient'
      ) as unknown as CliRuntime['createNodeClient'],
      createProjectClient: throwNotUsed(
        'ProjectClient'
      ) as unknown as CliRuntime['createProjectClient'],
      createReservedIpClient: vi.fn() as unknown as (
        c: ResolvedCredentials
      ) => ReservedIpClient,
      createSecurityGroupClient: vi.fn() as unknown as (
        c: ResolvedCredentials
      ) => SecurityGroupClient,
      createSshKeyClient: vi.fn() as unknown as (
        c: ResolvedCredentials
      ) => SshKeyClient,
      createVolumeClient: vi.fn() as unknown as (
        c: ResolvedCredentials
      ) => VolumeClient,
      createVpcClient: vi.fn() as unknown as (
        c: ResolvedCredentials
      ) => VpcClient,
      credentialValidator: { validate: vi.fn() },
      isInteractive: options?.isInteractive ?? true,
      prompt: vi.fn(() => Promise.resolve('')),
      stderr,
      stdout,
      store
    };

    return {
      lbStub,
      runtime,
      stdout,
      stderr,
      receivedCredentials: () => credentials
    };
  }

  async function seedProfile(runtime: CliRuntime): Promise<void> {
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
  }

  it('lists load balancers in human-readable mode', async () => {
    const { runtime, stdout, lbStub } = createRuntimeFixture();
    await seedProfile(runtime);
    lbStub.listLoadBalancers.mockResolvedValue([
      {
        id: 1,
        appliance_name: 'alb-1',
        status: 'RUNNING',
        lb_mode: 'HTTP',
        lb_type: 'external',
        public_ip: '1.2.3.4'
      }
    ]);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'load-balancer',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('alb-1');
    expect(stdout.buffer).toContain('HTTP');
  });

  it('creates an ALB and prints confirmation', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'load-balancer',
      'create',
      '--alias',
      'prod',
      '--name',
      'my-alb',
      '--plan',
      'LB-2',
      '--mode',
      'HTTP',
      '--port',
      '80',
      '--backend-name',
      'web',
      '--server-ip',
      '10.0.0.1',
      '--server-port',
      '8080',
      '--server-name',
      'server-1'
    ]);

    expect(stdout.buffer).toContain('42');
  });

  it('rejects invalid --mode with usage error', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'load-balancer',
        'create',
        '--alias',
        'prod',
        '--name',
        'my-lb',
        '--plan',
        'LB-2',
        '--mode',
        'FTP',
        '--port',
        '80'
      ])
    ).rejects.toThrow();
  });

  it('rejects --backend-name without --server-ip', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'load-balancer',
        'create',
        '--alias',
        'prod',
        '--name',
        'my-lb',
        '--plan',
        'LB-2',
        '--mode',
        'HTTP',
        '--port',
        '80',
        '--backend-name',
        'web',
        '--server-name',
        'server-1'
      ])
    ).rejects.toThrow('--server-ip is required when --backend-name is set');
  });

  it('rejects --backend-name without --server-name', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        CLI_COMMAND_NAME,
        'load-balancer',
        'create',
        '--alias',
        'prod',
        '--name',
        'my-lb',
        '--plan',
        'LB-2',
        '--mode',
        'HTTP',
        '--port',
        '80',
        '--backend-name',
        'web',
        '--server-ip',
        '10.0.0.1'
      ])
    ).rejects.toThrow('--server-name is required when --backend-name is set');
  });

  it('deletes a load balancer with --force', async () => {
    const { runtime, stdout, lbStub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'load-balancer',
      'delete',
      '42',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(lbStub.deleteLoadBalancer).toHaveBeenCalledWith('42', undefined);
    expect(stdout.buffer).toContain('Deleted');
  });

  it('lists backend groups via backend group list', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'load-balancer',
      'backend',
      'group',
      'list',
      '10',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('web');
    expect(stdout.buffer).toContain('server-1');
  });

  it('creates a new backend group via backend group create', async () => {
    const { runtime, stdout, lbStub } = createRuntimeFixture();
    await seedProfile(runtime);
    // Return ALB with no existing group named 'api'
    lbStub.getLoadBalancer.mockResolvedValue({
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
    });
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'load-balancer',
      'backend',
      'group',
      'create',
      '10',
      '--alias',
      'prod',
      '--name',
      'web',
      '--server-ip',
      '10.0.0.5',
      '--server-port',
      '8080',
      '--server-name',
      'server-2'
    ]);

    expect(stdout.buffer).toContain('web');
    expect(stdout.buffer).toContain('created');
  });

  it('adds a server to an existing backend group via backend server add', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      'load-balancer',
      'backend',
      'server',
      'add',
      '10',
      '--alias',
      'prod',
      '--backend-name',
      'web',
      '--server-ip',
      '10.0.0.5',
      '--server-port',
      '8080',
      '--server-name',
      'server-2'
    ]);

    expect(stdout.buffer).toContain('server-2');
    expect(stdout.buffer).toContain('web');
  });
});
