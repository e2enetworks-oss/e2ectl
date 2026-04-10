import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { VolumeClient } from './client.js';
import type {
  VolumeCommittedPlan,
  VolumeCreateRequest,
  VolumeCreateResult,
  VolumePlan,
  VolumeSummary
} from './types.js';

const VOLUME_LIST_PAGE_SIZE = 100;
const VOLUME_LIST_MAX_PAGES = 500;
const FRONTEND_BILLING_MONTH_HOURS = 730;

export type VolumeBillingType = 'committed' | 'hourly';
export type VolumePostCommitBehavior = 'auto-renew' | 'hourly-billing';

export interface VolumeContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface VolumePlansOptions extends VolumeContextOptions {
  availableOnly?: boolean;
  size?: string;
}

export interface VolumeCreateOptions extends VolumeContextOptions {
  billingType: string;
  committedPlanId?: string;
  name: string;
  postCommitBehavior?: string;
  size: string;
}

export interface VolumeDeleteOptions extends VolumeContextOptions {
  force?: boolean;
}

export interface VolumeAttachmentItem {
  node_id: number | null;
  vm_id: number | null;
  vm_name: string | null;
}

export interface VolumeListItem {
  attached: boolean;
  attachment: VolumeAttachmentItem | null;
  id: number;
  name: string;
  size_gb: number | null;
  size_label: string | null;
  status: string;
}

export interface VolumeDetailItem extends VolumeListItem {
  exporting_to_eos: boolean;
  snapshot_exists: boolean;
}

export interface VolumeCommittedPlanItem {
  id: number;
  name: string;
  savings_percent: number | null;
  term_days: number;
  total_price: number;
}

export interface VolumePlanItem {
  available: boolean;
  committed_options: VolumeCommittedPlanItem[];
  currency: string | null;
  hourly_price: number | null;
  iops: number;
  size_gb: number;
}

export interface VolumeListCommandResult {
  action: 'list';
  items: VolumeListItem[];
  total_count: number;
  total_page_number: number;
}

export interface VolumePlansCommandResult {
  action: 'plans';
  filters: {
    available_only: boolean;
    size_gb: number | null;
  };
  items: VolumePlanItem[];
  total_count: number;
}

export interface VolumeCreateCommandResult {
  action: 'create';
  billing: {
    committed_plan: VolumeCommittedPlanItem | null;
    post_commit_behavior: VolumePostCommitBehavior | null;
    type: VolumeBillingType;
  };
  requested: {
    name: string;
    size_gb: number;
  };
  resolved_plan: {
    available: boolean;
    currency: string | null;
    hourly_price: number | null;
    iops: number;
    size_gb: number;
  };
  volume: {
    id: number;
    name: string;
  };
}

export interface VolumeDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  message?: string;
  volume_id: number;
}

export interface VolumeGetCommandResult {
  action: 'get';
  volume: VolumeDetailItem;
}

export type VolumeCommandResult =
  | VolumeCreateCommandResult
  | VolumeDeleteCommandResult
  | VolumeGetCommandResult
  | VolumeListCommandResult
  | VolumePlansCommandResult;

interface VolumeStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface VolumeServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createVolumeClient(credentials: ResolvedCredentials): VolumeClient;
  isInteractive: boolean;
  store: VolumeStore;
}

interface ResolvedVolumePlan {
  available: boolean;
  committed_options: VolumeCommittedPlanItem[];
  currency: string | null;
  hourly_price: number | null;
  iops: number;
  size_gb: number;
}

export class VolumeService {
  constructor(private readonly dependencies: VolumeServiceDependencies) {}

