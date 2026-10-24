import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type { VolumeClient } from '../../../../src/myaccount/volume/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

function volumeMocks(volume: { size_string: string; vm_id?: number }) {
  return {
    getVolume: vi.fn(() =>
      Promise.resolve({
        block_id: 5,
        name: 'data',
        size: 100,
        size_string: volume.size_string,
        status: 'Attached',
        ...(volume.vm_id === undefined
          ? {}
          : { vm_detail: { vm_id: volume.vm_id } })
      })
    ),
    listVolumePlans: vi.fn(() =>
      Promise.resolve([
        {
          available_inventory_status: true,
          bs_size: 0.1,
          iops: 1500,
          name: '100 GB'
        },
        {
          available_inventory_status: true,
          bs_size: 0.2,
          iops: 3000,
          name: '200 GB'
        }
      ])
    ),
    resizeVolume: vi.fn(() =>
      Promise.resolve({ message: 'Block Storage is upgraded.' })
    )
  };
}

async function resize(
  mocks: ReturnType<typeof volumeMocks>,
  size: string,
  json = false
): Promise<string> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('volume-resize')
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
      createVolumeClient: () => mocks as unknown as VolumeClient,
      stdout,
      store
    })
  ).parseAsync([
    'node',
    'e2ectl',
    ...(json ? ['--json'] : []),
    'myaccount',
    'volume',
    'resize',
    '5',
    '--size',
    size
  ]);
  return stdout.buffer;
}

describe('volume resize', () => {
  it('grows the volume through its node and keeps its name', async () => {
    const mocks = volumeMocks({ size_string: '100 GB', vm_id: 9 });

    const output = JSON.parse(await resize(mocks, '200', true)) as unknown;

    expect(mocks.resizeVolume).toHaveBeenCalledWith(5, {
      block_storage_size: 200,
      name: 'data',
      vm_id: 9
    });
    expect(output).toEqual({
      action: 'resize',
      message: 'Block Storage is upgraded.',
      previous_size_gb: 100,
      size_gb: 200,
      volume_id: 5
    });
  });

  it('points at volume get for the new size', async () => {
    expect(
      await resize(volumeMocks({ size_string: '100 GB', vm_id: 9 }), '200')
    ).toContain('volume get 5');
  });

  it.each([
    [{ size_string: '100 GB' }, '200', 'VOLUME_NOT_ATTACHED'],
    [{ size_string: '200 GB', vm_id: 9 }, '100', 'VOLUME_SIZE_NOT_LARGER'],
    [{ size_string: '100 GB', vm_id: 9 }, '150', 'INVALID_VOLUME_SIZE'],
    [{ size_string: '100 GB', vm_id: 9 }, 'big', 'INVALID_NUMERIC_VALUE']
  ])(
    'refuses %o to %s GB with %s and a next step',
    async (volume, size, code) => {
      const mocks = volumeMocks(volume);

      await expect(resize(mocks, size)).rejects.toMatchObject({ code });
      expect(mocks.resizeVolume).not.toHaveBeenCalled();
    }
  );
});
