import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import { AppError, CliError, EXIT_CODES } from '../../../../src/core/errors.js';
import {
  normalizeNodeCatalogPlanFilters,
  normalizeNodeCatalogPlanItems,
  summarizeNodeCatalogOs,
  summarizeNodeCatalogPlans
} from '../../../../src/myaccount/node/catalog.js';
import type {
  NodeCatalogPlan,
  NodeClient,
  NodeDetails
} from '../../../../src/myaccount/node/index.js';
import { NodeService } from '../../../../src/myaccount/node/service.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const ACTION = {
  action_type: 'reboot',
  created_at: '2026-10-25T10:00:00Z',
  id: 1,
  resource_id: '101',
  status: 'Done'
};

function node(overrides: Partial<NodeDetails> = {}): NodeDetails {
  return {
    id: 101,
    name: 'e2ectl-test-node',
    os_info: {
      category: 'Linux Virtual Node',
      name: 'Ubuntu',
      version: '24.04'
    },
    plan: 'C3.8GB',
    status: 'Running',
    ...overrides
  };
}

function plan(overrides: Partial<NodeCatalogPlan> = {}): NodeCatalogPlan {
  return {
    image: 'Ubuntu-24.04-Distro',
    name: 'C3.8GB',
    plan: 'C3-4vCPU-8RAM',
    specs: { cpu: 4, family: 'CPU', ram: '8.00' },
    ...overrides
  };
}

const CATALOG = {
  category_list: {
    GPU: {
      'Nvidia-A100': [{ os: 'Ubuntu', sub_category: 'Gpu', version: '22.04' }],
      'Nvidia-T4': [{ os: 'Ubuntu', sub_category: 'Gpu', version: '22.04' }]
    },
    'GPU Cloud Wizard': { containers: [{ name: 'nemo' }] },
    'Linux Virtual Node': {
      Ubuntu: [{ os: 'Ubuntu', sub_category: 'Ubuntu', version: '24.04' }]
    }
  }
};

function fakeClient(overrides: Partial<NodeClient> = {}): NodeClient {
  const unused = (): never => {
    throw new Error('not used');
  };
  return {
    attachSshKeys: unused,
    createSnapshot: unused,
    deleteSnapshot: unused,
    listSnapshots: unused,
    saveSnapshotAsImage: unused,
    createNode: () =>
      Promise.resolve({
        node_create_response: [node({ status: 'Creating' })],
        total_number_of_node_created: 1,
        total_number_of_node_requested: 1
      }),
    deleteNode: unused,
    getNode: () => Promise.resolve(node()),
    listNodeCatalogOs: () => Promise.resolve(CATALOG),
    listNodeCatalogPlans: () => Promise.resolve([plan()]),
    listNodes: unused,
    powerOffNode: unused,
    powerOnNode: unused,
    rebootNode: () => Promise.resolve(ACTION),
    saveNodeImage: unused,
    setDeletionProtection: () => Promise.resolve(ACTION),
    upgradeNode: () =>
      Promise.resolve({ message: 'Upgrade started', vm_id: 9 }),
    ...overrides
  };
}

function service(
  client: NodeClient,
  interactive = false,
  progress?: (line: string) => void
): NodeService {
  const unused = (): never => {
    throw new Error('not used');
  };
  return new NodeService({
    confirm: () => Promise.resolve(true),
    createNodeClient: () => client,
    createReservedIpClient: unused,
    createSecurityGroupClient: unused,
    createSshKeyClient: unused,
    createVolumeClient: unused,
    createVpcClient: unused,
    isInteractive: interactive,
    nodeReadyPoll: { attempts: 3, intervalMs: 0 },
    ...(progress === undefined ? {} : { progress }),
    store: {
      configPath: '/tmp/config.json',
      read: () =>
        Promise.resolve({
          default: 'work',
          profiles: {
            work: {
              api_key: 'k',
              auth_token: 't',
              myaccount: { location: 'Chennai', project_id: '1' }
            }
          }
        })
    }
  });
}