  async createVolume(
    options: VolumeCreateOptions
  ): Promise<VolumeCreateCommandResult> {
    const billingType = normalizeBillingType(options.billingType);
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const sizeGb = normalizePositiveInteger(options.size, 'Size', '--size');
    const committedPlanId = normalizeOptionalInteger(
      options.committedPlanId,
      'Committed plan ID',
      '--committed-plan-id'
    );
    const postCommitBehavior = normalizePostCommitBehavior(
      options.postCommitBehavior
    );

    if (billingType === 'committed' && committedPlanId === undefined) {
      throw new CliError(
        'Committed plan ID is required when --billing-type committed is used.',
        {
          code: 'MISSING_COMMITTED_PLAN_ID',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand(`volume plans --size ${sizeGb}`)}, then pass one plan id with --committed-plan-id.`
        }
      );
    }

    if (billingType === 'hourly' && committedPlanId !== undefined) {
      throw new CliError(
        'Committed plan ID can only be used with --billing-type committed.',
        {
          code: 'UNEXPECTED_COMMITTED_PLAN_ID',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Remove --committed-plan-id, or switch to --billing-type committed.'
        }
      );
    }

    if (billingType === 'hourly' && postCommitBehavior !== undefined) {
      throw new CliError(
        '--post-commit-behavior can only be used with --billing-type committed.',
        {
          code: 'UNEXPECTED_POST_COMMIT_BEHAVIOR',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Remove --post-commit-behavior, or switch to --billing-type committed.'
        }
      );
    }

    const client = await this.createClient(options);
    const plans = summarizeVolumePlans(await client.listVolumePlans());
    const matchingPlans = plans.filter((plan) => plan.size_gb === sizeGb);

    if (matchingPlans.length === 0) {
      throw new CliError(
        `No active volume plan matches ${sizeGb} GB in the selected location.`,
        {
          code: 'VOLUME_PLAN_NOT_FOUND',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand('volume plans')} to inspect available sizes, then retry with one of the listed GB values.`
        }
      );
    }

    if (matchingPlans.length > 1) {
      throw new CliError(
        `Multiple active volume plans match ${sizeGb} GB, so the CLI cannot derive a unique IOPS value safely.`,
        {
          code: 'AMBIGUOUS_VOLUME_PLAN',
          details: matchingPlans.map(
            (plan) =>
              `size_gb=${plan.size_gb}, iops=${plan.iops}, available=${plan.available}, hourly_price=${plan.hourly_price ?? 'unknown'}`
          ),
          exitCode: EXIT_CODES.usage,
          suggestion: `Review ${formatCliCommand('volume plans')} and wait for the platform plan set to become unambiguous for that size.`
        }
      );
    }

    const selectedPlan = matchingPlans[0]!;
    if (!selectedPlan.available) {
      throw new CliError(
        `Volume size ${sizeGb} GB is currently unavailable in inventory.`,
        {
          code: 'UNAVAILABLE_VOLUME_PLAN',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand('volume plans')} again later and choose a size marked as available.`
        }
      );
    }

    const committedPlan =
      billingType === 'committed'
        ? selectCommittedPlan(selectedPlan, committedPlanId!)
        : null;

    const request = buildVolumeCreateRequest({
      billingType,
      iops: selectedPlan.iops,
      name,
      sizeGb,
      ...(committedPlanId === undefined ? {} : { committedPlanId }),
      ...(postCommitBehavior === undefined ? {} : { postCommitBehavior })
    });
    const result = await client.createVolume(request);

    return {
      action: 'create',
      billing: {
        committed_plan: committedPlan,
        post_commit_behavior:
          billingType === 'committed'
            ? (postCommitBehavior ?? 'auto-renew')
            : null,
        type: billingType
      },
      requested: {
        name,
        size_gb: sizeGb
      },
      resolved_plan: {
        available: selectedPlan.available,
        currency: selectedPlan.currency,
        hourly_price: selectedPlan.hourly_price,
        iops: selectedPlan.iops,
        size_gb: selectedPlan.size_gb
      },
      volume: normalizeCreatedVolume(result)
    };
  }

  async deleteVolume(
    volumeId: string,
    options: VolumeDeleteOptions
  ): Promise<VolumeDeleteCommandResult> {
    const normalizedVolumeId = assertVolumeId(volumeId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive, 'volume');
      const confirmed = await this.dependencies.confirm(
        `Delete volume ${normalizedVolumeId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          volume_id: normalizedVolumeId
        };
      }
    }

