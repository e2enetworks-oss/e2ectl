import { isIPv4 } from 'node:net';

import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { LoadBalancerClient } from './client.js';
import type {
  LoadBalancerAlgorithm,
  LoadBalancerBackend,
  LoadBalancerCreateResult,
  LoadBalancerMode,
  LoadBalancerServer,
  LoadBalancerSummary,
  LoadBalancerTcpBackend,
  LoadBalancerType
} from './types.js';

export interface LoadBalancerContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface LoadBalancerCreateOptions extends LoadBalancerContextOptions {
  name: string;
  plan: string;
  mode: string;
  port: string;
  type?: string;
  backendName?: string;
  serverIp?: string;
  serverPort?: string;
  serverName?: string;
  algorithm?: string;
  domainName?: string;
  httpCheck?: boolean;
  checkUrl?: string;
  backendPort?: string;
}

export interface LoadBalancerDeleteOptions extends LoadBalancerContextOptions {
  force?: boolean;
  reservePublicIp?: boolean;
}

export interface LoadBalancerBackendAddOptions
  extends LoadBalancerContextOptions {
  backendName: string;
  serverIp: string;
  serverPort: string;
  serverName: string;
  domainName?: string;
  algorithm?: string;
  httpCheck?: boolean;
  checkUrl?: string;
  backendPort?: string;
}

export interface LoadBalancerListCommandResult {
  action: 'list';
  items: LoadBalancerSummary[];
}

export interface LoadBalancerCreateCommandResult {
  action: 'create';
  result: LoadBalancerCreateResult;
}

export interface LoadBalancerDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  lb_id: string;
  message?: string;
}

export interface LoadBalancerBackendListCommandResult {
  action: 'backend-list';
  lb_id: string;
  lb_mode: string;
  backends: LoadBalancerBackend[];
  tcp_backends: LoadBalancerTcpBackend[];
}

export interface LoadBalancerBackendAddCommandResult {
  action: 'backend-add';
  lb_id: string;
  message: string;
}

export type LoadBalancerCommandResult =
  | LoadBalancerListCommandResult
  | LoadBalancerCreateCommandResult
  | LoadBalancerDeleteCommandResult
  | LoadBalancerBackendListCommandResult
  | LoadBalancerBackendAddCommandResult;

interface LoadBalancerStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface LoadBalancerServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createLoadBalancerClient(
    credentials: ResolvedCredentials
  ): LoadBalancerClient;
  isInteractive: boolean;
  store: LoadBalancerStore;
}

const DEFAULT_TIMEOUT = 60;
const ALB_MODES: LoadBalancerMode[] = ['HTTP', 'HTTPS', 'BOTH'];

export class LoadBalancerService {
  constructor(
    private readonly dependencies: LoadBalancerServiceDependencies
  ) {}