const CREATE = {
  image: 'Ubuntu-24.04-Distro',
  name: 'e2ectl-test-node',
  plan: 'C3-4vCPU-8RAM'
};

describe('node reboot and deletion protection', () => {
  it('reboots a node', async () => {
    const rebootNode = vi.fn(() => Promise.resolve(ACTION));
    const result = await service(fakeClient({ rebootNode })).rebootNode(
      '101',
      {}
    );

    expect(rebootNode).toHaveBeenCalledWith('101');
    expect(result).toMatchObject({ action: 'reboot', node_id: 101 });
  });

  it.each([
    [true, 'protect'],
    [false, 'unprotect']
  ] as const)('turns protection %s as %s', async (enabled, action) => {
    const setDeletionProtection = vi.fn(() => Promise.resolve(ACTION));
    const result = await service(
      fakeClient({ setDeletionProtection })
    ).setDeletionProtection('101', enabled, {});

    expect(setDeletionProtection).toHaveBeenCalledWith('101', enabled);
    expect(result.action).toBe(action);
  });

  it('rejects a non-numeric node id before calling the API', async () => {
    await expect(
      service(fakeClient()).rebootNode('abc', {})
    ).rejects.toMatchObject({
      code: 'INVALID_NODE_ID'
    });
  });
});

