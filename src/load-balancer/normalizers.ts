import { isIPv4 } from 'node:net';

import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import { normalizeRequiredNumericId } from '../node/normalizers.js';
import type { ReservedIpSummary } from '../reserved-ip/index.js';
import {
  LOAD_BALANCER_ALB_BACKEND_PROTOCOLS,
  LOAD_BALANCER_ALGORITHMS,
  LOAD_BALANCER_DEFAULT_POST_COMMIT_BEHAVIOR,
  LOAD_BALANCER_FRONTEND_PROTOCOLS
} from './constants.js';
import type {
  LoadBalancerAlgorithm,
  LoadBalancerCommittedPlan,
  LoadBalancerCommittedStatus,
  LoadBalancerCreateBillingSelectionOptions,
  LoadBalancerContextPayload,
  LoadBalancerDetails,
  LoadBalancerMode,
  LoadBalancerPlan,
  ResolvedLoadBalancerCreateBilling,
  LoadBalancerServer,
  LoadBalancerUpdateOptions
} from './types/index.js';

export function assertFrontendProtocol(
  mode: string | undefined
): LoadBalancerMode {
  if (mode === undefined) {
    throw new CliError('--frontend-protocol is required.', {
      code: 'MISSING_REQUIRED_OPTION',
      exitCode: EXIT_CODES.usage
    });
  }
  const upper = mode.toUpperCase() as LoadBalancerMode;

  if (!LOAD_BALANCER_FRONTEND_PROTOCOLS.includes(upper)) {
    throw new CliError(
      `Invalid --frontend-protocol "${mode}". Must be one of: ${LOAD_BALANCER_FRONTEND_PROTOCOLS.join(', ')}.`,
      {
        code: 'INVALID_LB_FRONTEND_PROTOCOL',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return upper;
}

export const assertLoadBalancerMode = assertFrontendProtocol;

export function assertAlgorithm(algorithm: string): LoadBalancerAlgorithm {
  const lower = algorithm.toLowerCase() as LoadBalancerAlgorithm;

  if (!LOAD_BALANCER_ALGORITHMS.includes(lower)) {
    throw new CliError(
      `Invalid --algorithm "${algorithm}". Must be one of: ${LOAD_BALANCER_ALGORITHMS.join(', ')}.`,
      {
        code: 'INVALID_LB_ALGORITHM',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return lower;
}

export function assertAlbBackendProtocol(
  protocol: string | undefined
): (typeof LOAD_BALANCER_ALB_BACKEND_PROTOCOLS)[number] {
  const normalized = (protocol ?? 'HTTP').trim().toUpperCase();

  if (
    (LOAD_BALANCER_ALB_BACKEND_PROTOCOLS as readonly string[]).includes(
      normalized
    ) === false
  ) {
    throw new CliError(
      `Invalid --backend-protocol "${protocol}". Must be one of: ${LOAD_BALANCER_ALB_BACKEND_PROTOCOLS.join(', ')}.`,
      {
        code: 'INVALID_LB_BACKEND_PROTOCOL',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return normalized as (typeof LOAD_BALANCER_ALB_BACKEND_PROTOCOLS)[number];
}

export function normalizeAlbBackendProtocol(
  protocol: (typeof LOAD_BALANCER_ALB_BACKEND_PROTOCOLS)[number]
): 'http' | 'https' {
  return protocol === 'HTTPS' ? 'https' : 'http';
}

export function assertPort(port: string, flag: string): number {
  const num = Number(port);

  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new CliError(`${flag} must be an integer between 1 and 65535.`, {
      code: 'INVALID_PORT',
      exitCode: EXIT_CODES.usage
    });
  }

  return num;
}

export function assertIp(ip: string, flag: string): string {
  const trimmed = ip.trim();

  if (trimmed.length === 0) {
    throw new CliError(`${flag} is required.`, {
      code: 'MISSING_SERVER_IP',
      exitCode: EXIT_CODES.usage
    });
  }

  if (!isIPv4(trimmed)) {
    throw new CliError(`${flag} "${trimmed}" is not a valid IPv4 address.`, {
      code: 'INVALID_SERVER_IP',
      exitCode: EXIT_CODES.usage
    });
  }

  return trimmed;
}

export function parseBackendServerSpecs(
  values: string[] | undefined
): LoadBalancerServer[] {
  if (values === undefined || values.length === 0) {
    throw new CliError('At least one --backend-server is required.', {
      code: 'BACKEND_SERVER_REQUIRED',
      exitCode: EXIT_CODES.usage
    });
  }

  return values.map(parseBackendServerSpec);
}

export function parseBackendServerSpec(value: string): LoadBalancerServer {
  const [name, ip, port, ...extra] = value.split(':');
  if (
    name === undefined ||
    ip === undefined ||
    port === undefined ||
    extra.length > 0
  ) {
    throw new CliError(
      `Invalid --backend-server "${value}". Expected name:ip:port.`,
      {
        code: 'INVALID_BACKEND_SERVER_SPEC',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return {
    backend_name: assertNonEmpty(name, '--backend-server name'),
    backend_ip: assertIp(ip, '--backend-server ip'),
    backend_port: assertPort(port, '--backend-server port')
  };
}

export function assertNonEmpty(
  value: string | undefined,
  flag: string
): string {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) {
    throw new CliError(`${flag} is required.`, {
      code: 'MISSING_REQUIRED_OPTION',
      exitCode: EXIT_CODES.usage
    });
  }

  return trimmed;
}

export function defaultPortForProtocol(
  mode: LoadBalancerMode
): string | undefined {
  if (mode === 'HTTP') return '80';
  if (mode === 'HTTPS' || mode === 'BOTH') return '443';
  return undefined;
}

export function normalizeExistingMode(
  value: string | undefined,
  fallback: LoadBalancerMode
): LoadBalancerMode {
  if (value === undefined) {
    return fallback;
  }

  try {
    return assertLoadBalancerMode(value);
  } catch {
    return fallback;
  }
}

export function normalizeOptionalPublicIp(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 || normalized === '[]'
    ? undefined
    : normalized;
}

export function isAvailableReservedIp(item: ReservedIpSummary): boolean {
  const normalizedStatus = item.status?.trim()?.toLowerCase();
  const hasAttachedNode =
    (item.floating_ip_attached_nodes ?? []).length > 0 ||
    (item.vm_id !== undefined && item.vm_id !== null);

  return (
    (normalizedStatus === 'reserved' || normalizedStatus === 'available') &&
    !hasAttachedNode
  );
}

function getLbPublicIp(lb: LoadBalancerDetails): string | undefined {
  return normalizeOptionalPublicIp(lb.public_ip ?? lb.node_detail?.public_ip);
}

export function isLoadBalancerPublicIpReserved(
  lb: LoadBalancerDetails,
  context: LoadBalancerContextPayload
): boolean {
  if (lb.public_ip_reserved === true) {
    return true;
  }

  const publicIp = getLbPublicIp(lb);
  const reserveIp = normalizeOptionalPublicIp(context.lb_reserve_ip);
  return publicIp !== undefined && reserveIp === publicIp;
}

export function getReservableLoadBalancerPublicIp(
  lb: LoadBalancerDetails,
  lbId: string
): string {
  const publicIp = getLbPublicIp(lb);
  if (publicIp !== undefined && isIPv4(publicIp)) {
    return publicIp;
  }

  throw new CliError(
    `Load balancer ${lbId} does not have a public IPv4 address to reserve.`,
    {
      code: 'LOAD_BALANCER_PUBLIC_IP_MISSING',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatCliCommand(`lb get ${lbId}`)} to inspect the current network state.`
    }
  );
}

export function getLoadBalancerVmId(
  lb: LoadBalancerDetails,
  lbId: string
): number {
  const vmId = lb.node_detail?.vm_id;
  if (typeof vmId === 'number' && Number.isInteger(vmId) && vmId > 0) {
    return vmId;
  }

  throw new CliError(
    `Load balancer ${lbId} did not include the VM ID required to reserve its public IP.`,
    {
      code: 'LOAD_BALANCER_VM_ID_MISSING',
      exitCode: EXIT_CODES.network,
      suggestion: `Run ${formatCliCommand(`lb get ${lbId}`)} to confirm the API response includes node_detail.vm_id.`
    }
  );
}

export function getContextSslCertificateId(
  context: LoadBalancerContextPayload
): number | null {
  const directValue = context.ssl_certificate_id;
  if (typeof directValue === 'number') {
    return directValue;
  }
  const contextValue = context.ssl_context?.['ssl_certificate_id'];
  return typeof contextValue === 'number' ? contextValue : null;
}

export function hasSslCertificate(
  options: LoadBalancerUpdateOptions,
  context: LoadBalancerContextPayload
): boolean {
  return (
    options.sslCertificateId !== undefined ||
    getContextSslCertificateId(context) !== null
  );
}

export function normalizeNodeListType(value: unknown): 'S' | 'D' {
  return value === 'S' ? 'S' : 'D';
}

export function resolveCreateBillingFromPlans(
  plans: LoadBalancerPlan[],
  requestedBasePlan: string,
  options: LoadBalancerCreateBillingSelectionOptions
): ResolvedLoadBalancerCreateBilling {
  assertCreateBillingOptionShape(options);
  const basePlan = findBasePlan(plans, requestedBasePlan);
  if (basePlan === undefined) {
    throw new CliError(
      `Load balancer plan "${requestedBasePlan}" was not found.`,
      {
        code: 'LOAD_BALANCER_PLAN_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('lb plans')} to list valid base plans and committed options.`
      }
    );
  }

  if (
    options.committedPlan === undefined &&
    options.committedPlanId === undefined
  ) {
    if (options.postCommitBehavior !== undefined) {
      throw new CliError(
        '--post-commit-behavior can only be used with --committed-plan or --committed-plan-id.',
        {
          code: 'LOAD_BALANCER_POST_COMMIT_BEHAVIOR_REQUIRES_COMMITTED_PLAN',
          exitCode: EXIT_CODES.usage
        }
      );
    }

    return {
      basePlanName: basePlan.name,
      committedPlanId: null,
      committedPlanName: null,
      postCommitBehavior: null,
      type: 'hourly'
    };
  }

  const committedPlans = basePlan.committed_sku ?? [];
  if (committedPlans.length === 0) {
    throw new CliError(
      `Plan "${basePlan.name}" has no committed load balancer options.`,
      {
        code: 'LOAD_BALANCER_COMMITTED_PLAN_UNAVAILABLE',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('lb plans')} to choose a base plan with committed options.`
      }
    );
  }

  const matchedCommittedPlan =
    options.committedPlanId !== undefined
      ? findCommittedPlanById(committedPlans, options.committedPlanId)
      : findCommittedPlanByName(committedPlans, options.committedPlan ?? '');

  if (matchedCommittedPlan === undefined) {
    const selection =
      options.committedPlanId !== undefined
        ? `ID ${options.committedPlanId}`
        : `"${options.committedPlan}"`;
    throw new CliError(
      `Committed plan ${selection} does not exist for base plan "${basePlan.name}".`,
      {
        code: 'LOAD_BALANCER_COMMITTED_PLAN_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('lb plans --json')} to inspect committed plans for "${basePlan.name}".`
      }
    );
  }

  return {
    basePlanName: basePlan.name,
    committedPlanId: matchedCommittedPlan.committed_sku_id,
    committedPlanName: matchedCommittedPlan.committed_sku_name,
    postCommitBehavior: normalizePostCommitBehavior(options.postCommitBehavior),
    type: 'committed'
  };
}

export function assertCreateBillingOptionShape(
  options: LoadBalancerCreateBillingSelectionOptions
): void {
  const hasCommittedSelector =
    options.committedPlan !== undefined ||
    options.committedPlanId !== undefined;

  if (options.billingType === 'hourly' && hasCommittedSelector) {
    throw new CliError(
      '--billing-type hourly cannot be used with --committed-plan or --committed-plan-id.',
      {
        code: 'BILLING_TYPE_CONFLICT',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Remove --billing-type or change it to --billing-type committed.'
      }
    );
  }

  if (options.billingType === 'committed' && !hasCommittedSelector) {
    throw new CliError(
      '--billing-type committed requires --committed-plan <name> or --committed-plan-id <id>.',
      {
        code: 'COMMITTED_PLAN_SELECTOR_REQUIRED',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('lb plans')} to find committed options for your base plan.`
      }
    );
  }

  if (
    options.committedPlan !== undefined &&
    options.committedPlanId !== undefined
  ) {
    throw new CliError(
      'Choose either --committed-plan or --committed-plan-id, not both.',
      {
        code: 'COMMITTED_PLAN_SELECTOR_CONFLICT',
        exitCode: EXIT_CODES.usage
      }
    );
  }
}

function findBasePlan(
  plans: LoadBalancerPlan[],
  requestedBasePlan: string
): LoadBalancerPlan | undefined {
  const normalizedRequestedPlan = requestedBasePlan.trim().toLowerCase();

  return plans.find((plan) => {
    return (
      plan.name.trim().toLowerCase() === normalizedRequestedPlan ||
      plan.template_id.trim().toLowerCase() === normalizedRequestedPlan
    );
  });
}

function findCommittedPlanById(
  committedPlans: LoadBalancerCommittedPlan[],
  committedPlanId: string
): LoadBalancerCommittedPlan | undefined {
  const normalizedCommittedPlanId = normalizeRequiredNumericId(
    committedPlanId,
    'Committed plan ID',
    '--committed-plan-id'
  );

  return committedPlans.find(
    (plan) => plan.committed_sku_id === normalizedCommittedPlanId
  );
}

function findCommittedPlanByName(
  committedPlans: LoadBalancerCommittedPlan[],
  committedPlanName: string
): LoadBalancerCommittedPlan | undefined {
  const normalizedCommittedPlanName = assertNonEmpty(
    committedPlanName,
    '--committed-plan'
  ).toLowerCase();

  return committedPlans.find(
    (plan) =>
      plan.committed_sku_name.trim().toLowerCase() ===
      normalizedCommittedPlanName
  );
}

function normalizePostCommitBehavior(
  value: string | undefined
): LoadBalancerCommittedStatus {
  if (value === undefined) {
    return LOAD_BALANCER_DEFAULT_POST_COMMIT_BEHAVIOR;
  }

  const normalizedValue = value.trim().toLowerCase().replace(/-/g, '_');
  if (
    normalizedValue === 'auto_renew' ||
    normalizedValue === 'hourly_billing'
  ) {
    return normalizedValue;
  }

  throw new CliError(
    '--post-commit-behavior must be one of: auto-renew, hourly-billing.',
    {
      code: 'INVALID_LOAD_BALANCER_POST_COMMIT_BEHAVIOR',
      exitCode: EXIT_CODES.usage
    }
  );
}