    const client = await this.createClient(options);
    const result = await client.deleteVolume(normalizedVolumeId);

    return {
      action: 'delete',
      cancelled: false,
      message: result.message,
      volume_id: normalizedVolumeId
    };
  }

  async getVolume(
    volumeId: string,
    options: VolumeContextOptions
  ): Promise<VolumeGetCommandResult> {
    const normalizedVolumeId = assertVolumeId(volumeId);
    const client = await this.createClient(options);

    return {
      action: 'get',
      volume: normalizeVolumeDetailItem(
        await client.getVolume(normalizedVolumeId)
      )
    };
  }

  async listVolumePlans(
    options: VolumePlansOptions
  ): Promise<VolumePlansCommandResult> {
    const client = await this.createClient(options);
    const requestedSizeGb =
      options.size === undefined
        ? null
        : normalizePositiveInteger(options.size, 'Size', '--size');
    const availableOnly = options.availableOnly ?? false;
    const summarizedPlans = summarizeVolumePlans(
      await client.listVolumePlans()
    );
    const sizeMatchedPlans =
      requestedSizeGb === null
        ? summarizedPlans
        : summarizedPlans.filter((plan) => plan.size_gb === requestedSizeGb);

    if (requestedSizeGb !== null && sizeMatchedPlans.length === 0) {
      throw new CliError(
        `No volume plan matches ${requestedSizeGb} GB in the selected location.`,
        {
          code: 'VOLUME_PLAN_NOT_FOUND',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand('volume plans')} to inspect available sizes, then retry with one of the listed GB values.`
        }
      );
    }

    const filteredPlans = availableOnly
      ? sizeMatchedPlans.filter((plan) => plan.available)
      : sizeMatchedPlans;

    if (
      requestedSizeGb !== null &&
      availableOnly &&
      sizeMatchedPlans.length > 0 &&
      filteredPlans.length === 0
    ) {
      throw new CliError(
        `Volume size ${requestedSizeGb} GB is currently unavailable in inventory.`,
        {
          code: 'UNAVAILABLE_VOLUME_PLAN',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Remove --available-only to inspect that size, or choose another size marked as available.'
        }
      );
    }

    return {
      action: 'plans',
      filters: {
        available_only: availableOnly,
        size_gb: requestedSizeGb
      },
      items: filteredPlans,
      total_count: filteredPlans.length
    };
  }

  async listVolumes(
    options: VolumeContextOptions
  ): Promise<VolumeListCommandResult> {
    const client = await this.createClient(options);
    const items: VolumeSummary[] = [];
    let currentPage = 1;
    let totalCount = 0;
    let totalPageNumber = 1;

    do {
      const page = await client.listVolumes(currentPage, VOLUME_LIST_PAGE_SIZE);
      items.push(...page.items);
      totalCount = page.total_count ?? items.length;
      totalPageNumber = page.total_page_number ?? 1;
      currentPage += 1;

      if (currentPage > VOLUME_LIST_MAX_PAGES) {
        throw new CliError(
          `Volume list exceeded the maximum page limit (${VOLUME_LIST_MAX_PAGES}).`,
          {
            code: 'PAGINATION_LIMIT_EXCEEDED',
            exitCode: EXIT_CODES.network,
            suggestion:
              'The API returned an unexpectedly large result set. Retry the command or contact support.'
          }
        );
      }
    } while (currentPage <= totalPageNumber);

    return {
      action: 'list',
      items: items.map((item) => normalizeVolumeListItem(item)),
      total_count: totalCount,
      total_page_number: totalPageNumber
    };
  }

  private async createClient(
    options: VolumeContextOptions
  ): Promise<VolumeClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

    return this.dependencies.createVolumeClient(credentials);
  }
}

function buildVolumeCreateRequest(input: {
  billingType: VolumeBillingType;
  committedPlanId?: number;
  iops: number;
  name: string;
  postCommitBehavior?: VolumePostCommitBehavior;
  sizeGb: number;
}): VolumeCreateRequest {
  return {
    ...(input.billingType === 'committed' && input.committedPlanId !== undefined
      ? {
          cn_id: input.committedPlanId,
          cn_status: toBackendPostCommitBehavior(
            input.postCommitBehavior ?? 'auto-renew'
          )
        }
      : {}),
    iops: input.iops,
    name: input.name,
    size: input.sizeGb
  };
}

function normalizeCreatedVolume(result: VolumeCreateResult): {
  id: number;
  name: string;
} {
  return {
    id: result.id,
    name: result.image_name
  };
}

function normalizeVolumeListItem(item: VolumeSummary): VolumeListItem {
  const attachment = normalizeAttachment(item.vm_detail);
  const sizeLabel = normalizeOptionalString(item.size_string) ?? null;

  return {
    attached: attachment !== null,
    attachment,
    id: item.block_id,
    name: item.name,
    size_gb: parseSizeLabelToGb(sizeLabel),
    size_label: sizeLabel,
    status: item.status
  };
}

function normalizeVolumeDetailItem(item: VolumeSummary): VolumeDetailItem {
  return {
    ...normalizeVolumeListItem(item),
    exporting_to_eos: item.is_block_storage_exporting_to_eos ?? false,
    snapshot_exists: item.snapshot_exist ?? false
  };
}

function normalizeAttachment(
  attachment: VolumeSummary['vm_detail']
): VolumeAttachmentItem | null {
  if (attachment === undefined) {
    return null;
  }

  const normalized: VolumeAttachmentItem = {
    node_id: attachment.node_id ?? null,
    vm_id: attachment.vm_id ?? null,
    vm_name: normalizeOptionalString(attachment.vm_name) ?? null
  };

  return normalized.node_id === null &&
    normalized.vm_id === null &&
    normalized.vm_name === null
    ? null
    : normalized;
}

function summarizeVolumePlans(plans: VolumePlan[]): VolumePlanItem[] {
  const byBaseKey = new Map<string, ResolvedVolumePlan>();

  for (const plan of plans) {
    const sizeGb = normalizePlanSize(plan.bs_size);
    const normalizedPlan: ResolvedVolumePlan = {
      available: plan.available_inventory_status,
      committed_options: normalizeCommittedOptions(plan, sizeGb),
      currency: normalizeOptionalString(plan.currency) ?? null,
      hourly_price: deriveHourlyPrice(sizeGb, plan.price),
      iops: plan.iops,
      size_gb: sizeGb
    };
    const key = [
      String(normalizedPlan.size_gb),
      String(normalizedPlan.iops),
      normalizedPlan.currency ?? '',
      normalizedPlan.hourly_price === null
        ? 'null'
        : normalizedPlan.hourly_price.toFixed(2),
      normalizedPlan.available ? '1' : '0'
    ].join('\u0000');
    const existing = byBaseKey.get(key);

    if (existing === undefined) {
      byBaseKey.set(key, normalizedPlan);
      continue;
    }

    existing.committed_options = mergeCommittedOptions(
      existing.committed_options,
      normalizedPlan.committed_options
    );
  }

  return [...byBaseKey.values()].sort(compareVolumePlans);
}

function normalizeCommittedOptions(
  plan: VolumePlan,
  sizeGb: number
): VolumeCommittedPlanItem[] {
  return mergeCommittedOptions(
    [],
    (plan.committed_sku ?? [])
      .map((item) => normalizeCommittedOption(item, sizeGb, plan.price))
      .filter((item): item is VolumeCommittedPlanItem => item !== undefined)
  );
}

function normalizeCommittedOption(
  option: VolumeCommittedPlan,
  sizeGb: number,
  unitPrice: VolumePlan['price']
): VolumeCommittedPlanItem | undefined {
  if (
    option.committed_sku_id === undefined ||
    option.committed_days === undefined ||
    option.committed_sku_price === undefined
  ) {
    return undefined;
  }

  const hourlyPrice = deriveHourlyPrice(sizeGb, unitPrice);

  return {
    id: option.committed_sku_id,
    name: normalizeCommittedPlanName(
      option.committed_sku_name,
      option.committed_days
    ),
    savings_percent: calculateSavingsPercent(
      hourlyPrice,
      option.committed_days,
      option.committed_sku_price
    ),
    term_days: option.committed_days,
    total_price: option.committed_sku_price
  };
}

function mergeCommittedOptions(
  existing: VolumeCommittedPlanItem[],
  next: VolumeCommittedPlanItem[]
): VolumeCommittedPlanItem[] {
  const byId = new Map<number, VolumeCommittedPlanItem>();

  for (const option of [...existing, ...next]) {
    const current = byId.get(option.id);
    if (current === undefined) {
      byId.set(option.id, option);
      continue;
    }

    if (!sameCommittedOption(current, option)) {
      throw new CliError(
        `Volume plan discovery returned conflicting committed plan details for plan id ${option.id}.`,
        {
          code: 'INVALID_API_RESPONSE',
          exitCode: EXIT_CODES.network,
          suggestion:
            'Retry the command. If the conflict persists, inspect the backend plan data.'
        }
      );
    }
  }

  return [...byId.values()].sort((left, right) => {
    const leftKey = [
      String(left.term_days).padStart(5, '0'),
      left.name,
      String(left.id).padStart(10, '0')
    ].join('\u0000');
    const rightKey = [
      String(right.term_days).padStart(5, '0'),
      right.name,
      String(right.id).padStart(10, '0')
    ].join('\u0000');

    return leftKey.localeCompare(rightKey);
  });
}

function sameCommittedOption(
  left: VolumeCommittedPlanItem,
  right: VolumeCommittedPlanItem
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.savings_percent === right.savings_percent &&
    left.term_days === right.term_days &&
    left.total_price === right.total_price
  );
}

function compareVolumePlans(
  left: VolumePlanItem,
  right: VolumePlanItem
): number {
  const leftKey = [
    String(left.size_gb).padStart(8, '0'),
    String(left.iops).padStart(8, '0'),
    left.available ? '1' : '0',
    left.currency ?? '',
    left.hourly_price === null ? '' : left.hourly_price.toFixed(2)
  ].join('\u0000');
  const rightKey = [
    String(right.size_gb).padStart(8, '0'),
    String(right.iops).padStart(8, '0'),
    right.available ? '1' : '0',
    right.currency ?? '',
    right.hourly_price === null ? '' : right.hourly_price.toFixed(2)
  ].join('\u0000');

  return leftKey.localeCompare(rightKey);
}

function deriveHourlyPrice(
  sizeGb: number,
  unitPrice: number | string | null | undefined
): number | null {
  const parsedUnitPrice = parseNumericValue(unitPrice);
  if (parsedUnitPrice === null) {
    return null;
  }

  return roundTo2((sizeGb * parsedUnitPrice) / FRONTEND_BILLING_MONTH_HOURS);
}

function calculateSavingsPercent(
  hourlyPrice: number | null,
  termDays: number,
  totalPrice: number
): number | null {
  if (hourlyPrice === null) {
    return null;
  }

  const baseline = hourlyPrice * 24 * termDays;
  if (baseline <= 0) {
    return null;
  }

  return roundTo2(((baseline - totalPrice) / baseline) * 100);
}

function normalizePlanSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new CliError(
      'Volume plan discovery returned an invalid size value.',
      {
        code: 'INVALID_API_RESPONSE',
        exitCode: EXIT_CODES.network,
        suggestion:
          'Retry the command. If the issue persists, inspect the backend block storage plan data.'
      }
    );
  }

  return Math.round(value * 1000);
}

function selectCommittedPlan(
  plan: ResolvedVolumePlan,
  committedPlanId: number
): VolumeCommittedPlanItem {
  const committedPlan = plan.committed_options.find(
    (option) => option.id === committedPlanId
  );

  if (committedPlan !== undefined) {
    return committedPlan;
  }

  throw new CliError(
    `Committed plan ID ${committedPlanId} is not valid for volume size ${plan.size_gb} GB.`,
    {
      code: 'INVALID_COMMITTED_PLAN_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatCliCommand(`volume plans --size ${plan.size_gb}`)} and choose a committed plan id listed for that size.`
    }
  );
}

