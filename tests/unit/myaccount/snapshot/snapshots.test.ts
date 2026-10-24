import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type { NodeClient } from '../../../../src/myaccount/node/index.js';
import {
  formatSnapshotTable,
  toSnapshotItem,
  type SnapshotApiItem
} from '../../../../src/myaccount/snapshot/index.js';
import type { VolumeClient } from '../../../../src/myaccount/volume/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const API_SNAPSHOT: SnapshotApiItem = {
  date: '25-10-2026 10:00',
  is_locked: false,
  name: 'before-upgrade',
  snapshot_id: '7',
  snapshot_size: '1.5',
  snapshot_uuid: '901',
  status: 'Ready'
};

function nodeMocks() {
  return {
    createSnapshot: vi.fn(() =>
      Promise.resolve({ message: 'Snapshot creation is in progress.' })
    ),
    deleteSnapshot: vi.fn(() => Promise.resolve({ message: 'OK' })),
    listSnapshots: vi.fn(() => Promise.resolve([API_SNAPSHOT])),
    saveSnapshotAsImage: vi.fn(() => Promise.resolve({ message: 'OK' }))
  };
}

function nodeClient(mocks = nodeMocks()): NodeClient {
  return mocks as unknown as NodeClient;
}

function volumeMocks(attachedVmId: number | undefined) {
  return {
    createSnapshot: vi.fn(() =>
      Promise.resolve({ message: 'Snapshot in process.' })
    ),
    deleteSnapshot: vi.fn(() => Promise.resolve({ message: 'OK' })),
    getVolume: vi.fn(() =>
      Promise.resolve({
        block_id: 5,
        name: 'data',
        size: 250,
        status: 'Attached',
        ...(attachedVmId === undefined
          ? {}
          : { vm_detail: { vm_id: attachedVmId } })
      })
    ),
    listSnapshots: vi.fn(() => Promise.resolve([API_SNAPSHOT])),
    saveSnapshotAsVolume: vi.fn(() => Promise.resolve({ message: 'OK' }))
  };
}

function volumeClient(mocks: ReturnType<typeof volumeMocks>): VolumeClient {
  return mocks as unknown as VolumeClient;
}

async function run(
  args: string[],
  clients: { node?: NodeClient; volume?: VolumeClient },
  confirmAnswer?: boolean
): Promise<string> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('snapshots')
  });
  await store.upsertProfile('work', {
    api_key: 'k',
    auth_token: 't',
    default_location: 'Chennai',
    default_project_id: '1'
  });
  const stdout = new MemoryWriter();
  await createProgram(
    createTestRuntime({
      confirm: () => Promise.resolve(confirmAnswer ?? false),
      ...(clients.node === undefined
        ? {}
        : { createNodeClient: () => clients.node as NodeClient }),
      ...(clients.volume === undefined
        ? {}
        : { createVolumeClient: () => clients.volume as VolumeClient }),
      isInteractive: confirmAnswer !== undefined,
      stdout,
      store
    })
  ).parseAsync(['node', 'e2ectl', ...args]);
  return stdout.buffer;
}

describe('shared snapshot items', () => {
  it('uses the id each resource is addressed by', () => {
    expect(toSnapshotItem(API_SNAPSHOT, 'snapshot_uuid')).toEqual({
      created_at: '25-10-2026 10:00',
      id: '901',
      locked: false,
      name: 'before-upgrade',
      size_gb: 1.5,
      status: 'Ready'
    });
    expect(toSnapshotItem(API_SNAPSHOT, 'snapshot_id').id).toBe('7');
  });

  it('says so when there are no snapshots', () => {
    expect(formatSnapshotTable([])).toBe('No snapshots found.');
  });
});

