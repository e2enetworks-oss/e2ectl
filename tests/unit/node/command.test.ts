import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { NodeClient, NodeCreateRequest } from '../../../src/node/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createNodeClientStub() {
  const listNodes = vi.fn(() =>
    Promise.resolve({
      nodes: [
        {
          id: 101,
          is_locked: false,
          name: 'node-a',
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.1',
          public_ip_address: '1.1.1.1',
          status: 'Running'
        }
      ],
      total_count: 1,
      total_page_number: 1
    })
  );
  const getNode = vi.fn(() =>
    Promise.resolve({
      created_at: '2026-03-11T10:00:00Z',
      disk: '100 GB',
      id: 101,
      location: 'Delhi',
      memory: '8 GB',
      name: 'node-a',
      plan: 'C3.8GB',
      private_ip_address: '10.0.0.1',
      public_ip_address: '1.1.1.1',
      status: 'Running',
      vcpus: '4'
    })
  );
  const createNode = vi.fn((body: NodeCreateRequest) =>
    Promise.resolve({
      node_create_response: [
        {
          created_at: '2026-03-11T10:00:00Z',
          id: 205,
          location: 'Delhi',
          name: body.name,
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.2',
          public_ip_address: '1.1.1.2',
          status: 'Creating'
        }
      ],
      total_number_of_node_created: 1,
      total_number_of_node_requested: 1
    })
  );
  const deleteNode = vi.fn(() =>
    Promise.resolve({
      message: 'Success'
    })
  );
  const listNodeCatalogOs = vi.fn(() =>
    Promise.resolve({
      category_list: [
        {
          OS: 'Ubuntu',
          category: ['Linux Virtual Node'],
          version: [
            {
              number_of_domains: null,
              os: 'Ubuntu',
              software_version: '',
              sub_category: 'Ubuntu',
              version: '24.04'
            }
          ]
        }
      ]
    })
  );
  const listNodeCatalogPlans = vi.fn(() =>
    Promise.resolve([
      {
        available_inventory_status: true,
        currency: 'INR',
        image: 'Ubuntu-24.04-Distro',
        location: 'Delhi',
        name: 'C3.8GB',
        os: {
          category: 'Ubuntu',
          image: 'Ubuntu-24.04-Distro',
          name: 'Ubuntu',
          version: '24.04'
        },
        plan: 'C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi',
        specs: {
          cpu: 4,
          disk_space: 100,
          price_per_month: 2263,
          ram: '8.00',
          series: 'C3',
          sku_name: 'C3.8GB'
        }
      }
    ])
  );

  const stub: NodeClient = {
    createNode,
    deleteNode,
    getNode,
    listNodeCatalogOs,
    listNodeCatalogPlans,
    listNodes
  };

  return {
    createNode,
    deleteNode,
    getNode,
    listNodeCatalogOs,
    listNodeCatalogPlans,
    listNodes,
    stub
  };
}

