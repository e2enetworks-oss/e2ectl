import {
  createNodeStep,
  runDnsSteps,
  runNodeDeleteSteps,
  runNodeLifecycleActionSteps,
  runSecurityGroupSteps,
  runSshKeyDeleteStep,
  runSshKeyCreateAndAttachSteps,
  runAddonReservedIpSteps,
  runVolumeSteps,
  runVpcSteps
} from '../../manual/helpers/smoke-steps.js';
import {
  discoverAvailableVolumeSize,
  runJsonCommand,
  waitForNodeReadiness,
  waitForNodeStatus,
  waitForVolumeStatus
} from '../../manual/helpers/smoke-commands.js';
import type { SmokeManifest } from '../../manual/helpers/smoke-manifest.js';
import { updateSmokeManifest } from '../../manual/helpers/smoke-manifest.js';

vi.mock('../../manual/helpers/smoke-commands.js', () => ({
  discoverAvailableVolumeSize: vi.fn(),
  runJsonCommand: vi.fn(),
  waitForNodeReadiness: vi.fn(),
  waitForNodeStatus: vi.fn(),
  waitForVolumeStatus: vi.fn()
}));

vi.mock('../../manual/helpers/smoke-manifest.js', () => ({
  updateSmokeManifest: vi.fn()
}));

const discoverAvailableVolumeSizeMock = vi.mocked(discoverAvailableVolumeSize);
const runJsonCommandMock = vi.mocked(runJsonCommand);
const updateSmokeManifestMock = vi.mocked(updateSmokeManifest);
const waitForNodeReadinessMock = vi.mocked(waitForNodeReadiness);
const waitForNodeStatusMock = vi.mocked(waitForNodeStatus);
const waitForVolumeStatusMock = vi.mocked(waitForVolumeStatus);

