import { isIPv4 } from 'node:net';

import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { normalizeRequiredNumericId } from '../node/normalizers.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { LoadBalancerClient } from './client.js';
import type {
  LoadBalancerAclMapRule,
  LoadBalancerAclRule,
  LoadBalancerAlgorithm,
  LoadBalancerBackend,
  LoadBalancerCommittedPlan,
  LoadBalancerCommittedStatus,
  LoadBalancerCreateResult,
  LoadBalancerDetails,
  LoadBalancerMode,
  LoadBalancerPlan,
  LoadBalancerServer,
  LoadBalancerSummary,
  LoadBalancerTcpBackend,
  LoadBalancerUpdateRequest,
  LoadBalancerVpcAttachment,
  LoadBalancerVpc
} from './types.js';
import type { VpcClient } from '../vpc/index.js';

export interface LoadBalancerContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface LoadBalancerCreateOptions extends LoadBalancerContextOptions {
  committedPlan?: string;
  committedPlanId?: string;
  name: string;
  plan: string;
  mode: string;
  port: string;
  networkId?: string;
  postCommitBehavior?: string;
  vpc?: string;
  backendName?: string;
  serverIp?: string;
  serverPort?: string;
  serverName?: string;
  algorithm?: string;
  backendProtocol?: string;
  httpCheck?: boolean;
  backendPort?: string;
  securityGroupId?: string;
  sslCertificateId?: string;
}

export interface LoadBalancerDeleteOptions extends LoadBalancerContextOptions {
  force?: boolean;
  reservePublicIp?: boolean;
}

export interface LoadBalancerBackendGroupCreateOptions extends LoadBalancerContextOptions {
  name: string;
  algorithm?: string;
  backendProtocol?: string;
  httpCheck?: boolean;
  backendPort?: string;
  serverIp?: string;
  serverPort?: string;
  serverName?: string;
}

export interface LoadBalancerBackendServerAddOptions extends LoadBalancerContextOptions {
  backendName: string;
  serverIp: string;
  serverPort: string;
  serverName: string;
}

export interface LoadBalancerBackendServerDeleteOptions extends LoadBalancerContextOptions {
  backendName: string;
  serverIp?: string;
  serverName: string;
  serverPort?: string;
}

export interface LoadBalancerListCommandResult {
  action: 'list';
  items: LoadBalancerSummary[];
}

export interface LoadBalancerCreateCommandResult {
  action: 'create';
  billing: {
    committed_plan_id: number | null;
    committed_plan_name: string | null;
    post_commit_behavior: LoadBalancerCommittedStatus | null;
    type: 'committed' | 'hourly';
  };
  backend: LoadBalancerCreatedBackendSummary;
  requested: LoadBalancerRequestedSummary;
  result: LoadBalancerCreateResult;
}

export interface LoadBalancerDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  lb_id: string;
  message?: string;
}

export interface LoadBalancerBackendGroupListCommandResult {
  action: 'backend-group-list';
  lb_id: string;
  lb_mode: string;
  backends: LoadBalancerBackend[];
  tcp_backends: LoadBalancerTcpBackend[];
}

export interface LoadBalancerBackendGroupCreateCommandResult {
  action: 'backend-group-create';
  group: LoadBalancerCreatedBackendSummary;
  lb_id: string;
  message: string;
}

export interface LoadBalancerBackendGroupDeleteCommandResult {
  action: 'backend-group-delete';
  lb_id: string;
  group_name: string;
  message: string;
}

export interface LoadBalancerBackendServerListCommandResult {
  action: 'backend-server-list';
  lb_id: string;
  group_name: string;
  servers: LoadBalancerServer[];
}

export interface LoadBalancerBackendServerAddCommandResult {
  action: 'backend-server-add';
  lb_id: string;
  message: string;
}

export interface LoadBalancerBackendServerDeleteCommandResult {
  action: 'backend-server-delete';
  group_name: string;
  lb_id: string;
  message: string;
  server_name: string;
}

export interface LoadBalancerPlansCommandResult {
  action: 'plans';
  items: LoadBalancerPlan[];
}

export interface LoadBalancerRequestedSummary {
  frontend_port: number;
  mode: LoadBalancerMode;
  name: string;
  plan_name: string;
  type: LoadBalancerVpc;
}

export interface LoadBalancerCreatedBackendSummary {
  backend_port: number | null;
  health_check: boolean | null;
  name: string;
  protocol: 'HTTP' | 'HTTPS' | 'TCP';
  routing_policy: LoadBalancerAlgorithm;
  servers: LoadBalancerServer[];
}