describe('node commands', () => {
  function createRuntimeFixture(options?: {
    confirmResult?: boolean;
    isInteractive?: boolean;
  }): {
    confirm: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createNodeClientStub>;
  } {
    const configPath = createTestConfigPath('node-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createNodeClientStub();
    const confirm = vi.fn(() =>
      Promise.resolve(options?.confirmResult ?? true)
    );
    const prompt = vi.fn(() => Promise.resolve(''));
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm,
      createNodeClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return stub.stub;
      },
      credentialValidator: {
        validate: vi.fn()
      },
      isInteractive: options?.isInteractive ?? true,
      prompt,
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      confirm,
      prompt,
      receivedCredentials: () => credentials,
      runtime,
      stdout,
      stub
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

  it('lists nodes in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      project_id: '12345',
      location: 'Delhi'
    });
    expect(stdout.buffer).toContain('"action": "list"');
    expect(stdout.buffer).toContain('"name": "node-a"');
  });

  it('applies per-command project and location overrides', async () => {
    const { receivedCredentials, runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      'node',
      'list',
      '--alias',
      'prod',
      '--project-id',
      '46429',
      '--location',
      'Chennai'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      project_id: '46429',
      location: 'Chennai'
    });
  });

  it('gets a node in human-readable mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      'node',
      'get',
      '101',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID: 101');
    expect(stdout.buffer).toContain('Name: node-a');
    expect(stdout.buffer).toContain('Status: Running');
  });

  it('creates a public-node request that stays compatible with backend serializer defaults', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'create',
      '--name',
      'new-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--alias',
      'prod'
    ]);

    const request = stub.createNode.mock.calls[0]?.[0];

    expect(request).toMatchObject({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'new-node',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(request).not.toHaveProperty('security_group_id');
    expect(request).not.toHaveProperty('vpc_id');
    expect(request).not.toHaveProperty('subnet_id');
    expect(request).not.toHaveProperty('reserve_ip');
    expect(request).not.toHaveProperty('reserve_ip_pool');
    expect(request).not.toHaveProperty('image_id');
    expect(request).not.toHaveProperty('disk');
    expect(request).not.toHaveProperty('is_encryption_required');
    expect(request).not.toHaveProperty('isEncryptionEnabled');
    expect(request).not.toHaveProperty('saved_image_template_id');
    expect(stdout.buffer).toContain('"action": "create"');
    expect(stdout.buffer).toContain('"created": 1');
  });

  it('lists OS catalog rows in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'catalog',
      'os',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('"action": "catalog-os"');
    expect(stdout.buffer).toContain('"display_category": "Linux Virtual Node"');
    expect(stdout.buffer).toContain('"os_version": "24.04"');
  });

  it('lists valid plan and image pairs for a selected catalog row', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'catalog',
      'plans',
      '--display-category',
      'Linux Virtual Node',
      '--category',
      'Ubuntu',
      '--os',
      'Ubuntu',
      '--os-version',
      '24.04',
      '--alias',
      'prod'
    ]);

    expect(stub.listNodeCatalogPlans).toHaveBeenCalledWith({
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });
    expect(stdout.buffer).toContain('"action": "catalog-plans"');
    expect(stdout.buffer).toContain('"image": "Ubuntu-24.04-Distro"');
    expect(stdout.buffer).toContain(
      '"plan": "C3-4vCPU-8RAM-100DISK-C3.8GB-Ubuntu-24.04-Delhi"'
    );
  });

  it('cancels deletion when the confirmation is declined', async () => {
    const { confirm, runtime, stdout, stub } = createRuntimeFixture({
      confirmResult: false,
      isInteractive: true
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod'
    ]);

    expect(confirm).toHaveBeenCalledWith(
      'Delete node 101? This cannot be undone.'
    );
    expect(stub.deleteNode).not.toHaveBeenCalled();
    expect(stdout.buffer).toContain('"cancelled": true');
  });

  it('requires force outside an interactive terminal', async () => {
    const { runtime, stub } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'node',
        'delete',
        '101',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/requires confirmation/i);
    expect(stub.deleteNode).not.toHaveBeenCalled();
  });

  it('deletes a node when force is supplied', async () => {
    const { confirm, runtime, stdout, stub } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(stub.deleteNode).toHaveBeenCalledWith('101');
    expect(stdout.buffer).toContain('"cancelled": false');
  });

  it('rejects non-numeric node identifiers', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'node',
        'get',
        'node-abc',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/Node ID must be numeric/i);
  });

  it('shows node help with the catalog namespace', () => {
    const { runtime } = createRuntimeFixture();
    const program = createProgram(runtime);
    const nodeCommand = program.commands.find(
      (command) => command.name() === 'node'
    );

    expect(nodeCommand).toBeDefined();
    expect(nodeCommand?.helpInformation()).toContain('catalog');
    expect(nodeCommand?.helpInformation()).toContain('create');
  });
});