describe('node snapshots', () => {
  it('lists them by snapshot_uuid, in text and JSON', async () => {
    expect(
      await run(['myaccount', 'node', 'snapshot', 'list', '101'], {
        node: nodeClient()
      })
    ).toContain('before-upgrade');
    expect(
      JSON.parse(
        await run(['--json', 'myaccount', 'node', 'snapshot', 'list', '101'], {
          node: nodeClient()
        })
      )
    ).toMatchObject({
      action: 'snapshot-list',
      items: [{ id: '901' }],
      node_id: 101
    });
  });

  it('creates one and points at snapshot list', async () => {
    const mocks = nodeMocks();
    const client = nodeClient(mocks);

    const output = await run(
      [
        'myaccount',
        'node',
        'snapshot',
        'create',
        '101',
        '--name',
        'before-upgrade'
      ],
      { node: client }
    );

    expect(mocks.createSnapshot).toHaveBeenCalledWith('101', 'before-upgrade');
    expect(output).toContain('node snapshot list 101');
  });

  it('asks before deleting, and --force skips the question', async () => {
    const mocks = nodeMocks();
    const client = nodeClient(mocks);

    expect(
      await run(
        ['myaccount', 'node', 'snapshot', 'delete', '101', '901'],
        { node: client },
        false
      )
    ).toBe('Snapshot deletion cancelled.\n');
    expect(mocks.deleteSnapshot).not.toHaveBeenCalled();

    await run(
      ['myaccount', 'node', 'snapshot', 'delete', '101', '901', '--force'],
      { node: client }
    );
    expect(mocks.deleteSnapshot).toHaveBeenCalledWith('101', '901');
  });

  it('refuses to delete without a terminal or --force', async () => {
    await expect(
      run(['myaccount', 'node', 'snapshot', 'delete', '101', '901'], {
        node: nodeClient()
      })
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  });

  it('saves one as an image without touching the node', async () => {
    const mocks = nodeMocks();
    const client = nodeClient(mocks);

    const output = await run(
      [
        'myaccount',
        'node',
        'snapshot',
        'save-image',
        '101',
        '901',
        '--name',
        'restored'
      ],
      { node: client }
    );

    expect(mocks.saveSnapshotAsImage).toHaveBeenCalledWith(
      '101',
      '901',
      'restored'
    );
    expect(output).toContain('The node is not changed.');
    expect(output).toContain('--saved-image-template-id');
  });

  it('refuses a non-numeric snapshot id', async () => {
    await expect(
      run(
        ['myaccount', 'node', 'snapshot', 'delete', '101', 'abc', '--force'],
        { node: nodeClient() }
      )
    ).rejects.toMatchObject({ code: 'INVALID_SNAPSHOT_ID' });
  });
});

describe('volume snapshots', () => {
  it('lists them by snapshot_id after checking the volume exists', async () => {
    const mocks = volumeMocks(9);
    const client = volumeClient(mocks);

    const output = JSON.parse(
      await run(['--json', 'myaccount', 'volume', 'snapshot', 'list', '5'], {
        volume: client
      })
    ) as unknown;

    expect(mocks.getVolume).toHaveBeenCalledWith(5);
    expect(output).toMatchObject({
      action: 'snapshot-list',
      items: [{ id: '7' }],
      volume_id: 5
    });
  });

  it('creates one when the volume is attached', async () => {
    const mocks = volumeMocks(9);
    const client = volumeClient(mocks);

    await run(
      ['myaccount', 'volume', 'snapshot', 'create', '5', '--name', 'nightly'],
      { volume: client }
    );

    expect(mocks.createSnapshot).toHaveBeenCalledWith(5, 'nightly');
  });

  it('says to attach the volume first when it is not attached', async () => {
    await expect(
      run(
        ['myaccount', 'volume', 'snapshot', 'create', '5', '--name', 'nightly'],
        {
          volume: volumeClient(volumeMocks(undefined))
        }
      )
    ).rejects.toMatchObject({
      code: 'VOLUME_NOT_ATTACHED',
      suggestion: expect.stringContaining(
        'node action volume attach <node-id> --volume-id 5'
      ) as string
    });
  });

  it('saves one as a new volume through the attached node', async () => {
    const mocks = volumeMocks(9);
    const client = volumeClient(mocks);

    const output = await run(
      [
        'myaccount',
        'volume',
        'snapshot',
        'save-volume',
        '5',
        '7',
        '--name',
        'copy'
      ],
      { volume: client }
    );

    expect(mocks.saveSnapshotAsVolume).toHaveBeenCalledWith(5, {
      name: 'copy',
      snapshot_id: 7,
      vm_id: 9
    });
    expect(output).toContain('The volume itself is not changed.');
  });

  it('deletes one with --force', async () => {
    const mocks = volumeMocks(9);
    const client = volumeClient(mocks);

    expect(
      JSON.parse(
        await run(
          [
            '--json',
            'myaccount',
            'volume',
            'snapshot',
            'delete',
            '5',
            '7',
            '--force'
          ],
          {
            volume: client
          }
        )
      )
    ).toMatchObject({
      action: 'snapshot-delete',
      cancelled: false,
      snapshot_id: '7'
    });
  });
});
