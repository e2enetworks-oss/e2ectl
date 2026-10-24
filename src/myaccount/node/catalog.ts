import { isNonEmptyString, isRecord } from '../../core/guards.js';
import type {
  NodeCatalogBillingType,
  NodeCatalogCommittedOptionSummary,
  NodeCatalogCommittedSku,
  NodeCatalogGpuSummary,
  NodeCatalogOsData,
  NodeCatalogOsEntry,
  NodeCatalogOsVersion,
  NodeCatalogPlan,
  NodeCatalogPlanFilters,
  NodeCatalogPlanItem,
  NodeCatalogQuery
} from './types.js';
import {
  normalizeBillingType,
  normalizeRequiredNumericId,
  normalizeRequiredString
} from './normalizers.js';

interface NodeCatalogPlansOptionsInput {
  category: string;
  displayCategory: string;
  os: string;
  osVersion: string;
}

interface NodeCatalogFilterOptionsInput {
  family?: string;
  gpuType?: string;
  minRam?: string;
  minVcpu?: string;
}

type NodeCatalogPlansEmptyReason =
  | 'no_committed'
  | 'no_committed_for_family'
  | 'no_family_match'
  | 'no_filter_match'
  | 'no_plans';

interface NodeCatalogPlansSummary {
  available_families: string[];
  empty_reason: NodeCatalogPlansEmptyReason | null;
}

const DEFAULT_NODE_CATALOG_BILLING_TYPE: NodeCatalogBillingType = 'all';

export function buildNodeCatalogQuery(
  options: NodeCatalogPlansOptionsInput
): NodeCatalogQuery {
  return {
    category: normalizeRequiredString(
      options.category,
      'Category',
      '--category'
    ),
    display_category: normalizeRequiredString(
      options.displayCategory,
      'Display category',
      '--display-category'
    ),
    os: normalizeRequiredString(options.os, 'OS', '--os'),
    osversion: normalizeRequiredString(
      options.osVersion,
      'OS version',
      '--os-version'
    )
  };
}

export function normalizeNodeCatalogBillingType(
  value: string | undefined
): NodeCatalogBillingType {
  return normalizeBillingType(
    value,
    ['all', 'committed', 'hourly'],
    DEFAULT_NODE_CATALOG_BILLING_TYPE
  );
}

// Flattens the grouped catalog into one row per display category and OS
// version. GPU rows repeat under every card that offers them; they are kept
// once. Groups without OS rows (the GPU wizard) are skipped.
export function summarizeNodeCatalogOs(
  data: NodeCatalogOsData
): NodeCatalogOsEntry[] {
  const entries = new Map<string, NodeCatalogOsEntry>();

  for (const [displayCategory, group] of Object.entries(data.category_list)) {
    for (const row of collectOsRows(group)) {
      const entry: NodeCatalogOsEntry = {
        category: row.sub_category,
        display_category: displayCategory,
        number_of_domains: row.number_of_domains ?? null,
        os: row.os,
        os_version: row.version,
        software_version: row.software_version ?? ''
      };
      entries.set(osEntryKey(entry), entry);
    }
  }

  return [...entries.values()].sort((left, right) =>
    osEntryKey(left).localeCompare(osEntryKey(right))
  );
}

function collectOsRows(group: unknown): NodeCatalogOsVersion[] {
  if (!isRecord(group)) {
    return [];
  }

  return Object.values(group)
    .filter((rows): rows is unknown[] => Array.isArray(rows))
    .flat()
    .filter(isCatalogOsRow);
}

function isCatalogOsRow(row: unknown): row is NodeCatalogOsVersion {
  return (
    isRecord(row) &&
    isNonEmptyString(row.os) &&
    isNonEmptyString(row.version) &&
    isNonEmptyString(row.sub_category)
  );
}

function osEntryKey(entry: NodeCatalogOsEntry): string {
  return [
    entry.display_category,
    entry.category,
    entry.os,
    entry.os_version,
    entry.software_version
  ].join('\u0000');
}

