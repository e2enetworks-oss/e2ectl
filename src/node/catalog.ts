import type {
  NodeCatalogBillingType,
  NodeCatalogCommittedOptionSummary,
  NodeCatalogCommittedSku,
  NodeCatalogPlan,
  NodeCatalogPlanItem,
  NodeCatalogQuery
} from './types.js';
import {
  normalizeBillingType,
  normalizeRequiredString
} from './normalizers.js';

interface NodeCatalogPlansOptionsInput {
  category: string;
  displayCategory: string;
  os: string;
  osVersion: string;
}

type NodeCatalogPlansEmptyReason =
  | 'no_committed'
  | 'no_committed_for_family'
  | 'no_family_match'
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

export function normalizeNodeCatalogPlanItems(
  plans: NodeCatalogPlan[],
  billingType: NodeCatalogBillingType,
  family?: string
): NodeCatalogPlanItem[] {
  const familyFilteredPlans = filterNodeCatalogPlansByFamily(plans, family);
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

export function summarizeNodeCatalogPlans(
  plans: NodeCatalogPlan[],
  items: NodeCatalogPlanItem[],
  billingType: NodeCatalogBillingType,
  family?: string
): NodeCatalogPlansSummary {
  const familyFilteredPlans = filterNodeCatalogPlansByFamily(plans, family);

  let emptyReason: NodeCatalogPlansEmptyReason | null = null;
  if (items.length === 0) {
    if (family !== undefined && familyFilteredPlans.length === 0) {
      emptyReason = 'no_family_match';
    } else if (billingType === 'committed') {
      emptyReason =
        family === undefined ? 'no_committed' : 'no_committed_for_family';
    } else {
      emptyReason = 'no_plans';
    }
  }

  return {
    available_families: collectNodeCatalogFamilies(plans),
    empty_reason: emptyReason
  };
}

function filterNodeCatalogPlansByFamily(
  plans: NodeCatalogPlan[],
  family?: string
): NodeCatalogPlan[] {
  return family === undefined
    ? plans
    : plans.filter(
        (plan) => normalizeOptionalText(plan.specs?.family) === family
      );
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
