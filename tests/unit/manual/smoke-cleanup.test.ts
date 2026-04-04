import { runSmokeCleanup } from '../../../scripts/helpers/manual-smoke-cleanup.mjs';

describe('manual smoke cleanup orchestration', () => {
  it('runs cleanup in the expected order across the expanded smoke resource set', async () => {
    const manifest = createManifestFixture();
    const events: string[] = [];

    const result = await runSmokeCleanup(
      createCleanupContext(manifest, {
        deleteSavedImage: (imageId) => {
          events.push(`image:${imageId}`);
          return Promise.resolve();
        },
        removeFile: (filePath) => {
          events.push(`file:${filePath}`);
          return Promise.resolve();
        },
        runCliCleanup: (args) => {
          events.push(`cli:${args.join(' ')}`);
          return Promise.resolve({
            status: 'ok' as const
          });
        }
      })
    );

    expect(result.hadFailures).toBe(false);
    expect(events).toEqual([
      'cli:dns record delete release.example.com --type A --name release-smoke --value 203.0.113.11 --force',
      'cli:dns delete disposable.example.net --force',
      'cli:reserved-ip detach node 203.0.113.20 --node-id 101',
      'cli:node action volume detach 101 --volume-id 8801',
      'cli:node action vpc detach 101 --vpc-id 23082',
      'cli:node delete 101 --force',
      'cli:reserved-ip delete 203.0.113.20 --force',
      'cli:reserved-ip delete 203.0.113.21 --force',
      'cli:volume delete 8801 --force',
      'cli:vpc delete 23082 --force',
      'image:img-455',
      'cli:ssh-key delete 12 --force',
      'cli:security-group delete 88 --force',
      'file:/tmp/release-smoke-rules.json'
    ]);
    expect(manifest.dns_records[0]?.deleted).toBe(true);
    expect(manifest.created_dns_domain_deleted).toBe(true);
    expect(manifest.addon_reserved_ip_attached_node_id).toBeNull();
    expect(manifest.volume_attached_node_id).toBeNull();
    expect(manifest.vpc_attached_node_id).toBeNull();
    expect(manifest.node_deleted).toBe(true);
    expect(manifest.addon_reserved_ip_deleted).toBe(true);
    expect(manifest.preserved_reserved_ip_deleted).toBe(true);
    expect(manifest.volume_deleted).toBe(true);
    expect(manifest.vpc_deleted).toBe(true);
    expect(manifest.saved_image_deleted).toBe(true);
    expect(manifest.ssh_key_deleted).toBe(true);
    expect(manifest.security_group_deleted).toBe(true);
    expect(manifest.temp_rules_file_path).toBeNull();
  });

  it('treats already-gone cleanup branches as successful for CLI, saved-image, and temp-file cleanup', async () => {
    const manifest = createManifestFixture();

    const result = await runSmokeCleanup(
      createCleanupContext(manifest, {
        deleteSavedImage: () =>
          Promise.reject(new Error('Saved image not found.')),
        removeFile: () =>
          Promise.reject(
            Object.assign(new Error('missing'), {
              code: 'ENOENT'
            })
          ),
        runCliCleanup: () =>
          Promise.resolve({
            status: 'already-gone' as const
          })
      })
    );

    expect(result.hadFailures).toBe(false);
    expect(manifest.created_dns_domain_deleted).toBe(true);
    expect(manifest.node_deleted).toBe(true);
    expect(manifest.saved_image_deleted).toBe(true);
    expect(manifest.ssh_key_deleted).toBe(true);
    expect(manifest.temp_rules_file_path).toBeNull();
  });

  it('falls back to direct clients for cleanup-only branches when CLI cleanup is retryable', async () => {
    const manifest = createManifestFixture();
    const clients = {
      dns: {
        deleteDomain: vi.fn(() => Promise.resolve()),
        deleteRecord: vi.fn(() => Promise.resolve())
      },
      node: {
        deleteNode: vi.fn(() => Promise.resolve()),
        getNode: vi.fn(() =>
          Promise.resolve({
            vm_id: 100157
          })
        )
      },
      reservedIp: {
        deleteReservedIp: vi.fn(() => Promise.resolve()),
        detachReservedIpFromNode: vi.fn(() => Promise.resolve()),
        listReservedIps: vi.fn(() =>
          Promise.resolve([
            {
              ip_address: '203.0.113.20',
              vm_id: 100157
            },
            {
              ip_address: '203.0.113.21',
              vm_id: null
            }
          ])
        )
      },
      securityGroup: {
        deleteSecurityGroup: vi.fn(() => Promise.resolve())
      },
      sshKey: {
        deleteSshKey: vi.fn(() => Promise.resolve())
      },
      volume: {
        deleteVolume: vi.fn(() => Promise.resolve()),
        detachVolumeFromNode: vi.fn(() => Promise.resolve()),
        getVolume: vi.fn(() =>
          Promise.resolve({
            status: 'Available'
          })
        )
      },
      vpc: {
        deleteVpc: vi.fn(() => Promise.resolve()),
        detachNodeVpc: vi.fn(() => Promise.resolve())
      }
    };

    const result = await runSmokeCleanup(
      createCleanupContext(manifest, {
        deleteSavedImage: () => Promise.resolve(),
        getFallbackClients: () => Promise.resolve(clients),
        removeFile: () => Promise.resolve(),
        runCliCleanup: () =>
          Promise.resolve({
            status: 'retryable' as const
          })
      })
    );

    expect(result.hadFailures).toBe(false);
    expect(clients.dns.deleteRecord).toHaveBeenCalled();
    expect(clients.dns.deleteDomain).toHaveBeenCalledWith(10279);
    expect(clients.reservedIp.detachReservedIpFromNode).toHaveBeenCalled();
    expect(clients.node.deleteNode).toHaveBeenCalledWith('101');
    expect(clients.volume.detachVolumeFromNode).toHaveBeenCalledWith(8801, {
      vm_id: 100157
    });
    expect(clients.vpc.detachNodeVpc).toHaveBeenCalledWith({
      action: 'detach',
      network_id: 23082,
      node_id: 101
    });
    expect(clients.volume.getVolume).toHaveBeenCalledWith(8801);
    expect(clients.volume.deleteVolume).toHaveBeenCalledWith(8801);
    expect(clients.vpc.deleteVpc).toHaveBeenCalledWith(23082);
    expect(clients.sshKey.deleteSshKey).toHaveBeenCalledWith(12);
    expect(clients.securityGroup.deleteSecurityGroup).toHaveBeenCalledWith(88);
    expect(manifest.saved_image_deleted).toBe(true);
  });
});