  async listLoadBalancers(
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerListCommandResult> {
    const client = await this.createClient(options);
    const items = await client.listLoadBalancers();

    return { action: 'list', items };
  }

  async createLoadBalancer(
    options: LoadBalancerCreateOptions
  ): Promise<LoadBalancerCreateCommandResult> {
    const mode = assertLoadBalancerMode(options.mode);
    const lbType = assertLoadBalancerType(options.type ?? 'external');
    const port = assertPort(options.port, '--port');
    const algorithm = assertAlgorithm(options.algorithm ?? 'roundrobin');

    const client = await this.createClient(options);

    const isAlb = (ALB_MODES as string[]).includes(mode);

    const backends: LoadBalancerBackend[] = [];
    const tcpBackend: LoadBalancerTcpBackend[] = [];

    if (options.backendName !== undefined) {
      if (options.serverIp === undefined || options.serverIp.trim().length === 0) {
        throw new CliError(
          '--server-ip is required when --backend-name is set.',
          { code: 'MISSING_SERVER_IP', exitCode: EXIT_CODES.usage }
        );
      }
      if (options.serverName === undefined || options.serverName.trim().length === 0) {
        throw new CliError(
          '--server-name is required when --backend-name is set.',
          { code: 'MISSING_SERVER_NAME', exitCode: EXIT_CODES.usage }
        );
      }

      const serverPort = assertPort(
        options.serverPort ?? options.port,
        '--server-port'
      );
      const serverIp = assertServerIp(options.serverIp);
      const serverName = assertNonEmpty(options.serverName, '--server-name');
      const server: LoadBalancerServer = {
        backend_name: serverName,
        backend_ip: serverIp,
        backend_port: serverPort
      };

      if (isAlb) {
        backends.push({
          name: options.backendName,
          domain_name: options.domainName ?? '',
          backend_mode: 'http',
          balance: algorithm,
          backend_ssl: false,
          http_check: options.httpCheck ?? false,
          check_url: options.checkUrl ?? '/',
          servers: [server]
        });
      } else {
        const backendPort = assertPort(
          options.backendPort ?? options.serverPort ?? options.port,
          '--backend-port'
        );
        tcpBackend.push({
          backend_name: options.backendName,
          port: backendPort,
          balance: algorithm,
          servers: [server]
        });
      }
    }

    const result = await client.createLoadBalancer({
      lb_name: options.name,
      lb_type: lbType,
      lb_mode: mode,
      lb_port: String(port),
      plan_name: options.plan,
      node_list_type: 'S',
      backends,
      tcp_backend: tcpBackend,
      acl_list: [],
      acl_map: [],
      client_timeout: DEFAULT_TIMEOUT,
      server_timeout: DEFAULT_TIMEOUT,
      connection_timeout: DEFAULT_TIMEOUT,
      http_keep_alive_timeout: DEFAULT_TIMEOUT
    });

    return { action: 'create', result };
  }

  async deleteLoadBalancer(
    lbId: string,
    options: LoadBalancerDeleteOptions
  ): Promise<LoadBalancerDeleteCommandResult> {
    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete load balancer ${lbId}? This cannot be undone.`
      );

      if (!confirmed) {
        return { action: 'delete', cancelled: true, lb_id: lbId };
      }
    }

    const client = await this.createClient(options);
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

  async listBackends(
    lbId: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerBackendListCommandResult> {
    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const context = lb.context?.[0];

    return {
      action: 'backend-list',
      lb_id: lbId,
      lb_mode: lb.lb_mode ?? 'unknown',
      backends: context?.backends ?? [],
      tcp_backends: context?.tcp_backend ?? []
    };
  }

  async addBackend(
    lbId: string,
    options: LoadBalancerBackendAddOptions
  ): Promise<LoadBalancerBackendAddCommandResult> {
    const serverPort = assertPort(options.serverPort, '--server-port');
    const serverIp = assertServerIp(options.serverIp);
    const algorithm = assertAlgorithm(options.algorithm ?? 'roundrobin');

    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);
    const context = lb.context?.[0];

    if (context === undefined) {
      throw new CliError(
        `Load balancer ${lbId} returned no configuration context.`,
        {
          code: 'LOAD_BALANCER_CONTEXT_MISSING',
          exitCode: EXIT_CODES.network,
          suggestion: `Run ${formatCliCommand(`load-balancer backend list ${lbId}`)} to inspect current state.`
        }
      );
    }

    const currentBackends = context.backends ?? [];
    const currentTcpBackends = context.tcp_backend ?? [];
    const isNlb = currentTcpBackends.length > 0 || lb.lb_mode === 'TCP';

    const server: LoadBalancerServer = {
      backend_name: options.serverName,
      backend_ip: serverIp,
      backend_port: serverPort
    };

    const existingAclList = (context['acl_list'] as [] | undefined) ?? [];
    const existingAclMap = (context['acl_map'] as [] | undefined) ?? [];
    const lbPort = String(context['lb_port'] ?? '80');
    const planName = String(context['plan_name'] ?? '');
    const lbType = (lb.lb_type ?? 'external') as LoadBalancerType;

    if (isNlb) {
      const existingGroup = currentTcpBackends[0];
      if (
        existingGroup !== undefined &&
        existingGroup.backend_name !== options.backendName
      ) {
        throw new CliError(
          `NLB ${lbId} already has a backend group named "${existingGroup.backend_name}". NLB supports only one backend group.`,
          {
            code: 'NLB_SINGLE_BACKEND_GROUP',
            exitCode: EXIT_CODES.usage,
            suggestion: `Use --backend-name ${existingGroup.backend_name} to add a server to the existing group.`
          }
        );
      }

      const backendPort = assertPort(
        options.backendPort ?? options.serverPort,
        '--backend-port'
      );

      const updatedTcpBackends: LoadBalancerTcpBackend[] =
        existingGroup !== undefined
          ? currentTcpBackends.map((g) =>
              g.backend_name === options.backendName
                ? { ...g, servers: [...g.servers, server] }
                : g
            )
          : [
              {
                backend_name: options.backendName,
                port: backendPort,
                balance: algorithm,
                servers: [server]
              }
            ];

      await client.updateLoadBalancer(lbId, {
        lb_name: lb.appliance_name,
        lb_type: lbType,
        lb_mode: (lb.lb_mode ?? 'TCP') as LoadBalancerMode,
        lb_port: lbPort,
        plan_name: planName,
        node_list_type: 'S',
        backends: currentBackends,
        tcp_backend: updatedTcpBackends,
        acl_list: existingAclList,
        acl_map: existingAclMap,
        client_timeout: (context['client_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
        server_timeout: (context['server_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
        connection_timeout: (context['connection_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
        http_keep_alive_timeout: (context['http_keep_alive_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT
      });
    } else {
      const existingGroup = currentBackends.find(
        (g) => g.name === options.backendName
      );

      const updatedBackends: LoadBalancerBackend[] =
        existingGroup !== undefined
          ? currentBackends.map((g) =>
              g.name === options.backendName
                ? { ...g, servers: [...g.servers, server] }
                : g
            )
          : [
              ...currentBackends,
              {
                name: options.backendName,
                domain_name: options.domainName ?? '',
                backend_mode: 'http' as const,
                balance: algorithm,
                backend_ssl: false,
                http_check: options.httpCheck ?? false,
                check_url: options.checkUrl ?? '/',
                servers: [server]
              }
            ];

      await client.updateLoadBalancer(lbId, {
        lb_name: lb.appliance_name,
        lb_type: lbType,
        lb_mode: (lb.lb_mode ?? 'HTTP') as LoadBalancerMode,
        lb_port: lbPort,
        plan_name: planName,
        node_list_type: 'S',
        backends: updatedBackends,
        tcp_backend: currentTcpBackends,
        acl_list: existingAclList,
        acl_map: existingAclMap,
        client_timeout: (context['client_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
        server_timeout: (context['server_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
        connection_timeout: (context['connection_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
        http_keep_alive_timeout: (context['http_keep_alive_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT
      });
    }

    return {
      action: 'backend-add',
      lb_id: lbId,
      message: `Server "${options.serverName}" added to backend group "${options.backendName}".`
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

function assertLoadBalancerType(type: string): LoadBalancerType {
  const valid: LoadBalancerType[] = ['external', 'internal'];
  const lower = type.toLowerCase() as LoadBalancerType;

  if (!valid.includes(lower)) {
    throw new CliError(
      `Invalid --type "${type}". Must be one of: ${valid.join(', ')}.`,
      {
        code: 'INVALID_LB_TYPE',
        exitCode: EXIT_CODES.usage
      }
    );
  }

  return lower;
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