export type LoadBalancerCommandResult =
  | LoadBalancerListCommandResult
  | LoadBalancerCreateCommandResult
  | LoadBalancerDeleteCommandResult
  | LoadBalancerPlansCommandResult
  | LoadBalancerBackendGroupListCommandResult
  | LoadBalancerBackendGroupCreateCommandResult
  | LoadBalancerBackendGroupDeleteCommandResult
  | LoadBalancerBackendServerListCommandResult
  | LoadBalancerBackendServerAddCommandResult
  | LoadBalancerBackendServerDeleteCommandResult;

interface LoadBalancerStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface LoadBalancerServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createLoadBalancerClient(
    credentials: ResolvedCredentials
  ): LoadBalancerClient;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  isInteractive: boolean;
  store: LoadBalancerStore;
}

const DEFAULT_TIMEOUT = 60;
const ALB_MODES: LoadBalancerMode[] = ['HTTP', 'HTTPS', 'BOTH'];
const ALB_BACKEND_PROTOCOLS = ['HTTP', 'HTTPS'] as const;
const DEFAULT_POST_COMMIT_BEHAVIOR: LoadBalancerCommittedStatus = 'auto_renew';

export class LoadBalancerService {
  constructor(private readonly dependencies: LoadBalancerServiceDependencies) {}