describe('manual smoke step helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a node and stores its manifest id before waiting for readiness', async () => {
    const { context, manifest } = createFixture();

    runJsonCommandMock.mockResolvedValueOnce({
      action: 'create',
      nodes: [
        {
          id: 101
        }
      ]
    });
    waitForNodeReadinessMock.mockResolvedValueOnce({
      action: 'get',
      node: {
        id: 101,
        public_ip_address: null,
        status: 'Running'
      }
    });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    const result = await createNodeStep(context, {
      nodeName: 'release-smoke-node'
    });

    expect(result).toEqual({
      nodeId: 101
    });
    expect(runJsonCommandMock).toHaveBeenCalledWith(
      [
        'node',
        'create',
        '--name',
        'release-smoke-node',
        '--plan',
        'C3.8GB',
        '--image',
        'Ubuntu-24.04-Distro'
      ],
      context.smokeEnv
    );
    expect(waitForNodeReadinessMock).toHaveBeenCalledWith(
      101,
      context.smokeEnv,
      {
        requirePublicIp: false
      }
    );
    expect(manifest.node_id).toBe(101);
  });

  it('creates, updates, attaches, and detaches a security group with manifest transitions', async () => {
    const { context, manifest } = createFixture();

    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'create',
        security_group: {
          id: 88
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        security_group: {
          id: 88,
          rules: []
        }
      })
      .mockResolvedValueOnce({
        action: 'update',
        security_group: {
          id: 88,
          name: 'release-smoke-sg-updated',
          rule_count: 3
        }
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    const result = await runSecurityGroupSteps(context, {
      nodeId: 101,
      rulesFilePath: '/tmp/security-group-rules.json',
      securityGroupName: 'release-smoke-sg',
      updatedSecurityGroupName: 'release-smoke-sg-updated'
    });

    expect(result).toEqual({
      securityGroupId: 88
    });
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      4,
      [
        'node',
        'action',
        'security-group',
        'attach',
        '101',
        '--security-group-id',
        '88'
      ],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      5,
      [
        'node',
        'action',
        'security-group',
        'detach',
        '101',
        '--security-group-id',
        '88'
      ],
      context.smokeEnv
    );
    expect(manifest.security_group_id).toBe(88);
    expect(manifest.security_group_attached_node_id).toBeNull();
  });

  it('creates, gets, attaches, detaches, and deletes an addon reserved ip', async () => {
    const { context, manifest } = createFixture();

    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'create',
        reserved_ip: {
          ip_address: '203.0.113.20'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        reserved_ip: {
          ip_address: '203.0.113.20'
        }
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    await runAddonReservedIpSteps(context, {
      nodeId: 101
    });

    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      3,
      ['reserved-ip', 'attach', 'node', '203.0.113.20', '--node-id', '101'],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      4,
      ['reserved-ip', 'detach', 'node', '203.0.113.20', '--node-id', '101'],
      context.smokeEnv
    );
    expect(manifest.addon_reserved_ip).toBe('203.0.113.20');
    expect(manifest.addon_reserved_ip_attached_node_id).toBeNull();
    expect(manifest.addon_reserved_ip_deleted).toBe(true);
  });

  it('runs volume create, attach, detach, and delete steps with manifest transitions', async () => {
    const { context, manifest } = createFixture();

    discoverAvailableVolumeSizeMock.mockResolvedValue(50);
    waitForVolumeStatusMock
      .mockResolvedValueOnce({
        action: 'get',
        volume: {
          id: 8801,
          status: 'Available'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        volume: {
          id: 8801,
          status: 'Attached'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        volume: {
          id: 8801,
          status: 'Available'
        }
      });
    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'create',
        volume: {
          id: 8801
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        volume: {
          id: 8801
        }
      })
      .mockResolvedValueOnce({
        action: 'volume-attach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'attached'
        },
        volume: {
          id: 8801
        }
      })
      .mockResolvedValueOnce({
        action: 'volume-detach',
        node_id: 101,
        node_vm_id: 100157,
        result: {
          message: 'detached'
        },
        volume: {
          id: 8801
        }
      })
      .mockResolvedValueOnce({
        action: 'delete',
        volume_id: 8801
      });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    const result = await runVolumeSteps(context, {
      nodeId: 101,
      volumeName: 'release-smoke-volume'
    });

    expect(result).toEqual({
      volumeId: 8801
    });
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      1,
      [
        'volume',
        'create',
        '--name',
        'release-smoke-volume',
        '--size',
        '50',
        '--billing-type',
        'hourly'
      ],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      3,
      ['node', 'action', 'volume', 'attach', '101', '--volume-id', '8801'],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      4,
      ['node', 'action', 'volume', 'detach', '101', '--volume-id', '8801'],
      context.smokeEnv
    );
    expect(waitForVolumeStatusMock).toHaveBeenNthCalledWith(
      1,
      8801,
      context.smokeEnv,
      {
        acceptedStatuses: ['Available'],
        description: 'Available'
      }
    );
    expect(waitForVolumeStatusMock).toHaveBeenNthCalledWith(
      2,
      8801,
      context.smokeEnv,
      {
        acceptedStatuses: ['Attached'],
        description: 'Attached'
      }
    );
    expect(waitForVolumeStatusMock).toHaveBeenNthCalledWith(
      3,
      8801,
      context.smokeEnv,
      {
        acceptedStatuses: ['Available'],
        description: 'Available'
      }
    );
    expect(manifest.volume_id).toBe(8801);
    expect(manifest.volume_attached_node_id).toBeNull();
    expect(manifest.volume_deleted).toBe(true);
  });

  it('runs VPC create, attach, detach, and delete steps with manifest transitions', async () => {
    const { context, manifest } = createFixture();

    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'create',
        vpc: {
          id: 23082
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        vpc: {
          id: 23082
        }
      })
      .mockResolvedValueOnce({
        action: 'vpc-attach',
        node_id: 101,
        result: {
          message: 'attached',
          project_id: '46429'
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: null,
          subnet_id: null
        }
      })
      .mockResolvedValueOnce({
        action: 'vpc-detach',
        node_id: 101,
        result: {
          message: 'detached',
          project_id: '46429'
        },
        vpc: {
          id: 23082,
          name: 'prod-vpc',
          private_ip: null,
          subnet_id: null
        }
      })
      .mockResolvedValueOnce({
        action: 'delete',
        vpc: {
          id: 23082
        }
      });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    const result = await runVpcSteps(context, {
      nodeId: 101,
      vpcName: 'release-smoke-vpc'
    });

    expect(result).toEqual({
      vpcId: 23082
    });
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      3,
      ['node', 'action', 'vpc', 'attach', '101', '--vpc-id', '23082'],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      4,
      ['node', 'action', 'vpc', 'detach', '101', '--vpc-id', '23082'],
      context.smokeEnv
    );
    expect(manifest.vpc_id).toBe(23082);
    expect(manifest.vpc_attached_node_id).toBeNull();
    expect(manifest.vpc_deleted).toBe(true);
  });

  it('creates and attaches an SSH key before recording the attached node id', async () => {
    const { context, manifest } = createFixture();

    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'create',
        item: {
          id: 12
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        item: {
          id: 12
        }
      })
      .mockResolvedValueOnce({
        action: 'ssh-key-attach',
        node_id: 101,
        result: {
          action_id: 801,
          created_at: '2026-03-14T08:00:00Z',
          image_id: null,
          status: 'Done'
        },
        ssh_keys: [
          {
            id: 12,
            label: 'manual-read-only'
          }
        ]
      });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    const result = await runSshKeyCreateAndAttachSteps(context, {
      nodeId: 101,
      sshKeyLabel: 'release-smoke-ssh'
    });

    expect(result).toEqual({
      sshKeyId: 12
    });
    expect(runJsonCommandMock.mock.calls[0]?.[2]).toMatchObject({
      stdin: expect.stringContaining('ssh-ed25519')
    });
    expect(manifest.ssh_key_id).toBe(12);
    expect(manifest.ssh_key_attached_node_id).toBe(101);
  });

  it('powers a node, saves an image, and upgrades it while recording saved image cleanup state', async () => {
    const { context, manifest } = createFixture();

    waitForNodeReadinessMock
      .mockResolvedValueOnce({
        action: 'get',
        node: {
          id: 101,
          public_ip_address: '203.0.113.10',
          status: 'Running'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        node: {
          id: 101,
          public_ip_address: '203.0.113.11',
          status: 'Running'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        node: {
          id: 101,
          public_ip_address: '203.0.113.11',
          status: 'Running'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        node: {
          id: 101,
          public_ip_address: '203.0.113.12',
          status: 'Running'
        }
      });
    waitForNodeStatusMock.mockResolvedValueOnce({
      action: 'get',
      node: {
        id: 101,
        public_ip_address: null,
        status: 'Powered Off'
      }
    });
    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'power-off',
        node_id: 101,
        result: {
          action_id: 701,
          created_at: '2026-03-14T08:10:00Z',
          image_id: null,
          status: 'In Progress'
        }
      })
      .mockResolvedValueOnce({
        action: 'power-on',
        node_id: 101,
        result: {
          action_id: 702,
          created_at: '2026-03-14T08:15:00Z',
          image_id: null,
          status: 'In Progress'
        }
      })
      .mockResolvedValueOnce({
        action: 'save-image',
        image_name: 'release-smoke-image',
        node_id: 101,
        result: {
          action_id: 703,
          created_at: '2026-03-14T08:20:00Z',
          image_id: 'img-455',
          status: 'In Progress'
        }
      })
      .mockResolvedValueOnce({
        action: 'upgrade',
        details: {
          location: 'Delhi',
          new_node_image_id: 8802,
          old_node_image_id: 8801,
          vm_id: 100157
        },
        message: 'Node upgrade initiated',
        node_id: 101,
        requested: {
          image: 'Ubuntu-24.04-Distro',
          plan: 'C3.16GB'
        }
      });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    const result = await runNodeLifecycleActionSteps(context, {
      nodeId: 101,
      saveImageName: 'release-smoke-image'
    });

    expect(result).toEqual({
      publicIp: '203.0.113.12'
    });
    expect(waitForNodeStatusMock).toHaveBeenCalledWith(101, context.smokeEnv, {
      acceptedStatuses: ['Powered Off', 'Stopped'],
      description: 'Powered Off or Stopped'
    });
    expect(waitForNodeReadinessMock).toHaveBeenNthCalledWith(
      3,
      101,
      context.smokeEnv,
      {
        requirePublicIp: false
      }
    );
    expect(waitForNodeReadinessMock).toHaveBeenNthCalledWith(
      4,
      101,
      context.smokeEnv,
      {
        requirePublicIp: true
      }
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      3,
      ['node', 'action', 'save-image', '101', '--name', 'release-smoke-image'],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      4,
      [
        'node',
        'upgrade',
        '101',
        '--plan',
        'C3.16GB',
        '--image',
        'Ubuntu-24.04-Distro',
        '--force'
      ],
      context.smokeEnv
    );
    expect(manifest.saved_image_deleted).toBe(false);
    expect(manifest.saved_image_id).toBe('img-455');
  });

  it('reserves a node public ip, deletes the node, and deletes the preserved reserved ip', async () => {
    const { context, manifest } = createFixture();

    waitForNodeReadinessMock.mockResolvedValueOnce({
      action: 'get',
      node: {
        id: 101,
        public_ip_address: '203.0.113.10',
        status: 'Running'
      }
    });
    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'reserve-node',
        ip_address: '203.0.113.21'
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        action: 'get',
        reserved_ip: {
          ip_address: '203.0.113.21'
        }
      })
      .mockResolvedValueOnce({});
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    await runNodeDeleteSteps(context, {
      nodeId: 101
    });

    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      1,
      ['reserved-ip', 'reserve', 'node', '101'],
      context.smokeEnv
    );
    expect(runJsonCommandMock).toHaveBeenNthCalledWith(
      2,
      ['node', 'delete', '101', '--force'],
      context.smokeEnv
    );
    expect(manifest.preserved_reserved_ip).toBe('203.0.113.21');
    expect(manifest.node_deleted).toBe(true);
    expect(manifest.preserved_reserved_ip_deleted).toBe(true);
    expect(manifest.security_group_attached_node_id).toBeNull();
    expect(manifest.ssh_key_attached_node_id).toBeNull();
  });

  it('creates and deletes a disposable DNS zone while tracking record mutations for cleanup replay', async () => {
    const { context, manifest } = createFixture();

    runJsonCommandMock
      .mockResolvedValueOnce({
        action: 'create',
        domain: {
          id: 10279
        },
        message: 'created',
        requested: {
          domain_name: 'disposable.example.net',
          ip_address: '203.0.113.12'
        }
      })
      .mockResolvedValueOnce({
        action: 'get',
        domain: {
          domain_name: 'disposable.example.net.',
          records: []
        }
      })
      .mockResolvedValueOnce({
        action: 'delete',
        cancelled: false,
        domain_name: 'disposable.example.net.',
        message: 'deleted'
      })
      .mockResolvedValueOnce({
        action: 'record-create',
        domain_name: 'release.example.com',
        record: {
          name: 'release-smoke',
          type: 'A',
          value: '203.0.113.10'
        }
      })
      .mockResolvedValueOnce({
        action: 'record-list',
        items: [
          {
            name: 'release-smoke',
            type: 'A',
            value: '203.0.113.10'
          }
        ]
      })
      .mockResolvedValueOnce({
        action: 'record-update',
        record: {
          current_value: '203.0.113.10',
          name: 'release-smoke',
          new_value: '203.0.113.11',
          type: 'A'
        }
      })
      .mockResolvedValueOnce({
        action: 'record-delete',
        cancelled: false
      });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    await runDnsSteps(context, {
      createIpAddress: '203.0.113.12',
      dnsRecordHost: 'release-smoke',
      initialRecordValue: '203.0.113.10',
      updatedRecordValue: '203.0.113.11'
    });

    expect(manifest.created_dns_domain).toBe('disposable.example.net');
    expect(manifest.created_dns_domain_deleted).toBe(true);
    expect(manifest.created_dns_domain_id).toBe(10279);
    expect(manifest.dns_records).toEqual([
      {
        current_value: '203.0.113.11',
        deleted: true,
        domain_name: 'release.example.com',
        name: 'release-smoke',
        type: 'A'
      }
    ]);
  });

  it('deletes an SSH key and clears the attached node id in the manifest', async () => {
    const { context, manifest } = createFixture();

    manifest.ssh_key_id = 12;
    manifest.ssh_key_attached_node_id = 101;
    runJsonCommandMock.mockResolvedValueOnce({
      action: 'delete',
      id: 12
    });
    updateSmokeManifestMock.mockImplementation((_path, mutate) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    });

    await runSshKeyDeleteStep(context, {
      sshKeyId: 12
    });

    expect(runJsonCommandMock).toHaveBeenCalledWith(
      ['ssh-key', 'delete', '12', '--force'],
      context.smokeEnv
    );
    expect(manifest.ssh_key_attached_node_id).toBeNull();
    expect(manifest.ssh_key_deleted).toBe(true);
  });
});