function createCleanupContext(
  manifest: ReturnType<typeof createManifestFixture>,
  overrides: {
    deleteSavedImage?: (imageId: string) => Promise<void>;
    getFallbackClients?: () => Promise<Record<string, unknown>>;
    removeFile?: (filePath: string) => Promise<void>;
    runCliCleanup?: (
      args: string[]
    ) => Promise<{ status: 'already-gone' | 'ok' | 'retryable' }>;
  } = {}
) {
  return {
    deleteSavedImage: overrides.deleteSavedImage ?? (() => Promise.resolve()),
    getFallbackClients: vi.fn(
      overrides.getFallbackClients ??
        (() =>
          Promise.reject(
            new Error('Fallback clients should not be needed for this test.')
          ))
    ),
    loadManifest: vi.fn(() => Promise.resolve(manifest)),
    logError: vi.fn(),
    logInfo: vi.fn(),
    removeFile: overrides.removeFile ?? (() => Promise.resolve()),
    runCliCleanup:
      overrides.runCliCleanup ??
      (() =>
        Promise.resolve({
          status: 'ok' as const
        })),
    updateManifest: vi.fn((mutate: (draft: typeof manifest) => void) => {
      mutate(manifest);
      return Promise.resolve(manifest);
    })
  };
}

function createManifestFixture() {
  return {
    addon_reserved_ip: '203.0.113.20',
    addon_reserved_ip_attached_node_id: 101,
    addon_reserved_ip_deleted: false,
    created_dns_domain: 'disposable.example.net',
    created_dns_domain_deleted: false,
    created_dns_domain_id: 10279,
    created_at: '2026-04-05T00:00:00.000Z',
    dns_domain: 'release.example.com',
    dns_records: [
      {
        current_value: '203.0.113.11',
        deleted: false,
        domain_name: 'release.example.com',
        name: 'release-smoke',
        type: 'A'
      }
    ],
    node_deleted: false,
    node_id: 101,
    prefix: 'release-smoke',
    preserved_reserved_ip: '203.0.113.21',
    preserved_reserved_ip_deleted: false,
    saved_image_deleted: false,
    saved_image_id: 'img-455',
    security_group_attached_node_id: 101,
    security_group_deleted: false,
    security_group_id: 88,
    ssh_key_attached_node_id: 101,
    ssh_key_deleted: false,
    ssh_key_id: 12,
    temp_rules_file_path: '/tmp/release-smoke-rules.json',
    updated_at: '2026-04-05T00:00:00.000Z',
    version: 1 as const,
    volume_attached_node_id: 101,
    volume_deleted: false,
    volume_id: 8801,
    vpc_attached_node_id: 101,
    vpc_deleted: false,
    vpc_id: 23082
  };
}
