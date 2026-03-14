import {
  resolveCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { VpcClient } from './client.js';
import type {
  VpcCommittedPlan,
  VpcCreateRequest,
  VpcPlan,
  VpcSummary
} from './types.js';

const VPC_LIST_PAGE_SIZE = 100;
const FRONTEND_BILLING_MONTH_DAYS = 30;
const FRONTEND_BILLING_MONTH_HOURS = 730;

export type VpcBillingType = 'committed' | 'hourly';
export type VpcCidrSource = 'custom' | 'e2e';
export type VpcPostCommitBehavior = 'auto-renew' | 'hourly-billing';

export interface VpcContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface VpcCreateOptions extends VpcContextOptions {
  billingType: string;
  cidr?: string;
  cidrSource: string;
  committedPlanId?: string;
  name: string;
  postCommitBehavior?: string;
}

export interface VpcListItem {
  attached_vm_count: number;
  cidr: string;
  cidr_source: VpcCidrSource;
  created_at: string | null;
  gateway_ip: string | null;
  location: string | null;
  name: string;
  network_id: number;
  project_name: string | null;
  state: string;
  subnet_count: number;
  subnets: VpcSubnetItem[];
}

export interface VpcSubnetItem {
  cidr: string;
  id: number;
  name: string;
  total_ips: number | null;
  used_ips: number | null;
}

export interface VpcHourlyPlanItem {
  currency: string | null;
  location: string | null;
  name: string;
  price_per_hour: number | null;
  price_per_month: number | null;
}

export interface VpcCommittedPlanItem {
  currency: string | null;
  effective_price_per_hour: number | null;
  id: number;
  name: string;
  term_days: number;
  total_price: number;
}

export interface VpcListCommandResult {
  action: 'list';
  items: VpcListItem[];
  total_count: number;
  total_page_number: number;
}

export interface VpcPlansCommandResult {
  action: 'plans';
  committed: {
    default_post_commit_behavior: VpcPostCommitBehavior;
    items: VpcCommittedPlanItem[];
    supported_post_commit_behaviors: VpcPostCommitBehavior[];
  };
  hourly: {
    items: VpcHourlyPlanItem[];
  };
}

export interface VpcCreateCommandResult {
  action: 'create';
  billing: {
    committed_plan_id: number | null;
    post_commit_behavior: VpcPostCommitBehavior | null;
    type: VpcBillingType;
  };
  cidr: {
    source: VpcCidrSource;
    value: string | null;
  };
  credit_sufficient: boolean;
  vpc: {
    name: string;
    network_id: number;
    project_id: string | null;
    vpc_id: number;
  };
}

export type VpcCommandResult =
  | VpcCreateCommandResult
  | VpcListCommandResult
  | VpcPlansCommandResult;

interface VpcStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface VpcServiceDependencies {
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  store: VpcStore;
}

export class VpcService {
  constructor(private readonly dependencies: VpcServiceDependencies) {}

  async createVpc(options: VpcCreateOptions): Promise<VpcCreateCommandResult> {
    const billingType = normalizeBillingType(options.billingType);
    const cidrSource = normalizeCidrSource(options.cidrSource);
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const cidr = normalizeOptionalString(options.cidr);

    if (cidrSource === 'custom' && cidr === undefined) {
      throw new CliError(
        'CIDR is required when --cidr-source custom is used.',
        {
          code: 'MISSING_CUSTOM_CIDR',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Pass a private CIDR block with --cidr, for example 10.10.0.0/23.'
        }
      );
    }

    if (cidrSource === 'e2e' && cidr !== undefined) {
      throw new CliError('Do not pass --cidr when --cidr-source e2e is used.', {
        code: 'UNEXPECTED_CIDR',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Remove --cidr, or switch to --cidr-source custom when you need to provide your own CIDR.'
      });
    }

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
          suggestion: `Run ${formatCliCommand('vpc plans')} first, then pass one plan id with --committed-plan-id.`
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
    const request = buildVpcCreateRequest({
      billingType,
      cidrSource,
      name,
      ...(cidr === undefined ? {} : { cidr }),
      ...(committedPlanId === undefined ? {} : { committedPlanId }),
      ...(postCommitBehavior === undefined ? {} : { postCommitBehavior })
    });
    const result = await client.createVpc(request);

    return {
      action: 'create',
      billing: {
        committed_plan_id:
          billingType === 'committed' ? (committedPlanId ?? null) : null,
        post_commit_behavior:
          billingType === 'committed'
            ? (postCommitBehavior ?? 'auto-renew')
            : null,
        type: billingType
      },
      cidr: {
        source: cidrSource,
        value: cidrSource === 'custom' ? (cidr ?? null) : null
      },
      credit_sufficient: result.is_credit_sufficient,
      vpc: {
        name: result.vpc_name,
        network_id: result.network_id,
        project_id: result.project_id ?? null,
        vpc_id: result.vpc_id
      }
    };
  }

  async listVpcPlans(
    options: VpcContextOptions
  ): Promise<VpcPlansCommandResult> {
    const client = await this.createClient(options);
    const plans = await client.listVpcPlans();

    return {
      action: 'plans',
      committed: {
        default_post_commit_behavior: 'auto-renew',
        items: summarizeCommittedVpcPlans(plans),
        supported_post_commit_behaviors: ['auto-renew', 'hourly-billing']
      },
      hourly: {
        items: summarizeHourlyVpcPlans(plans)
      }
    };
  }

  async listVpcs(options: VpcContextOptions): Promise<VpcListCommandResult> {
    const client = await this.createClient(options);
    const items: VpcSummary[] = [];
    let currentPage = 1;
    let totalCount = 0;
    let totalPageNumber = 1;

    do {
      const page = await client.listVpcs(currentPage, VPC_LIST_PAGE_SIZE);
      items.push(...page.items);
      totalCount = page.total_count ?? items.length;
      totalPageNumber = page.total_page_number ?? 1;
      currentPage += 1;
    } while (currentPage <= totalPageNumber);

    return {
      action: 'list',
      items: items.map((item) => normalizeVpcListItem(item)),
      total_count: totalCount,
      total_page_number: totalPageNumber
    };
  }

  private async createClient(options: VpcContextOptions): Promise<VpcClient> {
    const config = await this.dependencies.store.read();
    const credentials = resolveCredentials({
      ...(options.alias === undefined ? {} : { alias: options.alias }),
      config,
      configPath: this.dependencies.store.configPath,
      ...(options.projectId === undefined
        ? {}
        : {
            projectId: options.projectId
          }),
      ...(options.location === undefined
        ? {}
        : {
            location: options.location
          })
    });

    return this.dependencies.createVpcClient(credentials);
  }
}

function buildVpcCreateRequest(input: {
  billingType: VpcBillingType;
  cidr?: string;
  cidrSource: VpcCidrSource;
  committedPlanId?: number;
  name: string;
  postCommitBehavior?: VpcPostCommitBehavior;
}): VpcCreateRequest {
  return {
    ...(input.billingType === 'committed' && input.committedPlanId !== undefined
      ? {
          cn_id: input.committedPlanId,
          cn_status: toBackendPostCommitBehavior(
            input.postCommitBehavior ?? 'auto-renew'
          )
        }
      : {}),
    ...(input.cidrSource === 'custom' && input.cidr !== undefined
      ? { ipv4: input.cidr }
      : {}),
    is_e2e_vpc: input.cidrSource === 'e2e',
    vpc_name: input.name
  };
}

function normalizeVpcListItem(item: VpcSummary): VpcListItem {
  const subnets = (item.subnets ?? []).map((subnet) => ({
    cidr: subnet.cidr,
    id: subnet.id,
    name: subnet.subnet_name,
    total_ips: subnet.totalIPs ?? null,
    used_ips: subnet.usedIPs ?? null
  }));

  return {
    attached_vm_count: item.vm_count ?? 0,
    cidr: item.ipv4_cidr,
    cidr_source: item.is_e2e_vpc ? 'e2e' : 'custom',
    created_at: item.created_at ?? null,
    gateway_ip: item.gateway_ip ?? null,
    location: item.location ?? null,
    name: item.name,
    network_id: item.network_id,
    project_name: item.project_name ?? null,
    state: item.state,
    subnet_count: subnets.length,
    subnets
  };
}

function summarizeHourlyVpcPlans(plans: VpcPlan[]): VpcHourlyPlanItem[] {
  return [...plans]
    .map((plan) => ({
      currency: plan.currency ?? null,
      location: plan.location ?? null,
      name: plan.name,
      price_per_hour: plan.price_per_hour ?? null,
      price_per_month: plan.price_per_month ?? null
    }))
    .sort((left, right) => {
      const leftKey = [
        left.name,
        left.location ?? '',
        left.currency ?? ''
      ].join('\u0000');
      const rightKey = [
        right.name,
        right.location ?? '',
        right.currency ?? ''
      ].join('\u0000');

      return leftKey.localeCompare(rightKey);
    });
}

function summarizeCommittedVpcPlans(plans: VpcPlan[]): VpcCommittedPlanItem[] {
  return plans
    .flatMap((plan) =>
      (plan.committed_sku ?? []).map((committedPlan) =>
        normalizeCommittedVpcPlan(committedPlan, plan.currency)
      )
    )
    .filter((plan): plan is VpcCommittedPlanItem => plan !== undefined)
    .sort((left, right) => {
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

function normalizeCommittedVpcPlan(
  plan: VpcCommittedPlan,
  currency: string | undefined
): VpcCommittedPlanItem | undefined {
  if (
    plan.committed_sku_id === undefined ||
    plan.committed_sku_name === undefined ||
    plan.committed_sku_price === undefined ||
    plan.committed_days === undefined
  ) {
    return undefined;
  }

  const effectivePricePerHour = calculateCommittedEffectivePricePerHour(
    plan.committed_days,
    plan.committed_sku_price
  );

  return {
    currency: currency ?? null,
    effective_price_per_hour: effectivePricePerHour,
    id: plan.committed_sku_id,
    name: plan.committed_sku_name,
    term_days: plan.committed_days,
    total_price: plan.committed_sku_price
  };
}

function calculateCommittedEffectivePricePerHour(
  termDays: number,
  totalPrice: number
): number | null {
  // Match the current frontend discovery calculation until the backend
  // exposes an authoritative effective hourly value for committed VPC plans.
  const billedMonths = Math.floor(termDays / FRONTEND_BILLING_MONTH_DAYS);
  if (billedMonths <= 0) {
    return null;
  }

  return Number(
    (totalPrice / (billedMonths * FRONTEND_BILLING_MONTH_HOURS)).toFixed(2)
  );
}

function normalizeBillingType(value: string): VpcBillingType {
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

function normalizeCidrSource(value: string): VpcCidrSource {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'custom' || normalized === 'e2e') {
    return normalized;
  }

  throw new CliError('CIDR source must be e2e or custom.', {
    code: 'INVALID_CIDR_SOURCE',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass --cidr-source e2e to let E2E assign the CIDR, or --cidr-source custom to provide your own.'
  });
}

function normalizePostCommitBehavior(
  value: string | undefined
): VpcPostCommitBehavior | undefined {
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

function toBackendPostCommitBehavior(
  behavior: VpcPostCommitBehavior
): 'auto_renew' | 'hourly_billing' {
  return behavior === 'auto-renew' ? 'auto_renew' : 'hourly_billing';
}
