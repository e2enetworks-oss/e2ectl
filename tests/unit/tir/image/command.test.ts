import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import type {
  TirImageApiItem,
  TirImageClient
} from '../../../../src/tir/image/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const IMAGES: TirImageApiItem[] = [
  {
    image_id: 2,
    name: 'PyTorch',
    versions: [
      {
        app: { display_name: 'Jupyter Labs', name: 'jupyter_labs' },
        description: 'PyTorch 2.8',
        image_version_id: 65,
        is_internal: false,
        version: 'v2.8'
      },
      { image_version_id: 66, is_internal: true, version: 'internal-build' }
    ]
  },
  { image_id: 3, name: 'Empty' }
];

async function runTirImageList(
  images: TirImageApiItem[],
  extraArgs: string[] = []
): Promise<string> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('tir-image-command-test')
  });
  await store.upsertProfile('default', {
    api_key: 'key',
    auth_token: 'token',
    tir: { account_id: '1', location: 'Delhi', project_id: '2' }
  });
  const stdout = new MemoryWriter();
  const client: TirImageClient = { listImages: () => Promise.resolve(images) };
  const program = createProgram(
    createTestRuntime({ createTirImageClient: () => client, stdout, store })
  );

  await program.parseAsync([
    'node',
    'e2ectl',
    ...extraArgs,
    'tir',
    'image',
    'list'
  ]);

  return stdout.buffer;
}

describe('tir image list', () => {
  it('lists one row per version and points at tir plan list', async () => {
    const output = await runTirImageList(IMAGES);

    expect(output).toContain('PyTorch');
    expect(output).toContain('65');
    expect(output).toContain('tir plan list --image-version-id <version-id>');
  });

  it('never shows internal versions', async () => {
    const output = await runTirImageList(IMAGES, ['--json']);

    expect(JSON.parse(output)).toEqual({
      action: 'list',
      items: [
        {
          app: 'jupyter_labs',
          description: 'PyTorch 2.8',
          image_id: 2,
          image_name: 'PyTorch',
          version: 'v2.8',
          version_id: 65
        }
      ]
    });
  });

  it('says so when there are no images', async () => {
    expect(await runTirImageList([])).toBe('No TIR images found.\n');
  });
});