  async listLoadBalancers(
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerListCommandResult> {
    const client = await this.createClient(options);
    const items = await client.listLoadBalancers();

    return { action: 'list', items };
  }

  async listPlans(
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerPlansCommandResult> {
    const client = await this.createClient(options);
    const items = await client.listLoadBalancerPlans();

    return { action: 'plans', items };
  }

  async createLoadBalancer(
    options: LoadBalancerCreateOptions
  ): Promise<LoadBalancerCreateCommandResult> {
    const requestedVpcId = options.networkId ?? options.vpc;
    const mode = assertLoadBalancerMode(options.mode);
    const networkId = requestedVpcId
      ? normalizeRequiredNumericId(requestedVpcId, 'Network ID', '--vpc')
      : null;
    const lbType: LoadBalancerVpc =
      networkId !== null ? 'internal' : 'external';
    const port = assertPort(options.port, '--port');
    const algorithm = assertAlgorithm(options.algorithm ?? 'roundrobin');
    const credentials = await this.resolveContext(options);
    const client = this.dependencies.createLoadBalancerClient(credentials);

    const SSL_MODES: LoadBalancerMode[] = ['HTTPS', 'BOTH'];
    const requiresSslCert = (SSL_MODES as string[]).includes(mode);
    if (requiresSslCert && !options.sslCertificateId) {
      throw new CliError(
        `--ssl-certificate-id is required when --mode is ${mode}.`,
        { code: 'MISSING_SSL_CERTIFICATE_ID', exitCode: EXIT_CODES.usage }
      );
    }
    const sslCertificateId = requiresSslCert
      ? normalizeRequiredNumericId(
          options.sslCertificateId!,
          'SSL certificate ID',
          '--ssl-certificate-id'
        )
      : null;

    const isAlb = (ALB_MODES as string[]).includes(mode);
    const albBackendProtocol = isAlb
      ? assertAlbBackendProtocol(options.backendProtocol)
      : null;

    const backends: LoadBalancerBackend[] = [];
    const tcpBackend: LoadBalancerTcpBackend[] = [];
    let backendSummary: LoadBalancerCreatedBackendSummary;

    {
      const serverPort = assertPort(
        options.serverPort ?? options.port,
        '--server-port'
      );
      const serverIp = assertServerIp(options.serverIp!);
      const serverName = assertNonEmpty(options.serverName!, '--server-name');
      const server: LoadBalancerServer = {
        backend_name: serverName,
        backend_ip: serverIp,
        backend_port: serverPort
      };

      if (isAlb) {
        backends.push({
          target: 'networkMappingNode',
          name: options.backendName!,
          backend_mode: normalizeAlbBackendProtocol(albBackendProtocol!),
          domain_name: 'localhost',
          balance: algorithm,
          backend_ssl: albBackendProtocol === 'HTTPS',
          http_check: options.httpCheck ?? false,
          check_url: '/',
          servers: [{ ...server, target: 'backend' }],
          checkbox_enable: true,
          scaler_port: null,
          scaler_id: null,
          websocket_timeout: null
        });
        backendSummary = {
          backend_port: null,
          health_check: options.httpCheck ?? false,
          name: options.backendName!,
          protocol: albBackendProtocol!,
          routing_policy: algorithm,
          servers: [server]
        };
      } else {
        const backendPort = assertPort(
          options.backendPort ?? options.serverPort ?? options.port,
          '--backend-port'
        );
        tcpBackend.push({
          backend_name: options.backendName!,
          port: backendPort,
          balance: algorithm,
          servers: [{ ...server, target: 'backend' }]
        });
        backendSummary = {
          backend_port: backendPort,
          health_check: null,
          name: options.backendName!,
          protocol: 'TCP',
          routing_policy: algorithm,
          servers: [server]
        };
      }
    }

    const billing = await resolveCreateBillingSelection(client, options.plan, {
      ...(options.committedPlan === undefined
        ? {}
        : { committedPlan: options.committedPlan }),
      ...(options.committedPlanId === undefined
        ? {}
        : { committedPlanId: options.committedPlanId }),
      ...(options.postCommitBehavior === undefined
        ? {}
        : { postCommitBehavior: options.postCommitBehavior })
    });
    const vpcList =
      networkId === null
        ? undefined
        : [
            await resolveVpcAttachment(
              this.dependencies.createVpcClient(credentials),
              networkId
            )
          ];

    const securityGroupId =
      options.securityGroupId !== undefined &&
      options.securityGroupId.trim().length > 0
        ? normalizeRequiredNumericId(
            options.securityGroupId,
            'Security group ID',
            '--security-group'
          )
        : null;

    const result = await client.createLoadBalancer({
      lb_name: assertNonEmpty(options.name, '--name'),
      lb_type: lbType,
      lb_mode: mode,
      lb_port: String(port),
      plan_name: billing.basePlanName ?? assertNonEmpty(options.plan, '--plan'),
      node_list_type: 'D',
      backends,
      tcp_backend: tcpBackend,
      acl_list: [],
      acl_map: [],
      client_timeout: DEFAULT_TIMEOUT,
      server_timeout: DEFAULT_TIMEOUT,
      connection_timeout: DEFAULT_TIMEOUT,
      http_keep_alive_timeout: DEFAULT_TIMEOUT,
      checkbox_enable: '',
      default_backend: '',
      enable_bitninja: false,
      is_ipv6_attached: false,
      lb_reserve_ip: '',
      ssl_certificate_id: sslCertificateId,
      ssl_context: { redirect_to_https: false },
      vpc_list: vpcList ?? [],
      ...(securityGroupId === null
        ? {}
        : { security_group_id: securityGroupId }),
      ...(billing.committedPlanId === null
        ? {}
        : {
            cn_id: billing.committedPlanId,
            cn_status: billing.postCommitBehavior
          })
    });

    return {
      action: 'create',
      backend: backendSummary!,
      billing: {
        committed_plan_id: billing.committedPlanId,
        committed_plan_name: billing.committedPlanName,
        post_commit_behavior: billing.postCommitBehavior,
        type: billing.type
      },
      requested: {
        frontend_port: port,
        mode,
        name: assertNonEmpty(options.name, '--name'),
        plan_name:
          billing.basePlanName ?? assertNonEmpty(options.plan, '--plan'),
        type: lbType
      },
      result
    };
  }

  async deleteLoadBalancer(
    lbId: string,
    options: LoadBalancerDeleteOptions
  ): Promise<LoadBalancerDeleteCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const client = await this.createClient(options);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete load balancer ${lbId}? This cannot be undone.`
      );

      if (!confirmed) {
        return { action: 'delete', cancelled: true, lb_id: lbId };
      }
    }
    const result = await client.deleteLoadBalancer(
      lbId,
      options.reservePublicIp ? { reserve_ip_required: 'true' } : undefined
    );

    return {
      action: 'delete',
      cancelled: false,
      lb_id: lbId,
      message: result.message
    };
  }

  async listBackendGroups(
    lbId: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerBackendGroupListCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const context = lb.context?.[0];

    return {
      action: 'backend-group-list',
      lb_id: lbId,
      lb_mode: lb.lb_mode ?? 'unknown',
      backends: context?.backends ?? [],
      tcp_backends: context?.tcp_backend ?? []
    };
  }

  async createBackendGroup(
    lbId: string,
    options: LoadBalancerBackendGroupCreateOptions
  ): Promise<LoadBalancerBackendGroupCreateCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const algorithm = assertAlgorithm(options.algorithm ?? 'roundrobin');

    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const {
      aclList: existingAclList,
      aclMap: existingAclMap,
      backends: currentBackends,
      context,
      isNlb,
      lbPort,
      planName,
      tcpBackends: currentTcpBackends
    } = resolveLoadBalancerMutationContext(lb, lbId);

    const albBackendProtocol = isNlb
      ? null
      : assertAlbBackendProtocol(options.backendProtocol);

    // NLB guard: only one backend group allowed
    if (isNlb && currentTcpBackends.length > 0) {
      throw new CliError(
        `NLB ${lbId} already has a backend group. NLB supports only one backend group.`,
        {
          code: 'NLB_SINGLE_BACKEND_GROUP',
          exitCode: EXIT_CODES.usage,
          suggestion: `Use ${formatCliCommand(`load-balancer backend server add ${lbId}`)} to add a server to the existing group.`
        }
      );
    }

    // ALB guard: group name must be unique
    if (!isNlb && currentBackends.some((g) => g.name === options.name)) {
      throw new CliError(
        `Backend group "${options.name}" already exists on load balancer ${lbId}. Use \`backend server add\` to add a server to it.`,
        {
          code: 'BACKEND_GROUP_EXISTS',
          exitCode: EXIT_CODES.usage,
          suggestion: `Use ${formatCliCommand(`load-balancer backend server add ${lbId}`)} to add a server to the existing group.`
        }
      );
    }

