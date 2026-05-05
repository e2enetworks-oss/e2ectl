import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import { LOAD_BALANCER_DEFAULT_TIMEOUT } from './constants.js';
import {
  normalizeAlbBackendProtocol,
  normalizeExistingMode,
  normalizeNodeListType
} from './normalizers.js';
import type {
  LoadBalancerAclMapRule,
  LoadBalancerAclRule,
  LoadBalancerAlbBackendGroupInput,
  LoadBalancerBackend,
  LoadBalancerBackendGroupMutationResult,
  LoadBalancerBackendGroupUpdatePatch,
  LoadBalancerBackendServerMutationResult,
  LoadBalancerContextAclData,
  LoadBalancerContextPayload,
  LoadBalancerCreatedBackendSummary,
  LoadBalancerCreateRequestInput,
  LoadBalancerCreateRequest,
  LoadBalancerDetails,
  LoadBalancerServer,
  LoadBalancerUpdateRequest,
  LoadBalancerUpdateRequestOverrides,
  ResolvedLoadBalancerMutationContext,
  LoadBalancerTcpBackendGroupInput,
  LoadBalancerTcpBackend,
  LoadBalancerVpc
} from './types/index.js';

export function buildAlbBackendGroup({
  algorithm,
  backendProtocol,
  includeScalerDefaults = false,
  name,
  servers
}: LoadBalancerAlbBackendGroupInput): LoadBalancerBackend {
  return {
    name,
    backend_mode: normalizeAlbBackendProtocol(backendProtocol),
    domain_name: 'localhost',
    balance: algorithm,
    backend_ssl: backendProtocol === 'HTTPS',
    http_check: true,
    check_url: '/',
    servers,
    ...(includeScalerDefaults
      ? {
          scaler_port: null,
          scaler_id: null,
          websocket_timeout: null
        }
      : {})
  };
}

export function buildTcpBackendGroup({
  algorithm,
  name,
  port,
  servers
}: LoadBalancerTcpBackendGroupInput): LoadBalancerTcpBackend {
  return {
    backend_name: name,
    port,
    balance: algorithm,
    servers
  };
}

export function summarizeAlbBackendGroup({
  algorithm,
  backendProtocol,
  name,
  servers
}: LoadBalancerAlbBackendGroupInput): LoadBalancerCreatedBackendSummary {
  return {
    backend_port: null,
    health_check: true,
    name,
    protocol: backendProtocol,
    routing_policy: algorithm,
    servers
  };
}

export function summarizeTcpBackendGroup({
  algorithm,
  name,
  port,
  servers
}: LoadBalancerTcpBackendGroupInput): LoadBalancerCreatedBackendSummary {
  return {
    backend_port: port,
    health_check: null,
    name,
    protocol: 'TCP',
    routing_policy: algorithm,
    servers
  };
}

export function buildLoadBalancerCreateRequest({
  backends,
  billing,
  lbType,
  mode,
  name,
  port,
  reserveIp,
  securityGroupId,
  sslCertificateId,
  tcpBackend,
  vpcList
}: LoadBalancerCreateRequestInput): LoadBalancerCreateRequest {
  return {
    lb_name: name,
    lb_type: lbType,
    lb_mode: mode,
    lb_port: String(port),
    plan_name: billing.basePlanName,
    node_list_type: 'D',
    backends,
    tcp_backend: tcpBackend,
    acl_list: [],
    acl_map: [],
    client_timeout: LOAD_BALANCER_DEFAULT_TIMEOUT,
    server_timeout: LOAD_BALANCER_DEFAULT_TIMEOUT,
    connection_timeout: LOAD_BALANCER_DEFAULT_TIMEOUT,
    http_keep_alive_timeout: LOAD_BALANCER_DEFAULT_TIMEOUT,
    default_backend: '',
    enable_bitninja: false,
    is_ipv6_attached: false,
    lb_reserve_ip: reserveIp,
    ssl_certificate_id: sslCertificateId,
    ssl_context: { redirect_to_https: false },
    vpc_list: vpcList,
    ...(securityGroupId === null ? {} : { security_group_id: securityGroupId }),
    ...(billing.committedPlanId === null
      ? {}
      : {
          cn_id: billing.committedPlanId,
          cn_status: billing.postCommitBehavior
        })
  };
}