export function normalizeNodeCatalogPlanItems(
  plans: NodeCatalogPlan[],
  billingType: NodeCatalogBillingType,
  filters: NodeCatalogPlanFilters = {}
): NodeCatalogPlanItem[] {
  const familyFilteredPlans = filterNodeCatalogPlans(plans, filters);
  const filteredPlans =
    billingType === 'committed'
      ? filterNodeCatalogPlansForCommittedBilling(familyFilteredPlans)
      : familyFilteredPlans;

  return [...filteredPlans]
    .sort(compareNodeCatalogPlans)
    .map((plan, index) => toNodeCatalogPlanItem(plan, billingType, index + 1));
}

export function normalizeOptionalNodeCatalogFamily(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeRequiredString(value, 'Family', '--family');
}

export function normalizeNodeCatalogPlanFilters(
  options: NodeCatalogFilterOptionsInput
): NodeCatalogPlanFilters {
  const family = normalizeOptionalNodeCatalogFamily(options.family);
  const gpuType =
    options.gpuType === undefined
      ? undefined
      : normalizeRequiredString(options.gpuType, 'GPU type', '--gpu-type');
  const minVcpu =
    options.minVcpu === undefined
      ? undefined
      : normalizeRequiredNumericId(
          options.minVcpu,
          'Minimum vCPU',
          '--min-vcpu'
        );
  const minRamGb =
    options.minRam === undefined
      ? undefined
      : normalizeRequiredNumericId(
          options.minRam,
          'Minimum RAM in GB',
          '--min-ram'
        );

  return {
    ...(family === undefined ? {} : { family }),
    ...(gpuType === undefined ? {} : { gpuType }),
    ...(minVcpu === undefined ? {} : { minVcpu }),
    ...(minRamGb === undefined ? {} : { minRamGb })
  };
}

export function summarizeNodeCatalogPlans(
  plans: NodeCatalogPlan[],
  items: NodeCatalogPlanItem[],
  billingType: NodeCatalogBillingType,
  filters: NodeCatalogPlanFilters = {}
): NodeCatalogPlansSummary {
  return {
    available_families: collectNodeCatalogFamilies(plans),
    empty_reason:
      items.length === 0
        ? explainEmptyCatalog(plans, billingType, filters)
        : null
  };
}

function explainEmptyCatalog(
  plans: NodeCatalogPlan[],
  billingType: NodeCatalogBillingType,
  filters: NodeCatalogPlanFilters
): NodeCatalogPlansEmptyReason {
  const { family } = filters;
  const familyPlans = filterNodeCatalogPlans(
    plans,
    family === undefined ? {} : { family }
  );

  if (family !== undefined && familyPlans.length === 0) {
    return 'no_family_match';
  }

  if (filterNodeCatalogPlans(familyPlans, filters).length === 0) {
    return plans.length === 0 ? 'no_plans' : 'no_filter_match';
  }

  if (billingType === 'committed') {
    return family === undefined ? 'no_committed' : 'no_committed_for_family';
  }

  return 'no_plans';
}

function filterNodeCatalogPlans(
  plans: NodeCatalogPlan[],
  filters: NodeCatalogPlanFilters
): NodeCatalogPlan[] {
  return plans.filter(
    (plan) =>
      (filters.family === undefined ||
        normalizeOptionalText(plan.specs?.family) === filters.family) &&
      (filters.minVcpu === undefined ||
        (plan.specs?.cpu ?? 0) >= filters.minVcpu) &&
      (filters.minRamGb === undefined ||
        (parseRamAsNumber(plan.specs?.ram) ?? 0) >= filters.minRamGb) &&
      (filters.gpuType === undefined ||
        matchesGpuType(summarizeGpu(plan), filters.gpuType))
  );
}

// Accepts the card type as the catalog writes it (Nvidia-A100) or without
// the maker (A100), in any case.
function matchesGpuType(
  gpu: NodeCatalogGpuSummary | null,
  wanted: string
): boolean {
  if (gpu === null) {
    return false;
  }

  const cardType = gpu.type.toLowerCase();
  const wantedType = wanted.toLowerCase();
  return cardType === wantedType || cardType.endsWith(`-${wantedType}`);
}