    // Build initial server list (optional)
    const servers: LoadBalancerServer[] = [];
    if (options.serverIp !== undefined && options.serverIp.trim().length > 0) {
      if (
        options.serverName === undefined ||
        options.serverName.trim().length === 0
      ) {
        throw new CliError(
          '--server-name is required when --server-ip is set.',
          {
            code: 'MISSING_SERVER_NAME',
            exitCode: EXIT_CODES.usage
          }
        );
      }
      const serverIp = assertServerIp(options.serverIp);
      const serverPort = assertPort(
        options.serverPort ?? lbPort,
        '--server-port'
      );
      servers.push({
        backend_name: options.serverName,
        backend_ip: serverIp,
        backend_port: serverPort
      });
    }

    if (isNlb) {
      // For NLB: backendPort is required (use backendPort ?? serverPort)
      const backendPort = assertPort(
        options.backendPort ?? options.serverPort ?? lbPort,
        '--backend-port'
      );
      const newTcpGroup: LoadBalancerTcpBackend = {
        backend_name: options.name,
        port: backendPort,
        balance: algorithm,
        servers
      };

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: existingAclList,
          acl_map: existingAclMap,
          backends: currentBackends,
          lb_mode: 'TCP',
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: [...currentTcpBackends, newTcpGroup]
        })
      );

      return {
        action: 'backend-group-create',
        group: {
          backend_port: backendPort,
          health_check: null,
          name: options.name,
          protocol: 'TCP',
          routing_policy: algorithm,
          servers
        },
        lb_id: lbId,
        message: `Backend group "${options.name}" created.`
      };
    } else {
      const newAlbGroup: LoadBalancerBackend = {
        name: options.name,
        domain_name: 'localhost',
        backend_mode: normalizeAlbBackendProtocol(albBackendProtocol!),
        balance: algorithm,
        backend_ssl: albBackendProtocol === 'HTTPS',
        http_check: options.httpCheck ?? false,
        check_url: '/',
        servers
      };

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: existingAclList,
          acl_map: existingAclMap,
          backends: [...currentBackends, newAlbGroup],
          lb_mode: normalizeExistingMode(lb.lb_mode, 'HTTP'),
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: currentTcpBackends
        })
      );
      return {
        action: 'backend-group-create',
        group: {
          backend_port: null,
          health_check: options.httpCheck ?? false,
          name: options.name,
          protocol: albBackendProtocol!,
          routing_policy: algorithm,
          servers
        },
        lb_id: lbId,
        message: `Backend group "${options.name}" created.`
      };
    }
  }

  async deleteBackendGroup(
    lbId: string,
    groupName: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerBackendGroupDeleteCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const {
      aclList: existingAclList,
      aclMap: existingAclMap,
      backends: currentBackends,
      context,
      isNlb,
      lbPort,
      planName,
      tcpBackends: currentTcpBackends
    } = resolveLoadBalancerMutationContext(lb, lbId);

    if (isNlb) {
      const exists = currentTcpBackends.some(
        (g) => g.backend_name === groupName
      );
      if (!exists) {
        throw new CliError(
          `Backend group "${groupName}" not found on load balancer ${lbId}.`,
          { code: 'BACKEND_GROUP_NOT_FOUND', exitCode: EXIT_CODES.usage }
        );
      }

      if (currentTcpBackends.length <= 1) {
        throw new CliError(
          `Backend group "${groupName}" is the last backend group on load balancer ${lbId}. Keep at least one backend group attached.`,
          {
            code: 'LAST_BACKEND_GROUP_NOT_DELETABLE',
            exitCode: EXIT_CODES.usage,
            suggestion: `Delete load balancer ${lbId} instead if you want to remove the final backend group.`
          }
        );
      }

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: existingAclList,
          acl_map: existingAclMap,
          backends: currentBackends,
          lb_mode: 'TCP',
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: currentTcpBackends.filter(
            (g) => g.backend_name !== groupName
          )
        })
      );
    } else {
      const exists = currentBackends.some((g) => g.name === groupName);
      if (!exists) {
        throw new CliError(
          `Backend group "${groupName}" not found on load balancer ${lbId}.`,
          { code: 'BACKEND_GROUP_NOT_FOUND', exitCode: EXIT_CODES.usage }
        );
      }

      if (currentBackends.length <= 1) {
        throw new CliError(
          `Backend group "${groupName}" is the last backend group on load balancer ${lbId}. Keep at least one backend group attached.`,
          {
            code: 'LAST_BACKEND_GROUP_NOT_DELETABLE',
            exitCode: EXIT_CODES.usage,
            suggestion: `Delete load balancer ${lbId} instead if you want to remove the final backend group.`
          }
        );
      }

      const remainingBackends = currentBackends.filter(
        (g) => g.name !== groupName
      );
      const { aclList: filteredAclList, aclMap: filteredAclMap } =
        filterAclForRemainingBackends(
          existingAclList,
          existingAclMap,
          remainingBackends
        );

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: filteredAclList,
          acl_map: filteredAclMap,
          backends: remainingBackends,
          lb_mode: normalizeExistingMode(lb.lb_mode, 'HTTP'),
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: currentTcpBackends
        })
      );
    }

    return {
      action: 'backend-group-delete',
      lb_id: lbId,
      group_name: groupName,
      message: `Backend group "${groupName}" deleted.`
    };
  }

  async listBackendServers(
    lbId: string,
    groupName: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerBackendServerListCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const context = lb.context?.[0];

    const currentBackends = context?.backends ?? [];
    const currentTcpBackends = context?.tcp_backend ?? [];
    const isNlb = currentTcpBackends.length > 0 || lb.lb_mode === 'TCP';

    let servers: LoadBalancerServer[];

    if (isNlb) {
      const group = currentTcpBackends.find(
        (g) => g.backend_name === groupName
      );
      if (group === undefined) {
        throw new CliError(
          `Backend group "${groupName}" not found on load balancer ${lbId}.`,
          { code: 'BACKEND_GROUP_NOT_FOUND', exitCode: EXIT_CODES.usage }
        );
      }
      servers = group.servers;
    } else {
      const group = currentBackends.find((g) => g.name === groupName);
      if (group === undefined) {
        throw new CliError(
          `Backend group "${groupName}" not found on load balancer ${lbId}.`,
          { code: 'BACKEND_GROUP_NOT_FOUND', exitCode: EXIT_CODES.usage }
        );
      }
      servers = group.servers;
    }

    return {
      action: 'backend-server-list',
      lb_id: lbId,
      group_name: groupName,
      servers
    };
  }

  async addBackendServer(
    lbId: string,
    options: LoadBalancerBackendServerAddOptions
  ): Promise<LoadBalancerBackendServerAddCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const serverPort = assertPort(options.serverPort, '--server-port');
    const serverIp = assertServerIp(options.serverIp);

    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const {
      aclList: existingAclList,
      aclMap: existingAclMap,
      backends: currentBackends,
      context,
      isNlb,
      lbPort,
      planName,
      tcpBackends: currentTcpBackends
    } = resolveLoadBalancerMutationContext(lb, lbId);

    const server: LoadBalancerServer = {
      backend_name: options.serverName,
      backend_ip: serverIp,
      backend_port: serverPort
    };

    if (isNlb) {
      const existingGroup = currentTcpBackends.find(
        (g) => g.backend_name === options.backendName
      );

      if (existingGroup === undefined) {
        throw new CliError(
          `Backend group "${options.backendName}" not found on load balancer ${lbId}.`,
          {
            code: 'BACKEND_GROUP_NOT_FOUND',
            exitCode: EXIT_CODES.usage,
            suggestion: `Use ${formatCliCommand(`load-balancer backend group create ${lbId}`)} to create a new backend group.`
          }
        );
      }

      const updatedTcpBackends = currentTcpBackends.map((g) =>
        g.backend_name === options.backendName
          ? { ...g, servers: [...g.servers, server] }
          : g
      );

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: existingAclList,
          acl_map: existingAclMap,
          backends: currentBackends,
          lb_mode: 'TCP',
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: updatedTcpBackends
        })
      );
    } else {
      const existingGroup = currentBackends.find(
        (g) => g.name === options.backendName
      );

      if (existingGroup === undefined) {
        throw new CliError(
          `Backend group "${options.backendName}" not found on load balancer ${lbId}.`,
          {
            code: 'BACKEND_GROUP_NOT_FOUND',
            exitCode: EXIT_CODES.usage,
            suggestion: `Use ${formatCliCommand(`load-balancer backend group create ${lbId}`)} to create a new backend group.`
          }
        );
      }

      const updatedBackends = currentBackends.map((g) =>
        g.name === options.backendName
          ? { ...g, servers: [...g.servers, server] }
          : g
      );

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: existingAclList,
          acl_map: existingAclMap,
          backends: updatedBackends,
          lb_mode: normalizeExistingMode(lb.lb_mode, 'HTTP'),
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: currentTcpBackends
        })
      );
    }

    return {
      action: 'backend-server-add',
      lb_id: lbId,
      message: `Server "${options.serverName}" added to backend group "${options.backendName}".`
    };
  }

  async deleteBackendServer(
    lbId: string,
    options: LoadBalancerBackendServerDeleteOptions
  ): Promise<LoadBalancerBackendServerDeleteCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const serverPort =
      options.serverPort === undefined
        ? undefined
        : assertPort(options.serverPort, '--server-port');
    const serverIp =
      options.serverIp === undefined
        ? undefined
        : assertServerIp(options.serverIp);

    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const {
      aclList: existingAclList,
      aclMap: existingAclMap,
      backends: currentBackends,
      context,
      isNlb,
      lbPort,
      planName,
      tcpBackends: currentTcpBackends
    } = resolveLoadBalancerMutationContext(lb, lbId);

    if (isNlb) {
      const existingGroup = currentTcpBackends.find(
        (g) => g.backend_name === options.backendName
      );

      if (existingGroup === undefined) {
        throw new CliError(
          `Backend group "${options.backendName}" not found on load balancer ${lbId}.`,
          {
            code: 'BACKEND_GROUP_NOT_FOUND',
            exitCode: EXIT_CODES.usage,
            suggestion: `Use ${formatCliCommand(`load-balancer backend group create ${lbId}`)} to create a new backend group.`
          }
        );
      }

      if (existingGroup.servers.length <= 1) {
        throw new CliError(
          `Server "${options.serverName}" is the last server in backend group "${options.backendName}". Keep at least one server attached.`,
          {
            code: 'LAST_BACKEND_SERVER_NOT_DELETABLE',
            exitCode: EXIT_CODES.usage,
            suggestion: `Add another server to backend group "${options.backendName}" before removing "${options.serverName}".`
          }
        );
      }

      const { remainingServers, removedServer } = removeServerFromGroup(
        existingGroup.servers,
        options.serverName,
        serverIp,
        serverPort,
        lbId,
        options.backendName
      );

      const updatedTcpBackends = currentTcpBackends.map((g) =>
        g.backend_name === options.backendName
          ? { ...g, servers: remainingServers }
          : g
      );

      await client.updateLoadBalancer(
        lbId,
        buildLoadBalancerUpdateRequest(lb, context, {
          acl_list: existingAclList,
          acl_map: existingAclMap,
          backends: currentBackends,
          lb_mode: 'TCP',
          lb_port: lbPort,
          plan_name: planName,
          tcp_backend: updatedTcpBackends
        })
      );

      return {
        action: 'backend-server-delete',
        group_name: options.backendName,
        lb_id: lbId,
        message: `Server "${removedServer.backend_name}" deleted from backend group "${options.backendName}".`,
        server_name: removedServer.backend_name
      };
    }

    const existingGroup = currentBackends.find(
      (g) => g.name === options.backendName
    );

    if (existingGroup === undefined) {
      throw new CliError(
        `Backend group "${options.backendName}" not found on load balancer ${lbId}.`,
        {
          code: 'BACKEND_GROUP_NOT_FOUND',
          exitCode: EXIT_CODES.usage,
          suggestion: `Use ${formatCliCommand(`load-balancer backend group create ${lbId}`)} to create a new backend group.`
        }
      );
    }

    if (existingGroup.servers.length <= 1) {
      throw new CliError(
        `Server "${options.serverName}" is the last server in backend group "${options.backendName}". Keep at least one server attached.`,
        {
          code: 'LAST_BACKEND_SERVER_NOT_DELETABLE',
          exitCode: EXIT_CODES.usage,
          suggestion: `Add another server to backend group "${options.backendName}" before removing "${options.serverName}".`
        }
      );
    }

    const { remainingServers, removedServer } = removeServerFromGroup(
      existingGroup.servers,
      options.serverName,
      serverIp,
      serverPort,
      lbId,
      options.backendName
    );

    const updatedBackends = currentBackends.map((g) =>
      g.name === options.backendName ? { ...g, servers: remainingServers } : g
    );

    await client.updateLoadBalancer(
      lbId,
      buildLoadBalancerUpdateRequest(lb, context, {
        acl_list: existingAclList,
        acl_map: existingAclMap,
        backends: updatedBackends,
        lb_mode: normalizeExistingMode(lb.lb_mode, 'HTTP'),
        lb_port: lbPort,
        plan_name: planName,
        tcp_backend: currentTcpBackends
      })
    );

    return {
      action: 'backend-server-delete',
      group_name: options.backendName,
      lb_id: lbId,
      message: `Server "${removedServer.backend_name}" deleted from backend group "${options.backendName}".`,
      server_name: removedServer.backend_name
    };
  }

  private async createClient(
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerClient> {
    return this.dependencies.createLoadBalancerClient(
      await this.resolveContext(options)
    );
  }

  private async resolveContext(
    options: LoadBalancerContextOptions
  ): Promise<ResolvedCredentials> {
    return await resolveStoredCredentials(this.dependencies.store, options);
  }
}

