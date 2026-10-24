import {
  resolveStoredTirCredentials,
  type ConfigFile,
  type ResolvedTirCredentials
} from '../../config/index.js';
import { AppError, CliError, EXIT_CODES } from '../../core/errors.js';
import { formatTirCommand } from '../api.js';
import type { TirPlanClient } from './client.js';
import type {
  TirPlanApiGroups,
  TirPlanApiItem,
  TirPlanContextOptions,
  TirPlanItem,
  TirPlanListCommandResult
} from './types.js';

interface TirPlanStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface TirPlanServiceDependencies {
  createTirPlanClient(credentials: ResolvedTirCredentials): TirPlanClient;
  store: TirPlanStore;
}

export class TirPlanService {
  constructor(private readonly dependencies: TirPlanServiceDependencies) {}

  async list(
    options: TirPlanContextOptions
  ): Promise<TirPlanListCommandResult> {
    const imageVersionId = normalizeImageVersionId(options.imageVersionId);
    const credentials = await resolveStoredTirCredentials(
      this.dependencies.store,
      options,
      'project'
    );
    const client = this.dependencies.createTirPlanClient(credentials);
    const groups = await listPlansOrExplain(client, imageVersionId);

    return {
      action: 'list',
      image_version_id: imageVersionId ?? null,
      items: flattenPlanGroups(groups)
    };
  }
}

async function listPlansOrExplain(
  client: TirPlanClient,
  imageVersionId: number | undefined
): Promise<TirPlanApiGroups> {
  try {
    return await client.listPlans(imageVersionId);
  } catch (error: unknown) {
    // TIR answers 400 for an image version it does not know.
    if (
      imageVersionId !== undefined &&
      error instanceof AppError &&
      error.details.some((detail) => detail.startsWith('HTTP status: 400'))
    ) {
      throw new CliError(`TIR does not know image version ${imageVersionId}.`, {
        cause: error,
        code: 'TIR_IMAGE_VERSION_NOT_FOUND',
        details: [`API said: ${error.message}`, ...error.details],
        exitCode: EXIT_CODES.usage,
        suggestion: `Run \`${formatTirCommand('image list')}\` and pass a listed version id with --image-version-id.`
      });
    }

    throw error;
  }
}

function normalizeImageVersionId(
  value: string | undefined
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  throw new CliError('Image version ID must be numeric.', {
    code: 'INVALID_IMAGE_VERSION_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a version id from \`${formatTirCommand('image list')}\` with --image-version-id.`
  });
}

function flattenPlanGroups(groups: TirPlanApiGroups): TirPlanItem[] {
  return Object.entries(groups).flatMap(([series, plans]) =>
    Array.isArray(plans) ? plans.map((plan) => toTirPlanItem(plan, series)) : []
  );
}

function toTirPlanItem(plan: TirPlanApiItem, series: string): TirPlanItem {
  const prices = plan.plans ?? [];
  const hourly = prices.find((price) => price.sku_type === 'hourly');

  return {
    available: plan.is_inventory_available === true,
    committed: prices
      .filter((price) => price.sku_type === 'committed')
      .map((price) => ({
        days: price.committed_days ?? null,
        plan_id: price.sku_item_price_id,
        price: price.unit_price ?? null
      })),
    currency: prices[0]?.currency ?? null,
    gpu: summarizeGpu(plan),
    hourly:
      hourly === undefined
        ? null
        : {
            plan_id: hourly.sku_item_price_id,
            price: hourly.unit_price ?? null
          },
    memory: plan.memory ?? null,
    name: plan.name,
    series: plan.series ?? series,
    vcpu: parseCount(plan.cpu)
  };
}

function summarizeGpu(plan: TirPlanApiItem): TirPlanItem['gpu'] {
  if (plan.gpu_card_type === undefined || plan.gpu_card_type === null) {
    return null;
  }

  return {
    count: parseCount(plan.gpu),
    memory: plan.gpu_memory ?? null,
    type: plan.gpu_card_type
  };
}

function parseCount(value: string | null | undefined): number | null {
  if (value === undefined || value === null || !/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number(value);
}