export function buildLoadBalancerUpdateRequest(
  lb: LoadBalancerDetails,
  context: LoadBalancerContextPayload,
  overrides: LoadBalancerUpdateRequestOverrides
): LoadBalancerUpdateRequest {
  return {
    lb_name: overrides.lb_name ?? lb.appliance_name,
    lb_type:
      overrides.lb_type ?? normalizeExistingLoadBalancerType(lb, context),
    lb_mode: overrides.lb_mode,
    lb_port: overrides.lb_port,
    plan_name: overrides.plan_name,
    node_list_type: normalizeNodeListType(context.node_list_type),
    backends: overrides.backends,
    tcp_backend: overrides.tcp_backend,
    acl_list: overrides.acl_list,
    acl_map: overrides.acl_map,
    client_timeout: getContextTimeoutValue(
      context,
      'client_timeout',
      LOAD_BALANCER_DEFAULT_TIMEOUT
    ),
    server_timeout: getContextTimeoutValue(
      context,
      'server_timeout',
      LOAD_BALANCER_DEFAULT_TIMEOUT
    ),
    connection_timeout: getContextTimeoutValue(
      context,
      'connection_timeout',
      LOAD_BALANCER_DEFAULT_TIMEOUT
    ),
    http_keep_alive_timeout: getContextTimeoutValue(
      context,
      'http_keep_alive_timeout',
      LOAD_BALANCER_DEFAULT_TIMEOUT
    ),
    ...extractPreservedContextFields(context),
    ...(overrides.lb_reserve_ip === undefined
      ? {}
      : { lb_reserve_ip: overrides.lb_reserve_ip }),
    ...(overrides.ssl_certificate_id === undefined
      ? {}
      : { ssl_certificate_id: overrides.ssl_certificate_id }),
    ...(overrides.ssl_context === undefined
      ? {}
      : { ssl_context: overrides.ssl_context }),
    ...(overrides.vpc_list === undefined
      ? {}
      : { vpc_list: overrides.vpc_list })
  };
}

export function buildLoadBalancerMutationRequest(
  lb: LoadBalancerDetails,
  mutation: ResolvedLoadBalancerMutationContext,
  overrides: Partial<LoadBalancerUpdateRequestOverrides> = {}
): LoadBalancerUpdateRequest {
  const baseOverrides: LoadBalancerUpdateRequestOverrides = {
    acl_list: mutation.aclList,
    acl_map: mutation.aclMap,
    backends: mutation.backends,
    lb_mode: mutation.isNlb ? 'TCP' : normalizeExistingMode(lb.lb_mode, 'HTTP'),
    lb_port: mutation.lbPort,
    plan_name: mutation.planName,
    tcp_backend: mutation.tcpBackends
  };

  return buildLoadBalancerUpdateRequest(lb, mutation.context, {
    ...baseOverrides,
    ...overrides
  });
}

export function resolveLoadBalancerMutationContext(
  lb: LoadBalancerDetails,
  lbId: string
): ResolvedLoadBalancerMutationContext {
  const context = lb.context?.[0];
  if (context === undefined) {
    throw new CliError(
      `Load balancer ${lbId} returned no configuration context.`,
      {
        code: 'LOAD_BALANCER_CONTEXT_MISSING',
        exitCode: EXIT_CODES.network,
        suggestion: `Run ${formatCliCommand(`lb get ${lbId}`)} to inspect current state.`
      }
    );
  }
  const backends = context.backends ?? [];
  const tcpBackends = context.tcp_backend ?? [];
  const isNlb = tcpBackends.length > 0 || lb.lb_mode === 'TCP';
  const { aclList, aclMap } = getContextAclData(context);
  const lbPort = inferLbPort(context.lb_port, lb.lb_mode, tcpBackends);
  const planName = context.plan_name ?? '';
  return {
    aclList,
    aclMap,
    backends,
    context,
    isNlb,
    lbPort,
    planName,
    tcpBackends
  };
}

