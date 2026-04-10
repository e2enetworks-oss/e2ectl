import { isIPv4 } from 'node:net';

import {
  resolveStoredCredentials,
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
const VPC_LIST_MAX_PAGES = 500;

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

export interface VpcDeleteOptions extends VpcContextOptions {
  force?: boolean;
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

export interface VpcDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  message?: string;
  vpc: {
    id: number;
    name: string | null;
    project_id: string | null;
  };
}

export interface VpcGetCommandResult {
  action: 'get';
  vpc: VpcListItem;
}

export type VpcCommandResult =
  | VpcCreateCommandResult
  | VpcDeleteCommandResult
  | VpcGetCommandResult
  | VpcListCommandResult
  | VpcPlansCommandResult;

interface VpcStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface VpcServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  isInteractive: boolean;
  store: VpcStore;
}

export class VpcService {
  constructor(private readonly dependencies: VpcServiceDependencies) {}

  async createVpc(options: VpcCreateOptions): Promise<VpcCreateCommandResult> {
    const billingType = normalizeBillingType(options.billingType);
    const cidrSource = normalizeCidrSource(options.cidrSource);
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const requestedCidr = normalizeOptionalString(options.cidr);

    if (cidrSource === 'custom' && requestedCidr === undefined) {
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

    if (cidrSource === 'e2e' && requestedCidr !== undefined) {
      throw new CliError('Do not pass --cidr when --cidr-source e2e is used.', {
        code: 'UNEXPECTED_CIDR',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Remove --cidr, or switch to --cidr-source custom when you need to provide your own CIDR.'
      });
    }

    const cidr =
      cidrSource === 'custom' && requestedCidr !== undefined
        ? normalizeCustomCidr(requestedCidr)
        : requestedCidr;

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

  async deleteVpc(
    vpcId: string,
    options: VpcDeleteOptions
  ): Promise<VpcDeleteCommandResult> {
    const normalizedVpcId = assertVpcId(vpcId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive, 'VPC');
      const confirmed = await this.dependencies.confirm(
        `Delete VPC ${normalizedVpcId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          vpc: {
            id: normalizedVpcId,
            name: null,
            project_id: null
          }
        };
      }
    }

    const client = await this.createClient(options);
    const response = await client.deleteVpc(normalizedVpcId);

    return {
      action: 'delete',
      cancelled: false,
      message: response.message,
      vpc: {
        id: response.result.vpc_id,
        name: response.result.vpc_name,
        project_id: response.result.project_id ?? null
      }
    };
  }

  async getVpc(
    vpcId: string,
    options: VpcContextOptions
  ): Promise<VpcGetCommandResult> {
    const normalizedVpcId = assertVpcId(vpcId);
    const client = await this.createClient(options);

    return {
      action: 'get',
      vpc: normalizeVpcListItem(await client.getVpc(normalizedVpcId))
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

      if (currentPage > VPC_LIST_MAX_PAGES) {
        throw new CliError(
          `VPC list exceeded the maximum page limit (${VPC_LIST_MAX_PAGES}).`,
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
      items: items.map((item) => normalizeVpcListItem(item)),
      total_count: totalCount,
      total_page_number: totalPageNumber
    };
  }

  private async createClient(options: VpcContextOptions): Promise<VpcClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

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

  return {
    currency: currency ?? null,
    id: plan.committed_sku_id,
    name: plan.committed_sku_name,
    term_days: plan.committed_days,
    total_price: plan.committed_sku_price
  };
}

function normalizeCustomCidr(value: string): string {
  const normalized = value.trim();
  const [address, prefixText, ...rest] = normalized.split('/');

  if (
    address === undefined ||
    prefixText === undefined ||
    rest.length > 0 ||
    !isIPv4(address)
  ) {
    throwInvalidCidr();
  }

  if (!/^\d+$/.test(prefixText)) {
    throwInvalidCidr();
  }

  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throwInvalidCidr();
  }

  const networkAddress = toIpv4String(
    Math.floor(toIpv4Number(address) / 2 ** (32 - prefix)) * 2 ** (32 - prefix)
  );
  if (networkAddress !== address) {
    throwInvalidCidr();
  }

  return `${address}/${prefix}`;
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

function assertVpcId(vpcId: string): number {
  if (!/^\d+$/.test(vpcId)) {
    throw new CliError('VPC ID must be numeric.', {
      code: 'INVALID_VPC_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric VPC id as the first argument.'
    });
  }

  return Number(vpcId);
}

function throwInvalidCidr(): never {
  throw new CliError('CIDR must be a valid IPv4 CIDR block.', {
    code: 'INVALID_CIDR',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass a CIDR like 10.10.0.0/23 with a valid network address.'
  });
}

function toIpv4Number(address: string): number {
  return address
    .split('.')
    .map((part) => Number(part))
    .reduce((value, octet) => value * 256 + octet, 0);
}

function toIpv4String(value: number): string {
  return [24, 16, 8, 0]
    .map((shift) => String(Math.floor(value / 2 ** shift) % 256))
    .join('.');
}

function toBackendPostCommitBehavior(
  behavior: VpcPostCommitBehavior
): 'auto_renew' | 'hourly_billing' {
  return behavior === 'auto-renew' ? 'auto_renew' : 'hourly_billing';
}