interface LoadBalancerCreateBillingSelectionOptions {
  committedPlan?: string;
  committedPlanId?: string;
  postCommitBehavior?: string;
}

interface ResolvedLoadBalancerCreateBilling {
  basePlanName: string | null;
  committedPlanId: number | null;
  committedPlanName: string | null;
  postCommitBehavior: LoadBalancerCommittedStatus | null;
  type: 'committed' | 'hourly';
}

type LoadBalancerContextPayload = NonNullable<
  LoadBalancerDetails['context']
>[number];

interface LoadBalancerContextAclData {
  aclList: LoadBalancerAclRule[];
  aclMap: LoadBalancerAclMapRule[];
}

async function resolveCreateBillingSelection(
  client: LoadBalancerClient,
  requestedBasePlan: string,
  options: LoadBalancerCreateBillingSelectionOptions
): Promise<ResolvedLoadBalancerCreateBilling> {
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
      basePlanName: null,
      committedPlanId: null,
      committedPlanName: null,
      postCommitBehavior: null,
      type: 'hourly'
    };
  }

  const plans = await client.listLoadBalancerPlans();
  const basePlan = findBasePlan(plans, requestedBasePlan);
  if (basePlan === undefined) {
    throw new CliError(
      `Load balancer plan "${requestedBasePlan}" was not found.`,
      {
        code: 'LOAD_BALANCER_PLAN_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('load-balancer plans')} to list valid base plans and committed options.`
      }
    );
  }

  const committedPlans = basePlan.committed_sku ?? [];
  if (committedPlans.length === 0) {
    throw new CliError(
      `Plan "${basePlan.name}" has no committed load balancer options.`,
      {
        code: 'LOAD_BALANCER_COMMITTED_PLAN_UNAVAILABLE',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('load-balancer plans')} to choose a base plan with committed options.`
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
        suggestion: `Run ${formatCliCommand('load-balancer plans --json')} to inspect committed plans for "${basePlan.name}".`
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
    return DEFAULT_POST_COMMIT_BEHAVIOR;
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

async function resolveVpcAttachment(
  client: VpcClient,
  vpcId: number
): Promise<LoadBalancerVpcAttachment> {
  const vpc = await client.getVpc(vpcId);

  return {
    ipv4_cidr: vpc.ipv4_cidr,
    network_id: vpc.network_id,
    vpc_name: vpc.name
  };
}

function buildLoadBalancerUpdateRequest(
  lb: LoadBalancerDetails,
  context: LoadBalancerContextPayload,
  overrides: Pick<
    LoadBalancerUpdateRequest,
    | 'acl_list'
    | 'acl_map'
    | 'backends'
    | 'lb_mode'
    | 'lb_port'
    | 'plan_name'
    | 'tcp_backend'
  >
): LoadBalancerUpdateRequest {
  return {
    lb_name: lb.appliance_name,
    lb_type: normalizeExistingLoadBalancerType(lb, context),
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
      DEFAULT_TIMEOUT
    ),
    server_timeout: getContextTimeoutValue(
      context,
      'server_timeout',
      DEFAULT_TIMEOUT
    ),
    connection_timeout: getContextTimeoutValue(
      context,
      'connection_timeout',
      DEFAULT_TIMEOUT
    ),
    http_keep_alive_timeout: getContextTimeoutValue(
      context,
      'http_keep_alive_timeout',
      DEFAULT_TIMEOUT
    ),
    ...extractPreservedContextFields(context)
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

interface ResolvedLoadBalancerMutationContext {
  aclList: LoadBalancerAclRule[];
  aclMap: LoadBalancerAclMapRule[];
  backends: LoadBalancerBackend[];
  context: LoadBalancerContextPayload;
  isNlb: boolean;
  lbPort: string;
  planName: string;
  tcpBackends: LoadBalancerTcpBackend[];
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

function resolveLoadBalancerMutationContext(
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
        suggestion: `Run ${formatCliCommand(`load-balancer backend group list ${lbId}`)} to inspect current state.`
      }
    );
  }
  const backends = context.backends ?? [];
  const tcpBackends = context.tcp_backend ?? [];
  const isNlb = tcpBackends.length > 0 || lb.lb_mode === 'TCP';
  const { aclList, aclMap } = getContextAclData(context);
  const ctx = context as { lb_port?: string; plan_name?: string };
  const lbPort = inferLbPort(ctx.lb_port, lb.lb_mode, tcpBackends);
  const planName = ctx.plan_name ?? '';
  return { aclList, aclMap, backends, context, isNlb, lbPort, planName, tcpBackends };
}

function filterAclForRemainingBackends(
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

function removeServerFromGroup(
  servers: LoadBalancerServer[],
  serverName: string,
  serverIp: string | undefined,
  serverPort: number | undefined,
  lbId: string,
  backendName: string
): {
  remainingServers: LoadBalancerServer[];
  removedServer: LoadBalancerServer;
} {
  const matches = servers.filter((server) => {
    return (
      server.backend_name === serverName &&
      (serverIp === undefined || server.backend_ip === serverIp) &&
      (serverPort === undefined || server.backend_port === serverPort)
    );
  });

  if (matches.length === 0) {
    throw new CliError(
      `Server "${serverName}" was not found in backend group "${backendName}" on load balancer ${lbId}.`,
      {
        code: 'BACKEND_SERVER_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand(`load-balancer backend server list ${lbId} ${backendName}`)} to inspect the current servers.`
      }
    );
  }

  if (matches.length > 1) {
    throw new CliError(
      `Multiple servers named "${serverName}" were found in backend group "${backendName}".`,
      {
        code: 'BACKEND_SERVER_AMBIGUOUS',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Retry with --server-ip and, if needed, --server-port to target one server exactly.'
      }
    );
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

  return { remainingServers, removedServer };
}

