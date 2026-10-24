import { createProgram } from '../../../../src/app/program.js';
import { ConfigStore } from '../../../../src/config/store.js';
import { AppError, CliError } from '../../../../src/core/errors.js';
import type {
  TirPlanApiGroups,
  TirPlanClient
} from '../../../../src/tir/plan/index.js';
import {
  createTestConfigPath,
  createTestRuntime,
  MemoryWriter
} from '../../../helpers/runtime.js';

const GROUPS: TirPlanApiGroups = {
  CPU: [
    {
      cpu: '4',
      gpu: null,
      gpu_card_type: null,
      is_inventory_available: true,
      memory: '8GB',
      name: 'C3.8GB',
      plans: [
        {
          currency: 'INR',
          sku_item_price_id: 10,
          sku_type: 'hourly',
          unit_price: 4.7
        },
        {
          committed_days: 30,
          currency: 'INR',
          sku_item_price_id: 11,
          sku_type: 'committed',
          unit_price: 3422
        }
      ],
      series: 'CPU'
    }
  ],
  GPU: [
    {
      cpu: '26',
      gpu: '2',
      gpu_card_type: 'H100',
      gpu_memory: '160GB',
      is_inventory_available: false,
      memory: '375GB',
      name: 'GDC.2xH100',
      plans: []
    }
  ],
  is_gpu_supported: true
};

async function runTirPlanList(
  listPlans: TirPlanClient['listPlans'],
  globalArgs: string[] = [],
  commandArgs: string[] = []
): Promise<string> {
  const store = new ConfigStore({
    configPath: createTestConfigPath('tir-plan-command-test')
  });
  await store.upsertProfile('default', {
    api_key: 'key',
    auth_token: 'token',
    tir: { account_id: '1', location: 'Delhi', project_id: '2' }
  });
  const stdout = new MemoryWriter();
  const program = createProgram(
    createTestRuntime({
      createTirPlanClient: () => ({ listPlans }),
      stdout,
      store
    })
  );

  await program.parseAsync([
    'node',
    'e2ectl',
    ...globalArgs,
    'tir',
    'plan',
    'list',
    ...commandArgs
  ]);

  return stdout.buffer;
}

describe('tir plan list', () => {
  it('flattens the series groups into one row per plan with plan ids and prices', async () => {
    const output = await runTirPlanList(
      () => Promise.resolve(GROUPS),
      ['--json']
    );

    expect(JSON.parse(output)).toEqual({
      action: 'list',
      image_version_id: null,
      items: [
        {
          available: true,
          committed: [{ days: 30, plan_id: 11, price: 3422 }],
          currency: 'INR',
          gpu: null,
          hourly: { plan_id: 10, price: 4.7 },
          memory: '8GB',
          name: 'C3.8GB',
          series: 'CPU',
          vcpu: 4
        },
        {
          available: false,
          committed: [],
          currency: null,
          gpu: { count: 2, memory: '160GB', type: 'H100' },
          hourly: null,
          memory: '375GB',
          name: 'GDC.2xH100',
          series: 'GPU',
          vcpu: 26
        }
      ]
    });
  });

  it('shows GPUs and hourly prices in the table', async () => {
    const output = await runTirPlanList(() => Promise.resolve(GROUPS));

    expect(output).toContain('2x H100');
    expect(output).toContain('4.7 INR');
    expect(output).toContain('Committed plan ids and prices are in --json.');
  });

  it('asks for every plan when no image version is given', async () => {
    const listPlans = vi.fn(() => Promise.resolve({}));

    expect(await runTirPlanList(listPlans)).toBe('No TIR plans found.\n');
    expect(listPlans).toHaveBeenCalledWith(undefined);
  });

  it('sends a numeric image version and refuses one that is not', async () => {
    const listPlans = vi.fn(() => Promise.resolve({}));
    const store = new ConfigStore({
      configPath: createTestConfigPath('tir-plan-version')
    });
    await store.upsertProfile('default', {
      api_key: 'key',
      auth_token: 'token',
      tir: { account_id: '1', location: 'Delhi', project_id: '2' }
    });
    const program = createProgram(
      createTestRuntime({ createTirPlanClient: () => ({ listPlans }), store })
    );

    await program.parseAsync([
      'node',
      'e2ectl',
      'tir',
      'plan',
      'list',
      '--image-version-id',
      '65'
    ]);
    expect(listPlans).toHaveBeenCalledWith(65);

    await expect(
      createProgram(
        createTestRuntime({ createTirPlanClient: () => ({ listPlans }), store })
      ).parseAsync([
        'node',
        'e2ectl',
        'tir',
        'plan',
        'list',
        '--image-version-id',
        'abc'
      ])
    ).rejects.toMatchObject({ code: 'INVALID_NUMERIC_ID' });
  });

  it('turns a 400 for an unknown image version into a next step', async () => {
    const error = await runTirPlanList(
      () =>
        Promise.reject(
          new AppError('TIR API request failed: Bad Request', {
            code: 'API_REQUEST_FAILED',
            details: [
              'HTTP status: 400 Bad Request',
              'Errors: "Image Version is either invalid or not provided"'
            ],
            httpStatus: 400
          })
        ),
      [],
      ['--image-version-id', '999']
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CliError);
    expect(error).toMatchObject({
      code: 'TIR_IMAGE_VERSION_NOT_FOUND',
      suggestion: expect.stringContaining('tir image list') as string
    });
  });

  it.each([
    [403, 'HTTP status: 403 Forbidden'],
    [400, 'Errors: "Location is not valid"']
  ])(
    'passes other API failures (%s) through unchanged',
    async (status, detail) => {
      const failure = new AppError('TIR API request failed', {
        code: 'API_REQUEST_FAILED',
        details: [detail],
        httpStatus: status
      });

      await expect(
        runTirPlanList(
          () => Promise.reject(failure),
          [],
          ['--image-version-id', '999']
        )
      ).rejects.toBe(failure);
    }
  );
});