function summarizeGpu(plan: NodeCatalogPlan): NodeCatalogGpuSummary | null {
  const card = plan.gpu_card_details;
  if (card === undefined || !('CARD_TYPE' in card)) {
    return null;
  }

  const type = normalizeOptionalText(card.CARD_TYPE);
  if (type === null) {
    return null;
  }

  return {
    count: normalizeOptionalInteger(card.UNIT_COUNT),
    memory_gb: parseRamAsNumber(card.MEMORY),
    type
  };
}

function filterNodeCatalogPlansForCommittedBilling(
  plans: NodeCatalogPlan[]
): NodeCatalogPlan[] {
  return plans.filter((plan) => hasCommittedOptions(plan));
}

function collectNodeCatalogFamilies(plans: NodeCatalogPlan[]): string[] {
  return [
    ...new Set(plans.map((plan) => normalizeOptionalText(plan.specs?.family)))
  ]
    .filter((family): family is string => family !== null)
    .sort(compareText);
}

function compareNodeCatalogPlans(
  left: NodeCatalogPlan,
  right: NodeCatalogPlan
): number {
  return (
    compareNullableNumber(left.specs?.cpu, right.specs?.cpu) ||
    compareNullableNumber(
      parseRamAsNumber(left.specs?.ram),
      parseRamAsNumber(right.specs?.ram)
    ) ||
    compareNullableNumber(left.specs?.disk_space, right.specs?.disk_space) ||
    compareText(resolveNodeCatalogSku(left), resolveNodeCatalogSku(right)) ||
    compareText(left.plan, right.plan) ||
    compareText(left.image, right.image)
  );
}

function toNodeCatalogPlanItem(
  plan: NodeCatalogPlan,
  billingType: NodeCatalogBillingType,
  row: number
): NodeCatalogPlanItem {
  return {
    available_inventory: plan.available_inventory_status !== false,
    committed_options:
      billingType === 'hourly'
        ? []
        : normalizeCommittedOptions(plan.specs?.committed_sku),
    config: {
      disk_gb: normalizeOptionalInteger(plan.specs?.disk_space),
      family: normalizeOptionalText(plan.specs?.family),
      gpu: summarizeGpu(plan),
      ram: normalizeOptionalText(plan.specs?.ram),
      series: normalizeOptionalText(plan.specs?.series),
      vcpu: normalizeOptionalInteger(plan.specs?.cpu)
    },
    currency: normalizeOptionalText(plan.currency),
    hourly: {
      minimum_billing_amount: normalizeOptionalNumber(
        plan.specs?.minimum_billing_amount
      ),
      price_per_hour: normalizeOptionalNumber(plan.specs?.price_per_hour),
      price_per_month: normalizeOptionalNumber(plan.specs?.price_per_month)
    },
    image: plan.image,
    plan: plan.plan,
    row,
    sku: resolveNodeCatalogSku(plan)
  };
}

function hasCommittedOptions(plan: NodeCatalogPlan): boolean {
  return normalizeCommittedOptions(plan.specs?.committed_sku).length > 0;
}

function normalizeCommittedOptions(
  options: NodeCatalogCommittedSku[] | undefined
): NodeCatalogCommittedOptionSummary[] {
  if (options === undefined) {
    return [];
  }

  return options
    .filter(
      (
        option
      ): option is NonNullable<typeof options>[number] & {
        committed_sku_id: number;
      } =>
        typeof option.committed_sku_id === 'number' &&
        Number.isInteger(option.committed_sku_id) &&
        option.committed_sku_id > 0
    )
    .map((option) => ({
      days: normalizeOptionalInteger(option.committed_days),
      id: option.committed_sku_id,
      name: normalizeOptionalText(option.committed_sku_name) ?? '',
      total_price: normalizeOptionalNumber(option.committed_sku_price)
    }))
    .sort(
      (left, right) =>
        compareNullableNumber(left.days, right.days) ||
        compareNullableNumber(left.total_price, right.total_price) ||
        left.id - right.id
    );
}

function resolveNodeCatalogSku(plan: NodeCatalogPlan): string {
  return (
    normalizeOptionalText(plan.specs?.sku_name) ??
    normalizeOptionalText(plan.name) ??
    plan.plan
  );
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeOptionalInteger(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function normalizeOptionalNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseRamAsNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined
): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  return left - right;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