export function filterAclForRemainingBackends(
  aclList: LoadBalancerAclRule[],
  aclMap: LoadBalancerAclMapRule[],
  backends: LoadBalancerBackend[]
): LoadBalancerContextAclData {
  const backendNames = new Set(backends.map((backend) => backend.name));
  const filteredAclMap = aclMap.filter((rule) =>
    backendNames.has(rule.acl_backend)
  );
  const aclNames = new Set(filteredAclMap.map((rule) => rule.acl_name));

  return {
    aclList: aclList.filter((rule) => aclNames.has(rule.acl_name)),
    aclMap: filteredAclMap
  };
}

export function buildBackendGroupUpdateMutation(
  mutation: ResolvedLoadBalancerMutationContext,
  groupName: string,
  patch: LoadBalancerBackendGroupUpdatePatch
): LoadBalancerBackendGroupMutationResult {
  if (mutation.isNlb) {
    const exists = mutation.tcpBackends.some(
      (group) => group.backend_name === groupName
    );

    return {
      exists,
      lastGroup: false,
      overrides: exists
        ? {
            lb_mode: 'TCP',
            tcp_backend: mutation.tcpBackends.map((group) =>
              group.backend_name === groupName && patch.algorithm !== undefined
                ? { ...group, balance: patch.algorithm }
                : group
            )
          }
        : null
    };
  }

  const exists = mutation.backends.some((group) => group.name === groupName);

  return {
    exists,
    lastGroup: false,
    overrides: exists
      ? {
          backends: mutation.backends.map((group) =>
            group.name === groupName
              ? {
                  ...group,
                  ...(patch.algorithm === undefined
                    ? {}
                    : { balance: patch.algorithm }),
                  ...(patch.backendProtocol === undefined
                    ? {}
                    : {
                        backend_mode: normalizeAlbBackendProtocol(
                          patch.backendProtocol
                        ),
                        backend_ssl: patch.backendProtocol === 'HTTPS'
                      })
                }
              : group
          )
        }
      : null
  };
}

export function buildBackendGroupDeleteMutation(
  mutation: ResolvedLoadBalancerMutationContext,
  groupName: string
): LoadBalancerBackendGroupMutationResult {
  if (mutation.isNlb) {
    const exists = mutation.tcpBackends.some(
      (group) => group.backend_name === groupName
    );
    const lastGroup = exists && mutation.tcpBackends.length <= 1;

    return {
      exists,
      lastGroup,
      overrides:
        exists && !lastGroup
          ? {
              lb_mode: 'TCP',
              tcp_backend: mutation.tcpBackends.filter(
                (group) => group.backend_name !== groupName
              )
            }
          : null
    };
  }

  const exists = mutation.backends.some((group) => group.name === groupName);
  const lastGroup = exists && mutation.backends.length <= 1;
  if (!exists || lastGroup) {
    return { exists, lastGroup, overrides: null };
  }

  const remainingBackends = mutation.backends.filter(
    (group) => group.name !== groupName
  );
  const { aclList, aclMap } = filterAclForRemainingBackends(
    mutation.aclList,
    mutation.aclMap,
    remainingBackends
  );

  return {
    exists,
    lastGroup,
    overrides: {
      acl_list: aclList,
      acl_map: aclMap,
      backends: remainingBackends
    }
  };
}

export function buildBackendServerAddMutation(
  mutation: ResolvedLoadBalancerMutationContext,
  backendGroup: string,
  server: LoadBalancerServer
): LoadBalancerBackendServerMutationResult {
  if (mutation.isNlb) {
    const groupFound = mutation.tcpBackends.some(
      (group) => group.backend_name === backendGroup
    );

    return {
      ambiguous: false,
      groupFound,
      lastServer: false,
      removedServer: null,
      serverFound: true,
      overrides: groupFound
        ? {
            lb_mode: 'TCP',
            tcp_backend: mutation.tcpBackends.map((group) =>
              group.backend_name === backendGroup
                ? { ...group, servers: [...group.servers, server] }
                : group
            )
          }
        : null
    };
  }

  const groupFound = mutation.backends.some(
    (group) => group.name === backendGroup
  );

  return {
    ambiguous: false,
    groupFound,
    lastServer: false,
    removedServer: null,
    serverFound: true,
    overrides: groupFound
      ? {
          backends: mutation.backends.map((group) =>
            group.name === backendGroup
              ? { ...group, servers: [...group.servers, server] }
              : group
          )
        }
      : null
  };
}