function createFixture() {
  const manifest: SmokeManifest = {
    addon_reserved_ip: null,
    addon_reserved_ip_attached_node_id: null,
    addon_reserved_ip_deleted: false,
    created_dns_domain: null,
    created_dns_domain_deleted: false,
    created_dns_domain_id: null,
    created_at: '2026-04-05T00:00:00.000Z',
    dns_domain: 'release.example.com',
    dns_records: [],
    node_deleted: false,
    node_id: 101,
    prefix: 'release-smoke',
    preserved_reserved_ip: null,
    preserved_reserved_ip_deleted: false,
    saved_image_deleted: false,
    saved_image_id: null,
    security_group_attached_node_id: null,
    security_group_deleted: false,
    security_group_id: null,
    ssh_key_attached_node_id: null,
    ssh_key_deleted: false,
    ssh_key_id: null,
    temp_rules_file_path: '/tmp/release-smoke-rules.json',
    updated_at: '2026-04-05T00:00:00.000Z',
    version: 1 as const,
    volume_attached_node_id: null,
    volume_deleted: false,
    volume_id: null,
    vpc_attached_node_id: null,
    vpc_deleted: false,
    vpc_id: null
  };
  const context = {
    manifestPath: '/tmp/manual-smoke.json',
    smokeEnv: {
      apiKey: 'smoke-api-key',
      authToken: 'smoke-auth-token',
      cliEnv: {},
      dnsCreateDomain: 'disposable.example.net',
      dnsDomain: 'release.example.com',
      location: 'Delhi',
      nodeImage: 'Ubuntu-24.04-Distro',
      nodePlan: 'C3.8GB',
      prefix: 'release-smoke',
      projectId: '46429',
      recordTtl: '300',
      upgradeImage: 'Ubuntu-24.04-Distro',
      upgradePlan: 'C3.16GB'
    }
  };

  return {
    context,
    manifest
  };
}