describe('node delete with protection on', () => {
  it('says to run unprotect first', async () => {
    const refused = new AppError(
      'MyAccount API request failed: Precondition Failed',
      {
        code: 'API_REQUEST_FAILED',
        details: [
          'HTTP status: 412 ',
          `Errors: "The 'Delete' action cannot be performed while the accidental protection mode is enabled."`
        ]
      }
    );
    const error = await service(
      fakeClient({ deleteNode: () => Promise.reject(refused) })
    )
      .deleteNode('101', { force: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'NODE_DELETE_PROTECTED',
      suggestion: expect.stringContaining('node action unprotect 101') as string
    });
  });

  it('also reads the protection notice from the error message', async () => {
    const refused = new AppError(
      'The Delete action cannot be performed while the accidental protection mode is enabled.',
      { code: 'API_REQUEST_FAILED' }
    );
    const error = await service(
      fakeClient({ deleteNode: () => Promise.reject(refused) })
    )
      .deleteNode('101', { force: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NODE_DELETE_PROTECTED' });
  });

  it('passes other delete failures through', async () => {
    const other = new AppError('MyAccount API request failed: Not Found', {
      code: 'API_REQUEST_FAILED',
      details: ['HTTP status: 404 ']
    });

    await expect(
      service(
        fakeClient({ deleteNode: () => Promise.reject(other) })
      ).deleteNode('101', {
        force: true
      })
    ).rejects.toBe(other);
  });
});

describe('node create --wait', () => {
  it('returns once the node is running', async () => {
    const getNode = vi
      .fn<NodeClient['getNode']>()
      .mockResolvedValueOnce(node({ status: 'Creating' }))
      .mockResolvedValueOnce(node({ status: 'Running' }));

    const result = await service(fakeClient({ getNode })).createNode({
      ...CREATE,
      wait: true
    });

    expect(getNode).toHaveBeenCalledTimes(2);
    expect(result.node?.status).toBe('Running');
  });

  it('reports each status change once while it waits', async () => {
    const lines: string[] = [];
    const getNode = vi
      .fn<NodeClient['getNode']>()
      .mockResolvedValueOnce(node({ status: 'Creating' }))
      .mockResolvedValueOnce(node({ status: 'Creating' }))
      .mockResolvedValueOnce(node({ status: 'Running' }));

    await service(fakeClient({ getNode }), false, (line) => {
      lines.push(line);
    }).createNode({ ...CREATE, wait: true });

    expect(lines).toEqual(['Node 101: Creating\n', 'Node 101: Running\n']);
  });

  it('keeps waiting after a check that failed for a network reason', async () => {
    const getNode = vi
      .fn<NodeClient['getNode']>()
      .mockRejectedValueOnce(
        new AppError('MyAccount API request failed: Bad Gateway', {
          code: 'API_REQUEST_FAILED',
          exitCode: EXIT_CODES.network
        })
      )
      .mockResolvedValueOnce(node({ status: 'Running' }));

    const result = await service(fakeClient({ getNode })).createNode({
      ...CREATE,
      wait: true
    });

    expect(result.node?.status).toBe('Running');
  });

  it('does not wait without --wait', async () => {
    const getNode = vi.fn<NodeClient['getNode']>();
    const result = await service(fakeClient({ getNode })).createNode(CREATE);

    expect(getNode).not.toHaveBeenCalled();
    expect(result.node).toBeUndefined();
  });

  it('stops as soon as the node fails and names it', async () => {
    const error = await service(
      fakeClient({ getNode: () => Promise.resolve(node({ status: 'Failed' })) })
    )
      .createNode({ ...CREATE, wait: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'NODE_CREATE_FAILED',
      message: 'Node 101 failed to start (status: Failed).'
    });
  });

  it('gives up after the last check and says the node is billed', async () => {
    const error = await service(
      fakeClient({
        getNode: () => Promise.resolve(node({ status: 'Creating' }))
      })
    )
      .createNode({ ...CREATE, wait: true })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CliError);
    expect(error).toMatchObject({ code: 'NODE_WAIT_TIMEOUT' });
    expect((error as CliError).suggestion).toContain('node get 101');
    expect((error as CliError).suggestion).toContain('billed');
  });

  it('names the node when a check fails', async () => {
    const error = await service(
      fakeClient({
        getNode: () =>
          Promise.reject(
            new AppError('MyAccount API request timed out.', {
              code: 'API_TIMEOUT'
            })
          )
      })
    )
      .createNode({ ...CREATE, wait: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'NODE_WAIT_FAILED',
      details: ['Reason: MyAccount API request timed out.']
    });
    expect((error as CliError).message).toContain('Node 101 was created');
  });

  it('keeps the exit code of an auth failure while waiting', async () => {
    const error = await service(
      fakeClient({
        getNode: () =>
          Promise.reject(
            new AppError('MyAccount API request failed: Unauthorized', {
              code: 'API_REQUEST_FAILED',
              exitCode: EXIT_CODES.auth
            })
          )
      })
    )
      .createNode({ ...CREATE, wait: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'NODE_WAIT_FAILED',
      exitCode: EXIT_CODES.auth
    });
  });

  it('cannot wait when E2E returns no node', async () => {
    const error = await service(
      fakeClient({
        createNode: () =>
          Promise.resolve({
            node_create_response: [],
            total_number_of_node_created: 0,
            total_number_of_node_requested: 1
          })
      })
    )
      .createNode({ ...CREATE, wait: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NODE_WAIT_FAILED' });
  });
});

describe('node upgrade keeps the image', () => {
  it('finds the image from the node OS and the target plan', async () => {
    const upgradeNode = vi.fn(() =>
      Promise.resolve({ message: 'Upgrade started' })
    );

    const result = await service(fakeClient({ upgradeNode })).upgradeNode(
      '101',
      {
        force: true,
        plan: 'C3-4vCPU-8RAM'
      }
    );

    expect(upgradeNode).toHaveBeenCalledWith('101', {
      image: 'Ubuntu-24.04-Distro',
      plan: 'C3-4vCPU-8RAM'
    });
    expect(result).toMatchObject({ image_kept: true });
  });

  it('uses --image as given without looking anything up', async () => {
    const getNode = vi.fn<NodeClient['getNode']>();

    const result = await service(fakeClient({ getNode })).upgradeNode('101', {
      force: true,
      image: 'Rocky-9',
      plan: 'C3-4vCPU-8RAM'
    });

    expect(getNode).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      image_kept: false,
      requested: { image: 'Rocky-9' }
    });
  });

  const nodeWithoutOs = (): NodeDetails => {
    const { os_info: _osInfo, ...rest } = node();
    return rest;
  };

  it.each([
    [
      'an OS with no catalog row',
      node({
        os_info: { category: 'Linux Virtual Node', name: 'Arch', version: '1' }
      })
    ],
    ['a node with no OS information', nodeWithoutOs()]
  ])('fails closed for %s', async (_name, details) => {
    const error = await service(
      fakeClient({ getNode: () => Promise.resolve(details) })
    )
      .upgradeNode('101', { force: true, plan: 'C3-4vCPU-8RAM' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NODE_IMAGE_UNKNOWN' });
    expect((error as CliError).suggestion).toContain('--image');
  });

  it('fails closed when the plan is not offered for that image', async () => {
    const error = await service(fakeClient())
      .upgradeNode('101', { force: true, plan: 'not-a-plan' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NODE_IMAGE_UNKNOWN' });
    expect((error as CliError).suggestion).toContain(
      'node catalog plans --display-category "Linux Virtual Node"'
    );
  });

  it('asks before upgrading and says the image is kept', async () => {
    const confirm = vi.fn(() => Promise.resolve(false));
    const unused = (): never => {
      throw new Error('not used');
    };
    const interactiveService = new NodeService({
      confirm,
      createNodeClient: () => fakeClient(),
      createReservedIpClient: unused,
      createSecurityGroupClient: unused,
      createSshKeyClient: unused,
      createVolumeClient: unused,
      createVpcClient: unused,
      isInteractive: true,
      store: {
        configPath: '/tmp/c.json',
        read: () =>
          Promise.resolve({
            default: 'w',
            profiles: {
              w: {
                api_key: 'k',
                auth_token: 't',
                myaccount: { location: 'Delhi', project_id: '1' }
              }
            }
          })
      }
    });

    const result = await interactiveService.upgradeNode('101', {
      plan: 'C3-4vCPU-8RAM'
    });

    expect(confirm).toHaveBeenCalledWith(
      'Upgrade node 101 to plan C3-4vCPU-8RAM with image Ubuntu-24.04-Distro? This is disruptive.'
    );
    expect(result).toMatchObject({ cancelled: true, image_kept: true });
  });
});

describe('node catalog GPU rows and filters', () => {
  it('lists GPU rows once and skips groups without OS rows', () => {
    const entries = summarizeNodeCatalogOs(CATALOG);

    expect(
      entries.map(
        (entry) =>
          `${entry.display_category}|${entry.category}|${entry.os_version}`
      )
    ).toEqual(['GPU|Gpu|22.04', 'Linux Virtual Node|Ubuntu|24.04']);
  });

  const gpuPlans = [
    plan({
      gpu_card_details: { CARD_TYPE: 'Nvidia-T4', MEMORY: '16', UNIT_COUNT: 1 },
      name: 'T4',
      plan: 't4',
      specs: { cpu: 12, family: 'GPU', ram: '50.00' }
    }),
    plan({
      gpu_card_details: {
        CARD_TYPE: 'Nvidia-A100',
        MEMORY: '80',
        UNIT_COUNT: 2
      },
      name: 'A100',
      plan: 'a100',
      specs: { cpu: 32, family: 'GPU', ram: '230.00' }
    }),
    plan({ gpu_card_details: {}, name: 'CPU', plan: 'cpu' })
  ];

  it.each([
    ['T4', ['t4']],
    ['nvidia-t4', ['t4']],
    ['A100', ['a100']],
    ['H100', []]
  ])('matches --gpu-type %s', (gpuType, expected) => {
    const items = normalizeNodeCatalogPlanItems(gpuPlans, 'all', {
      gpu_type: gpuType
    });

    expect(items.map((item) => item.plan)).toEqual(expected);
  });

  it('keeps plans with at least --min-vcpu and --min-ram', () => {
    expect(
      normalizeNodeCatalogPlanItems(gpuPlans, 'all', {
        min_vcpu: 12,
        min_ram_gb: 100
      }).map((item) => item.plan)
    ).toEqual(['a100']);
  });

  it('summarizes the GPU on each item', () => {
    const [t4] = normalizeNodeCatalogPlanItems(gpuPlans, 'all', {
      gpu_type: 'T4'
    });

    expect(t4?.config.gpu).toEqual({
      count: 1,
      memory_gb: 16,
      type: 'Nvidia-T4'
    });
  });

  it('explains an empty result caused by the filters', () => {
    const filters = { min_vcpu: 999 };
    const items = normalizeNodeCatalogPlanItems(gpuPlans, 'all', filters);

    expect(
      summarizeNodeCatalogPlans(gpuPlans, items, 'all', filters).empty_reason
    ).toBe('no_filter_match');
  });

  it('checks the filter flags', () => {
    expect(
      normalizeNodeCatalogPlanFilters({
        gpuType: ' T4 ',
        minRam: '8',
        minVcpu: '4'
      })
    ).toEqual({ gpu_type: 'T4', min_ram_gb: 8, min_vcpu: 4 });
    expect(() => normalizeNodeCatalogPlanFilters({ minVcpu: 'four' })).toThrow(
      'Minimum vCPU must be numeric.'
    );
  });
});

describe('node commands for the additions', () => {
  async function run(client: NodeClient, args: string[]): Promise<string> {
    const store = new ConfigStore({
      configPath: createTestConfigPath('node-additions')
    });
    await store.upsertProfile('work', {
      api_key: 'k',
      auth_token: 't',
      myaccount: { location: 'Chennai', project_id: '1' }
    });
    const stdout = new MemoryWriter();
    await createProgram(
      createTestRuntime({ createNodeClient: () => client, stdout, store })
    ).parseAsync(['node', 'e2ectl', ...args]);
    return stdout.buffer;
  }

  it('prints reboot, protect and unprotect results', async () => {
    expect(
      await run(fakeClient(), ['myaccount', 'node', 'action', 'reboot', '101'])
    ).toContain('Requested reboot for node 101.');
    expect(
      await run(fakeClient(), ['myaccount', 'node', 'action', 'protect', '101'])
    ).toContain('Turned on deletion protection for node 101.');
    expect(
      JSON.parse(
        await run(fakeClient(), [
          '--json',
          'myaccount',
          'node',
          'action',
          'unprotect',
          '101'
        ])
      )
    ).toMatchObject({ action: 'unprotect', node_id: 101 });
  });

  it('shows the running node after create --wait, in text and JSON', async () => {
    const args = [
      'myaccount',
      'node',
      'create',
      '--name',
      'e2ectl-test-node',
      '--plan',
      'C3-4vCPU-8RAM',
      '--image',
      'Ubuntu-24.04-Distro',
      '--wait'
    ];

    expect(await run(fakeClient(), args)).toContain('Node 101 is running.');
    expect(
      JSON.parse(await run(fakeClient(), ['--json', ...args]))
    ).toMatchObject({
      node: { id: 101, status: 'Running' }
    });
  });

  it('explains in text when the plan filters match nothing', async () => {
    const output = await run(fakeClient(), [
      'myaccount',
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
      '--gpu-type',
      'H100',
      '--min-vcpu',
      '4',
      '--min-ram',
      '8'
    ]);

    expect(output).toContain('GPU=H100');
    expect(output).toContain('vCPU>=4');
    expect(output).toContain('RAM>=8 GB');
    expect(output).toContain(
      'No configs match the --gpu-type, --min-vcpu and --min-ram filters.'
    );
  });

  it('shows deletion protection in node get', async () => {
    expect(
      await run(
        fakeClient({
          getNode: () =>
            Promise.resolve(node({ is_accidental_protection: true }))
        }),
        ['myaccount', 'node', 'get', '101']
      )
    ).toContain('Deletion Protection: on');
  });

  it('marks a kept image in the upgrade output', async () => {
    expect(
      await run(fakeClient(), [
        'myaccount',
        'node',
        'upgrade',
        '101',
        '--plan',
        'C3-4vCPU-8RAM',
        '--force'
      ])
    ).toContain('Target Image: Ubuntu-24.04-Distro (kept from the node)');
  });
});