export function buildBackendServerDeleteMutation(
  mutation: ResolvedLoadBalancerMutationContext,
  backendGroup: string,
  backendServerName: string
): LoadBalancerBackendServerMutationResult {
  if (mutation.isNlb) {
    const existingGroup = mutation.tcpBackends.find(
      (group) => group.backend_name === backendGroup
    );
    return buildServerDeleteResult(
      existingGroup?.servers,
      (remainingServers) => ({
        lb_mode: 'TCP',
        tcp_backend: mutation.tcpBackends.map((group) =>
          group.backend_name === backendGroup
            ? { ...group, servers: remainingServers }
            : group
        )
      }),
      backendServerName
    );
  }

  const existingGroup = mutation.backends.find(
    (group) => group.name === backendGroup
  );
  return buildServerDeleteResult(
    existingGroup?.servers,
    (remainingServers) => ({
      backends: mutation.backends.map((group) =>
        group.name === backendGroup
          ? { ...group, servers: remainingServers }
          : group
      )
    }),
    backendServerName
  );
}

export function normalizeExistingLoadBalancerType(
  lb: LoadBalancerDetails,
  context: LoadBalancerContextPayload
): LoadBalancerVpc {
  const normalizedLoadBalancerType = lb.lb_type?.trim().toLowerCase();
  if (
    normalizedLoadBalancerType === 'external' ||
    normalizedLoadBalancerType === 'internal'
  ) {
    return normalizedLoadBalancerType;
  }

  return Array.isArray(context.vpc_list) && context.vpc_list.length > 0
    ? 'internal'
    : 'external';
}

function buildServerDeleteResult(
  servers: LoadBalancerServer[] | undefined,
  buildOverrides: (
    remainingServers: LoadBalancerServer[]
  ) => Partial<LoadBalancerUpdateRequestOverrides>,
  backendServerName: string
): LoadBalancerBackendServerMutationResult {
  if (servers === undefined) {
    return emptyBackendServerMutation({ groupFound: false });
  }

  if (servers.length <= 1) {
    return emptyBackendServerMutation({
      groupFound: true,
      lastServer: true,
      serverFound: servers.some(
        (server) => server.backend_name === backendServerName
      )
    });
  }

  const removal = removeServerByName(servers, backendServerName);
  if (removal.ambiguous || !removal.serverFound) {
    return emptyBackendServerMutation({
      ambiguous: removal.ambiguous,
      groupFound: true,
      serverFound: removal.serverFound
    });
  }

  return {
    ambiguous: false,
    groupFound: true,
    lastServer: false,
    removedServer: removal.removedServer,
    serverFound: true,
    overrides: buildOverrides(removal.remainingServers)
  };
}

function emptyBackendServerMutation(
  overrides: Partial<
    Pick<
      LoadBalancerBackendServerMutationResult,
      'ambiguous' | 'groupFound' | 'lastServer' | 'serverFound'
    >
  > = {}
): LoadBalancerBackendServerMutationResult {
  return {
    ambiguous: overrides.ambiguous ?? false,
    groupFound: overrides.groupFound ?? true,
    lastServer: overrides.lastServer ?? false,
    removedServer: null,
    serverFound: overrides.serverFound ?? false,
    overrides: null
  };
}