function normalizeBillingType(value: string): VolumeBillingType {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'hourly' || normalized === 'committed') {
    return normalized;
  }

  throw new CliError('Billing type must be hourly or committed.', {
    code: 'INVALID_BILLING_TYPE',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass --billing-type hourly for on-demand billing, or --billing-type committed for reserved pricing.'
  });
}

function normalizePostCommitBehavior(
  value: string | undefined
): VolumePostCommitBehavior | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'auto-renew' || normalized === 'hourly-billing') {
    return normalized;
  }

  throw new CliError(
    'Post-commit behavior must be auto-renew or hourly-billing.',
    {
      code: 'INVALID_POST_COMMIT_BEHAVIOR',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass --post-commit-behavior auto-renew to renew the plan, or --post-commit-behavior hourly-billing to fall back to hourly billing.'
    }
  );
}

function normalizePositiveInteger(
  value: string,
  label: string,
  flag: string
): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new CliError(`${label} cannot be empty.`, {
      code: 'EMPTY_REQUIRED_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a positive integer with ${flag}.`
    });
  }

  if (!/^\d+$/.test(normalized)) {
    throw new CliError(`${label} must be a positive integer.`, {
      code: 'INVALID_NUMERIC_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a whole-number GB value with ${flag}, for example 250.`
    });
  }

  const parsed = Number(normalized);
  if (parsed <= 0) {
    throw new CliError(`${label} must be greater than zero.`, {
      code: 'INVALID_NUMERIC_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a positive GB value with ${flag}, for example 250.`
    });
  }

  return parsed;
}