function normalizeExistingLoadBalancerType(
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

function normalizeExistingMode(
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

function normalizeNodeListType(value: unknown): 'S' | 'D' {
  return value === 'S' ? 'S' : 'D';
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

function assertLoadBalancerMode(mode: string): LoadBalancerMode {
  const valid: LoadBalancerMode[] = ['HTTP', 'HTTPS', 'BOTH', 'TCP'];
  const upper = mode.toUpperCase() as LoadBalancerMode;

  if (!valid.includes(upper)) {
    throw new CliError(
      `Invalid --mode "${mode}". Must be one of: ${valid.join(', ')}.`,
      {
        code: 'INVALID_LB_MODE',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return upper;
}

function assertAlgorithm(algorithm: string): LoadBalancerAlgorithm {
  const valid: LoadBalancerAlgorithm[] = ['source', 'roundrobin', 'leastconn'];
  const lower = algorithm.toLowerCase() as LoadBalancerAlgorithm;

  if (!valid.includes(lower)) {
    throw new CliError(
      `Invalid --algorithm "${algorithm}". Must be one of: ${valid.join(', ')}.`,
      {
        code: 'INVALID_LB_ALGORITHM',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return lower;
}

function assertAlbBackendProtocol(
  protocol: string | undefined
): (typeof ALB_BACKEND_PROTOCOLS)[number] {
  const normalized = (protocol ?? 'HTTP').trim().toUpperCase();

  if (
    (ALB_BACKEND_PROTOCOLS as readonly string[]).includes(normalized) === false
  ) {
    throw new CliError(
      `Invalid --backend-protocol "${protocol}". Must be one of: ${ALB_BACKEND_PROTOCOLS.join(', ')}.`,
      {
        code: 'INVALID_LB_BACKEND_PROTOCOL',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return normalized as (typeof ALB_BACKEND_PROTOCOLS)[number];
}

function normalizeAlbBackendProtocol(
  protocol: (typeof ALB_BACKEND_PROTOCOLS)[number]
): 'http' | 'https' {
  return protocol === 'HTTPS' ? 'https' : 'http';
}

function assertPort(port: string, flag: string): number {
  const num = Number(port);

  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new CliError(`${flag} must be an integer between 1 and 65535.`, {
      code: 'INVALID_PORT',
      exitCode: EXIT_CODES.usage
    });
  }

  return num;
}

function assertServerIp(ip: string): string {
  const trimmed = ip.trim();

  if (trimmed.length === 0) {
    throw new CliError('--server-ip is required.', {
      code: 'MISSING_SERVER_IP',
      exitCode: EXIT_CODES.usage
    });
  }

  if (!isIPv4(trimmed)) {
    throw new CliError(
      `--server-ip "${trimmed}" is not a valid IPv4 address.`,
      { code: 'INVALID_SERVER_IP', exitCode: EXIT_CODES.usage }
    );
  }

  return trimmed;
}

function assertNonEmpty(value: string, flag: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new CliError(`${flag} is required.`, {
      code: 'MISSING_REQUIRED_OPTION',
      exitCode: EXIT_CODES.usage
    });
  }

  return trimmed;
}

function assertCanDelete(isInteractive: boolean): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(
    'Deleting a load balancer requires confirmation in an interactive terminal.',
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}