function removeServerByName(
  servers: LoadBalancerServer[],
  backendServerName: string
):
  | {
      ambiguous: true;
      remainingServers: null;
      removedServer: null;
      serverFound: true;
    }
  | {
      ambiguous: false;
      remainingServers: LoadBalancerServer[];
      removedServer: LoadBalancerServer;
      serverFound: true;
    }
  | {
      ambiguous: false;
      remainingServers: null;
      removedServer: null;
      serverFound: false;
    } {
  const matches = servers.filter(
    (server) => server.backend_name === backendServerName
  );

  if (matches.length === 0) {
    return {
      ambiguous: false,
      remainingServers: null,
      removedServer: null,
      serverFound: false
    };
  }

  if (matches.length > 1) {
    return {
      ambiguous: true,
      remainingServers: null,
      removedServer: null,
      serverFound: true
    };
  }

  const removedServer = matches[0]!;
  let removed = false;
  const remainingServers = servers.filter((server) => {
    if (
      !removed &&
      server.backend_name === removedServer.backend_name &&
      server.backend_ip === removedServer.backend_ip &&
      server.backend_port === removedServer.backend_port
    ) {
      removed = true;
      return false;
    }

    return true;
  });

  return {
    ambiguous: false,
    remainingServers,
    removedServer,
    serverFound: true
  };
}

function getContextAclData(
  context: LoadBalancerContextPayload
): LoadBalancerContextAclData {
  return {
    aclList: context.acl_list ?? [],
    aclMap: context.acl_map ?? []
  };
}

function inferLbPort(
  contextLbPort: string | undefined,
  lbMode: string | undefined,
  tcpBackends: LoadBalancerTcpBackend[]
): string {
  if (contextLbPort !== undefined) return contextLbPort;
  const mode = lbMode?.toUpperCase();
  if (mode === 'HTTPS' || mode === 'BOTH') return '443';
  if (mode === 'TCP') {
    const port = tcpBackends[0]?.port;
    return port !== undefined ? String(port) : '80';
  }
  return '80';
}

function getContextTimeoutValue(
  context: LoadBalancerContextPayload,
  key:
    | 'client_timeout'
    | 'server_timeout'
    | 'connection_timeout'
    | 'http_keep_alive_timeout',
  fallback: number
): number {
  const value = context[key];
  return typeof value === 'number' ? value : fallback;
}

function extractPreservedContextFields(
  context: LoadBalancerContextPayload
): Partial<LoadBalancerUpdateRequest> {
  const preserved: Partial<LoadBalancerUpdateRequest> = {};

  assignIfDefined(preserved, 'cn_id', context.cn_id);
  assignIfDefined(preserved, 'cn_status', context.cn_status);
  assignIfDefined(preserved, 'default_backend', context.default_backend);
  assignIfDefined(preserved, 'enable_bitninja', context.enable_bitninja);
  assignIfDefined(preserved, 'enable_eos_logger', context.enable_eos_logger);
  assignIfDefined(
    preserved,
    'encryption_passphrase',
    context.encryption_passphrase
  );
  assignIfDefined(preserved, 'eos_log_enable', context.eos_log_enable);
  assignIfDefined(preserved, 'host_ids', context.host_ids);
  assignIfDefined(preserved, 'host_target_ipv6', context.host_target_ipv6);
  assignIfDefined(
    preserved,
    'isEncryptionEnabled',
    context.isEncryptionEnabled
  );
  assignIfDefined(preserved, 'is_ipv6_attached', context.is_ipv6_attached);
  assignIfDefined(preserved, 'is_private', context.is_private);
  assignIfDefined(preserved, 'lb_reserve_ip', context.lb_reserve_ip);
  assignIfDefined(preserved, 'maxconn', context.maxconn);
  assignIfDefined(preserved, 'scaler_id', context.scaler_id);
  assignIfDefined(preserved, 'scaler_port', context.scaler_port);
  assignIfDefined(preserved, 'security_group_id', context.security_group_id);
  assignIfDefined(preserved, 'ssl_context', context.ssl_context);
  assignIfDefined(preserved, 'vpc_list', context.vpc_list);
  assignIfDefined(preserved, 'custom_sku', context.custom_sku);

  return preserved;
}

function assignIfDefined<TKey extends keyof LoadBalancerUpdateRequest>(
  target: Partial<LoadBalancerUpdateRequest>,
  key: TKey,
  value: LoadBalancerUpdateRequest[TKey] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