function normalizeOptionalInteger(
  value: string | undefined,
  label: string,
  flag: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new CliError(`${label} cannot be empty.`, {
      code: 'EMPTY_REQUIRED_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a numeric value with ${flag}.`
    });
  }

  if (!/^\d+$/.test(normalized)) {
    throw new CliError(`${label} must be numeric.`, {
      code: 'INVALID_NUMERIC_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass the numeric identifier with ${flag}.`
    });
  }

  return Number(normalized);
}

function normalizeOptionalString(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function normalizeRequiredString(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = value.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}

function assertCanDelete(isInteractive: boolean, resourceName: string): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(
    `Deleting a ${resourceName} requires confirmation in an interactive terminal.`,
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}

function assertVolumeId(volumeId: string): number {
  if (!/^\d+$/.test(volumeId)) {
    throw new CliError('Volume ID must be numeric.', {
      code: 'INVALID_VOLUME_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric volume id as the first argument.'
    });
  }

  return Number(volumeId);
}

function parseSizeLabelToGb(sizeLabel: string | null): number | null {
  if (sizeLabel === null) {
    return null;
  }

  const match = /^([\d.]+)\s*(GB|TB)$/i.exec(sizeLabel);
  if (match === null) {
    return null;
  }

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const unit = match[2];
  if (unit === undefined) {
    return null;
  }

  return unit.toUpperCase() === 'TB'
    ? Math.round(numericValue * 1000)
    : Math.round(numericValue);
}

function parseNumericValue(
  value: number | string | null | undefined
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCommittedPlanName(
  name: string | undefined,
  termDays: number
): string {
  const normalized = normalizeOptionalString(name?.split(',', 1)[0]);
  return normalized ?? `${termDays} Days Committed`;
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function toBackendPostCommitBehavior(
  behavior: VolumePostCommitBehavior
): 'auto_renew' | 'hourly_billing' {
  return behavior === 'auto-renew' ? 'auto_renew' : 'hourly_billing';
}
