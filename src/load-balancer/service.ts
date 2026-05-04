import {
  resolveStoredCredentials,
  type ResolvedCredentials
} from '../config/index.js';
import { normalizeRequiredNumericId } from '../node/normalizers.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { ReservedIpClient } from '../reserved-ip/index.js';
import {
  LOAD_BALANCER_ALB_MODES,
  LOAD_BALANCER_SSL_MODES
} from './constants.js';
import {
  assertAlgorithm,
  assertAlbBackendProtocol,
  assertCreateBillingOptionShape,
  assertFrontendProtocol,
  assertIp,
  assertNonEmpty,
  assertPort,
  defaultPortForProtocol,
  getContextSslCertificateId,
  getLoadBalancerVmId,
  getReservableLoadBalancerPublicIp,
  hasSslCertificate,
  isAvailableReservedIp,
  isLoadBalancerPublicIpReserved,
  normalizeExistingMode,
  parseBackendServerSpec,
  parseBackendServerSpecs,
  resolveCreateBillingFromPlans
} from './normalizers.js';
import {
  buildAlbBackendGroup,
  buildBackendGroupDeleteMutation,
  buildBackendGroupUpdateMutation,
  buildBackendServerAddMutation,
  buildBackendServerDeleteMutation,
  buildBackendServerUpdateMutation,
  buildLoadBalancerCreateRequest,
  buildLoadBalancerMutationRequest,
  buildTcpBackendGroup,
  normalizeExistingLoadBalancerType,
  resolveLoadBalancerMutationContext,
  summarizeAlbBackendGroup,
  summarizeTcpBackendGroup
} from './mappers.js';
import type {
  LoadBalancerBackendGroupCreateCommandResult,
  LoadBalancerBackendGroupCreateOptions,
  LoadBalancerBackendGroupDeleteCommandResult,
  LoadBalancerBackendGroupListCommandResult,
  LoadBalancerBackendGroupUpdateCommandResult,
  LoadBalancerBackendGroupUpdateOptions,
  LoadBalancerBackendServerAddCommandResult,
  LoadBalancerBackendServerAddOptions,
  LoadBalancerBackendServerDeleteCommandResult,
  LoadBalancerBackendServerDeleteOptions,
  LoadBalancerBackendServerUpdateCommandResult,
  LoadBalancerBackendServerUpdateOptions,
  LoadBalancerClient,
  LoadBalancerContextOptions,
  LoadBalancerCreatedBackendSummary,
  LoadBalancerCreateCommandResult,
  LoadBalancerCreateBillingSelectionOptions,
  LoadBalancerCreateOptions,
  LoadBalancerDeleteCommandResult,
  LoadBalancerDeleteOptions,
  LoadBalancerDetails,
  LoadBalancerGetCommandResult,
  LoadBalancerListCommandResult,
  LoadBalancerMutationResponse,
  LoadBalancerMutationState,
  LoadBalancerNetworkCommandResult,
  LoadBalancerPlansCommandResult,
  LoadBalancerServiceDependencies,
  LoadBalancerUpdateRequestOverrides,
  ResolvedLoadBalancerMutationContext,
  LoadBalancerUpdateCommandResult,
  LoadBalancerUpdateOptions,
  LoadBalancerVpcAttachOptions,
  LoadBalancerVpcAttachment,
  LoadBalancerVpcDetachOptions,
  LoadBalancerVpc,
  ResolvedLoadBalancerCreateBilling
} from './types/index.js';
import type { VpcClient } from '../vpc/index.js';

export class LoadBalancerService {
  constructor(private readonly dependencies: LoadBalancerServiceDependencies) {}

  async listLoadBalancers(
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerListCommandResult> {
    const client = await this.createClient(options);
    const items = await client.listLoadBalancers();

    return { action: 'list', items };
  }

  async getLoadBalancer(
    lbId: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerGetCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const client = await this.createClient(options);
    const item = await client.getLoadBalancer(lbId);

    return { action: 'get', item };
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
    const mode = assertFrontendProtocol(options.frontendProtocol);
    if (requestedVpcId !== undefined && options.reserveIp !== undefined) {
      throw new CliError('--reserve-ip cannot be used with --vpc.', {
        code: 'RESERVE_IP_REQUIRES_EXTERNAL_LB',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Create either an external load balancer with --reserve-ip or an internal load balancer with --vpc.'
      });
    }
    const networkId = requestedVpcId
      ? normalizeRequiredNumericId(requestedVpcId, 'Network ID', '--vpc')
      : null;
    const subnetId =
      options.subnet === undefined
        ? null
        : normalizeRequiredNumericId(options.subnet, 'Subnet ID', '--subnet');
    const lbType: LoadBalancerVpc =
      networkId !== null ? 'internal' : 'external';
    const resolvedPort = options.port ?? defaultPortForProtocol(mode);
    if (resolvedPort === undefined) {
      throw new CliError('--port is required for TCP load balancers.', {
        code: 'MISSING_PORT',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass --port <port> to specify the frontend listener port.'
      });
    }
    const port = assertPort(resolvedPort, '--port');
    const algorithm = assertAlgorithm(options.algorithm ?? 'roundrobin');
    assertCreateBillingOptionShape(options);
    const credentials = await this.resolveContext(options);
    const client = this.dependencies.createLoadBalancerClient(credentials);
    const reserveIp =
      options.reserveIp === undefined
        ? ''
        : await resolveAvailableReservedIp(
            this.dependencies.createReservedIpClient(credentials),
            options.reserveIp,
            '--reserve-ip'
          );

    const requiresSslCert = LOAD_BALANCER_SSL_MODES.includes(mode);
    if (requiresSslCert && !options.sslCertificateId) {
      throw new CliError(
        `--ssl-certificate-id is required when --frontend-protocol is ${mode}.`,
        {
          code: 'MISSING_SSL_CERTIFICATE_ID',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand('ssl list')} to discover certificate IDs, then pass one with --ssl-certificate-id.`
        }
      );
    }
    const sslCertificateId = requiresSslCert
      ? normalizeRequiredNumericId(
          options.sslCertificateId!,
          'SSL certificate ID',
          '--ssl-certificate-id'
        )
      : null;

    const isAlb = LOAD_BALANCER_ALB_MODES.includes(mode);
    if (!isAlb && options.backendProtocol !== undefined) {
      throw new CliError(
        '--backend-protocol is only valid for ALB protocols.',
        {
          code: 'NLB_BACKEND_PROTOCOL_NOT_SUPPORTED',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Remove --backend-protocol when --frontend-protocol is TCP.'
        }
      );
    }
    const albBackendProtocol = isAlb
      ? assertAlbBackendProtocol(options.backendProtocol)
      : null;
    const backendGroup = assertNonEmpty(
      options.backendGroup,
      '--backend-group'
    );
    const servers = parseBackendServerSpecs(options.backendServer);

    const backends = isAlb
      ? [
          buildAlbBackendGroup({
            algorithm,
            backendProtocol: albBackendProtocol!,
            includeScalerDefaults: true,
            name: backendGroup,
            servers
          })
        ]
      : [];
    const tcpBackend = isAlb
      ? []
      : [
          buildTcpBackendGroup({ algorithm, name: backendGroup, port, servers })
        ];
    const backendSummary: LoadBalancerCreatedBackendSummary = isAlb
      ? summarizeAlbBackendGroup({
          algorithm,
          backendProtocol: albBackendProtocol!,
          name: backendGroup,
          servers
        })
      : summarizeTcpBackendGroup({
          algorithm,
          name: backendGroup,
          port,
          servers
        });

    const billing = await resolveCreateBillingSelection(client, options.plan, {
      ...(options.billingType === undefined
        ? {}
        : { billingType: options.billingType }),
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
              networkId,
              subnetId
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

    const name = assertNonEmpty(options.name, '--name');
    const result = await client.createLoadBalancer(
      buildLoadBalancerCreateRequest({
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
        vpcList: vpcList ?? []
      })
    );

    return {
      action: 'create',
      backend: backendSummary,
      billing: {
        committed_plan_id: billing.committedPlanId,
        committed_plan_name: billing.committedPlanName,
        post_commit_behavior: billing.postCommitBehavior,
        type: billing.type
      },
      requested: {
        frontend_port: port,
        mode,
        name,
        plan_name: billing.basePlanName,
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

  async updateLoadBalancer(
    lbId: string,
    options: LoadBalancerUpdateOptions
  ): Promise<LoadBalancerUpdateCommandResult> {
    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );
    const currentMode = mutation.isNlb
      ? 'TCP'
      : normalizeExistingMode(lb.lb_mode, 'HTTP');

    let nextMode = currentMode;
    if (options.frontendProtocol !== undefined) {
      nextMode = assertFrontendProtocol(options.frontendProtocol);
      if (currentMode === 'TCP' && nextMode !== 'TCP') {
        throw new CliError(
          'Cannot change an NLB from TCP to an ALB protocol.',
          {
            code: 'LOAD_BALANCER_PROTOCOL_FAMILY_CHANGE',
            exitCode: EXIT_CODES.usage
          }
        );
      }
      if (currentMode !== 'TCP' && nextMode === 'TCP') {
        throw new CliError('Cannot change an ALB to TCP.', {
          code: 'LOAD_BALANCER_PROTOCOL_FAMILY_CHANGE',
          exitCode: EXIT_CODES.usage
        });
      }
    }

    if (options.sslCertificateId !== undefined && currentMode === 'TCP') {
      throw new CliError('--ssl-certificate-id is only valid for ALB.', {
        code: 'SSL_UPDATE_REQUIRES_ALB',
        exitCode: EXIT_CODES.usage
      });
    }

    if (
      (nextMode === 'HTTPS' || nextMode === 'BOTH') &&
      !hasSslCertificate(options, mutation.context)
    ) {
      throw new CliError(
        `--ssl-certificate-id is required when --frontend-protocol is ${nextMode}.`,
        {
          code: 'MISSING_SSL_CERTIFICATE_ID',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand('ssl list')} to discover certificate IDs.`
        }
      );
    }

    if ((options.redirectHttpToHttps ?? false) && nextMode !== 'BOTH') {
      throw new CliError(
        '--redirect-http-to-https is only valid with --frontend-protocol BOTH.',
        {
          code: 'REDIRECT_REQUIRES_BOTH_PROTOCOL',
          exitCode: EXIT_CODES.usage
        }
      );
    }

    const sslCertificateId =
      options.sslCertificateId === undefined
        ? getContextSslCertificateId(mutation.context)
        : normalizeRequiredNumericId(
            options.sslCertificateId,
            'SSL certificate ID',
            '--ssl-certificate-id'
          );
    const sslContext = {
      ...(mutation.context.ssl_context ?? {}),
      ...(sslCertificateId === null
        ? {}
        : { ssl_certificate_id: sslCertificateId }),
      redirect_to_https:
        options.redirectHttpToHttps ??
        Boolean(mutation.context.ssl_context?.['redirect_to_https'])
    };

    const result = await this.applyMutation(lbId, client, lb, mutation, {
      lb_mode: nextMode,
      ssl_certificate_id: sslCertificateId,
      ssl_context: sslContext,
      ...(options.name === undefined ? {} : { lb_name: options.name })
    });

    return {
      action: 'update',
      lb_id: lbId,
      lb_name: options.name ?? lb.appliance_name,
      message: result.message,
      changes: {
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.frontendProtocol === undefined
          ? {}
          : { protocol: options.frontendProtocol }),
        ...(sslCertificateId === null
          ? {}
          : { ssl_certificate_id: sslCertificateId }),
        ...(options.redirectHttpToHttps === undefined
          ? {}
          : { redirect_http_to_https: options.redirectHttpToHttps })
      }
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
    const algorithm = assertAlgorithm(options.algorithm ?? 'roundrobin');

    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );
    const {
      backends: currentBackends,
      isNlb,
      lbPort,
      tcpBackends: currentTcpBackends
    } = mutation;

    const albBackendProtocol = isNlb
      ? null
      : assertAlbBackendProtocol(options.backendProtocol);
    if (isNlb && options.backendProtocol !== undefined) {
      throw new CliError(
        '--backend-protocol is only valid for ALB backend groups.',
        {
          code: 'NLB_BACKEND_PROTOCOL_NOT_SUPPORTED',
          exitCode: EXIT_CODES.usage
        }
      );
    }

    // NLB guard: only one backend group allowed
    if (isNlb && currentTcpBackends.length > 0) {
      throw new CliError(
        `NLB ${lbId} already has a backend group. NLB supports only one backend group.`,
        {
          code: 'NLB_SINGLE_BACKEND_GROUP',
          exitCode: EXIT_CODES.usage,
          suggestion: `Use ${formatCliCommand(`lb backend-server add ${lbId}`)} to add a server to the existing group.`
        }
      );
    }

    // ALB guard: group name must be unique
    if (!isNlb && currentBackends.some((g) => g.name === options.name)) {
      throw new CliError(
        `Backend group "${options.name}" already exists on load balancer ${lbId}. Use \`lb backend-server add\` to add a server to it.`,
        {
          code: 'BACKEND_GROUP_EXISTS',
          exitCode: EXIT_CODES.usage,
          suggestion: `Use ${formatCliCommand(`lb backend-server add ${lbId}`)} to add a server to the existing group.`
        }
      );
    }

    const servers = parseBackendServerSpecs(options.backendServer);

    if (isNlb) {
      const backendPort = assertPort(
        options.backendPort ?? lbPort,
        '--backend-port'
      );
      const newTcpGroup = buildTcpBackendGroup({
        algorithm,
        name: options.name,
        port: backendPort,
        servers
      });

      await this.applyMutation(lbId, client, lb, mutation, {
        lb_mode: 'TCP',
        tcp_backend: [...currentTcpBackends, newTcpGroup]
      });

      return {
        action: 'backend-group-add',
        group: summarizeTcpBackendGroup({
          algorithm,
          name: options.name,
          port: backendPort,
          servers
        }),
        lb_id: lbId,
        lb_name: lb.appliance_name,
        message: `Backend group "${options.name}" added.`
      };
    }

    const newAlbGroup = buildAlbBackendGroup({
      algorithm,
      backendProtocol: albBackendProtocol!,
      name: options.name,
      servers
    });

    await this.applyMutation(lbId, client, lb, mutation, {
      backends: [...currentBackends, newAlbGroup]
    });

    return {
      action: 'backend-group-add',
      group: summarizeAlbBackendGroup({
        algorithm,
        backendProtocol: albBackendProtocol!,
        name: options.name,
        servers
      }),
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: `Backend group "${options.name}" added.`
    };
  }

  async updateBackendGroup(
    lbId: string,
    groupName: string,
    options: LoadBalancerBackendGroupUpdateOptions
  ): Promise<LoadBalancerBackendGroupUpdateCommandResult> {
    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );
    const algorithm =
      options.algorithm === undefined
        ? undefined
        : assertAlgorithm(options.algorithm);
    let backendProtocol: 'HTTP' | 'HTTPS' | undefined;

    if (mutation.isNlb) {
      if (options.backendProtocol !== undefined) {
        throw new CliError(
          '--backend-protocol is only valid for ALB backend groups.',
          {
            code: 'NLB_BACKEND_PROTOCOL_NOT_SUPPORTED',
            exitCode: EXIT_CODES.usage
          }
        );
      }
    } else {
      backendProtocol =
        options.backendProtocol === undefined
          ? undefined
          : assertAlbBackendProtocol(options.backendProtocol);
    }

    const mutationResult = buildBackendGroupUpdateMutation(
      mutation,
      groupName,
      {
        ...(algorithm === undefined ? {} : { algorithm }),
        ...(backendProtocol === undefined ? {} : { backendProtocol })
      }
    );
    if (!mutationResult.exists) {
      throwBackendGroupNotFound(lbId, groupName);
    }
    const overrides = mutationResult.overrides!;
    await this.applyMutation(lbId, client, lb, mutation, overrides);

    return {
      action: 'backend-group-update',
      group_name: groupName,
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: `Backend group "${groupName}" updated.`,
      ...(options.algorithm === undefined
        ? {}
        : { algorithm: options.algorithm }),
      ...(options.backendProtocol === undefined
        ? {}
        : { backend_protocol: options.backendProtocol })
    };
  }

  async deleteBackendGroup(
    lbId: string,
    groupName: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerBackendGroupDeleteCommandResult> {
    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );

    const mutationResult = buildBackendGroupDeleteMutation(mutation, groupName);
    if (!mutationResult.exists) {
      throwBackendGroupNotFound(lbId, groupName);
    }
    if (mutationResult.lastGroup) {
      throwLastBackendGroupNotDeletable(lbId, groupName);
    }
    const overrides = mutationResult.overrides!;
    await this.applyMutation(lbId, client, lb, mutation, overrides);

    return {
      action: 'backend-group-remove',
      lb_id: lbId,
      lb_name: lb.appliance_name,
      group_name: groupName,
      message: `Backend group "${groupName}" removed.`
    };
  }

  async addBackendServer(
    lbId: string,
    options: LoadBalancerBackendServerAddOptions
  ): Promise<LoadBalancerBackendServerAddCommandResult> {
    const backendGroup = assertNonEmpty(
      options.backendGroup,
      '--backend-group'
    );
    const server = parseBackendServerSpec(options.backendServer!);

    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );

    const mutationResult = buildBackendServerAddMutation(
      mutation,
      backendGroup,
      server
    );
    if (!mutationResult.groupFound) {
      throwBackendGroupNotFoundForServerMutation(lbId, backendGroup);
    }
    const overrides = mutationResult.overrides!;
    await this.applyMutation(lbId, client, lb, mutation, overrides);

    return {
      action: 'backend-server-add',
      group_name: backendGroup,
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: `Server "${server.backend_name}" added to backend group "${backendGroup}".`,
      server_name: server.backend_name
    };
  }

  async updateBackendServer(
    lbId: string,
    options: LoadBalancerBackendServerUpdateOptions
  ): Promise<LoadBalancerBackendServerUpdateCommandResult> {
    const nextIp =
      options.ip === undefined ? undefined : assertIp(options.ip, '--ip');
    const nextPort =
      options.port === undefined
        ? undefined
        : assertPort(options.port, '--port');

    if (nextIp === undefined && nextPort === undefined) {
      throw new CliError(
        'Provide --ip, --port, or both to update a backend server.',
        {
          code: 'BACKEND_SERVER_UPDATE_EMPTY',
          exitCode: EXIT_CODES.usage
        }
      );
    }

    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );
    const mutationResult = buildBackendServerUpdateMutation(
      mutation,
      options.backendGroup,
      options.backendServerName,
      {
        ...(nextIp === undefined ? {} : { backend_ip: nextIp }),
        ...(nextPort === undefined ? {} : { backend_port: nextPort })
      }
    );
    if (!mutationResult.serverFound) {
      throwBackendServerNotFound(
        lbId,
        options.backendGroup,
        options.backendServerName
      );
    }
    const overrides = mutationResult.overrides!;
    await this.applyMutation(lbId, client, lb, mutation, overrides);

    return {
      action: 'backend-server-update',
      group_name: options.backendGroup,
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: `Server "${options.backendServerName}" updated in backend group "${options.backendGroup}".`,
      server_name: options.backendServerName,
      ...(options.ip === undefined ? {} : { ip: options.ip }),
      ...(options.port === undefined ? {} : { port: options.port })
    };
  }

  async deleteBackendServer(
    lbId: string,
    options: LoadBalancerBackendServerDeleteOptions
  ): Promise<LoadBalancerBackendServerDeleteCommandResult> {
    const backendGroup = assertNonEmpty(
      options.backendGroup,
      '--backend-group'
    );
    const backendServerName = assertNonEmpty(
      options.backendServerName,
      '--backend-server-name'
    );
    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );
    const mutationResult = buildBackendServerDeleteMutation(
      mutation,
      backendGroup,
      backendServerName
    );

    if (!mutationResult.groupFound) {
      throwBackendGroupNotFoundForServerMutation(lbId, backendGroup);
    }
    if (mutationResult.lastServer) {
      throwLastBackendServerNotDeletable(backendGroup, backendServerName);
    }
    if (mutationResult.ambiguous) {
      throwAmbiguousBackendServer(backendServerName, backendGroup);
    }
    if (!mutationResult.serverFound) {
      throwBackendServerNotFound(lbId, backendGroup, backendServerName);
    }

    const overrides = mutationResult.overrides!;
    await this.applyMutation(lbId, client, lb, mutation, overrides);
    const removedServer = mutationResult.removedServer!;

    return {
      action: 'backend-server-remove',
      group_name: backendGroup,
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: `Server "${removedServer.backend_name}" removed from backend group "${backendGroup}".`,
      server_name: removedServer.backend_name
    };
  }

  async reservePublicIp(
    lbId: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerNetworkCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const credentials = await this.resolveContext(options);
    const client = this.dependencies.createLoadBalancerClient(credentials);
    const lb = await client.getLoadBalancer(lbId);
    const mutation = resolveLoadBalancerMutationContext(lb, lbId);

    if (
      normalizeExistingLoadBalancerType(lb, mutation.context) === 'internal'
    ) {
      throw new CliError(
        'Reserved public IPs can only be attached to external load balancers.',
        {
          code: 'RESERVE_IP_REQUIRES_EXTERNAL_LB',
          exitCode: EXIT_CODES.usage
        }
      );
    }

    if (isLoadBalancerPublicIpReserved(lb, mutation.context)) {
      throw new CliError(
        `Load balancer ${lbId} public IP is already reserved.`,
        {
          code: 'LOAD_BALANCER_PUBLIC_IP_ALREADY_RESERVED',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand(`lb get ${lbId}`)} to inspect the current public IP.`
        }
      );
    }

    const publicIp = getReservableLoadBalancerPublicIp(lb, lbId);
    const vmId = getLoadBalancerVmId(lb, lbId);
    const result = await this.dependencies
      .createReservedIpClient(credentials)
      .reserveNodePublicIp(publicIp, { type: 'live-reserve', vm_id: vmId });

    return {
      action: 'network-reserve-ip-reserve',
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: result.message,
      reserve_ip: result.ip_address
    };
  }

  async attachVpc(
    lbId: string,
    options: LoadBalancerVpcAttachOptions
  ): Promise<LoadBalancerNetworkCommandResult> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const vpcId = normalizeRequiredNumericId(options.vpc, 'VPC ID', '--vpc');
    const subnetId =
      options.subnet === undefined
        ? null
        : normalizeRequiredNumericId(options.subnet, 'Subnet ID', '--subnet');
    const credentials = await this.resolveContext(options);
    const client = this.dependencies.createLoadBalancerClient(credentials);
    const lb = await client.getLoadBalancer(lbId);
    const mutation = resolveLoadBalancerMutationContext(lb, lbId);
    const attachment = await resolveVpcAttachment(
      this.dependencies.createVpcClient(credentials),
      vpcId,
      subnetId
    );
    const result = await this.applyMutation(lbId, client, lb, mutation, {
      lb_reserve_ip: '',
      lb_type: 'internal',
      vpc_list: [attachment]
    });

    return {
      action: 'network-vpc-attach',
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: result.message,
      vpc_id: String(vpcId),
      ...(subnetId !== null ? { subnet_id: String(subnetId) } : {})
    };
  }

  async detachVpc(
    lbId: string,
    options: LoadBalancerVpcDetachOptions
  ): Promise<LoadBalancerNetworkCommandResult> {
    const vpcId = normalizeRequiredNumericId(options.vpc, 'VPC ID', '--vpc');
    const { client, lb, mutation } = await this.resolveMutationState(
      lbId,
      options
    );
    const currentVpcList = mutation.context.vpc_list ?? [];
    const vpcExists = currentVpcList.some(
      (item) => String(item.network_id) === String(vpcId)
    );
    if (!vpcExists) {
      throw new CliError(
        `VPC ${vpcId} is not attached to load balancer ${lbId}.`,
        {
          code: 'VPC_NOT_ATTACHED',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run ${formatCliCommand(`lb get ${lbId}`)} to inspect current VPC attachments.`
        }
      );
    }
    const remainingVpcList = currentVpcList.filter(
      (item) => String(item.network_id) !== String(vpcId)
    );
    const result = await this.applyMutation(lbId, client, lb, mutation, {
      lb_type: remainingVpcList.length === 0 ? 'external' : 'internal',
      vpc_list: remainingVpcList
    });

    return {
      action: 'network-vpc-detach',
      lb_id: lbId,
      lb_name: lb.appliance_name,
      message: result.message,
      vpc_id: String(vpcId)
    };
  }

  private async createClient(
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerClient> {
    return this.dependencies.createLoadBalancerClient(
      await this.resolveContext(options)
    );
  }

  private async resolveMutationState(
    lbId: string,
    options: LoadBalancerContextOptions
  ): Promise<LoadBalancerMutationState> {
    normalizeRequiredNumericId(lbId, 'Load balancer ID', '<lbId>');
    const client = await this.createClient(options);
    const lb = await client.getLoadBalancer(lbId);

    return {
      client,
      lb,
      mutation: resolveLoadBalancerMutationContext(lb, lbId)
    };
  }

  private async applyMutation(
    lbId: string,
    client: LoadBalancerClient,
    lb: LoadBalancerDetails,
    mutation: ResolvedLoadBalancerMutationContext,
    overrides: Partial<LoadBalancerUpdateRequestOverrides>
  ): Promise<LoadBalancerMutationResponse> {
    return client.updateLoadBalancer(
      lbId,
      buildLoadBalancerMutationRequest(lb, mutation, overrides)
    );
  }

  private async resolveContext(
    options: LoadBalancerContextOptions
  ): Promise<ResolvedCredentials> {
    return resolveStoredCredentials(this.dependencies.store, options);
  }
}

async function resolveCreateBillingSelection(
  client: LoadBalancerClient,
  requestedBasePlan: string,
  options: LoadBalancerCreateBillingSelectionOptions
): Promise<ResolvedLoadBalancerCreateBilling> {
  assertCreateBillingOptionShape(options);
  const plans = await client.listLoadBalancerPlans();
  return resolveCreateBillingFromPlans(plans, requestedBasePlan, options);
}

async function resolveVpcAttachment(
  client: VpcClient,
  vpcId: number,
  subnetId: number | null = null
): Promise<LoadBalancerVpcAttachment> {
  const vpc = await client.getVpc(vpcId);

  return {
    ipv4_cidr: vpc.ipv4_cidr,
    network_id: vpc.network_id,
    ...(subnetId === null ? {} : { subnet_id: subnetId }),
    vpc_name: vpc.name
  };
}

async function resolveAvailableReservedIp(
  client: ReservedIpClient,
  ip: string,
  label: string
): Promise<string> {
  const reserveIp = assertIp(ip, label);
  const reservedIps = await client.listReservedIps();
  const match = reservedIps.find((item) => item.ip_address === reserveIp);

  if (match === undefined) {
    throw new CliError(
      `Reserved IP ${reserveIp} was not found in your reserved IP inventory.`,
      {
        code: 'RESERVE_IP_NOT_FOUND',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('reserved-ip list')} and retry with an available ip_address.`
      }
    );
  }

  if (!isAvailableReservedIp(match)) {
    throw new CliError(`Reserved IP ${reserveIp} is not available.`, {
      code: 'RESERVE_IP_NOT_AVAILABLE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Choose an unattached reserved IP whose status is Reserved or Available, then retry the command.'
    });
  }

  return match.ip_address;
}

function throwBackendGroupNotFound(lbId: string, groupName: string): never {
  throw new CliError(
    `Backend group "${groupName}" not found on load balancer ${lbId}.`,
    {
      code: 'BACKEND_GROUP_NOT_FOUND',
      exitCode: EXIT_CODES.usage
    }
  );
}

function throwBackendGroupNotFoundForServerMutation(
  lbId: string,
  groupName: string
): never {
  throw new CliError(
    `Backend group "${groupName}" not found on load balancer ${lbId}.`,
    {
      code: 'BACKEND_GROUP_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion: `Use ${formatCliCommand(`lb backend-group add ${lbId}`)} to create a new backend group.`
    }
  );
}

function throwLastBackendGroupNotDeletable(
  lbId: string,
  groupName: string
): never {
  throw new CliError(
    `Backend group "${groupName}" is the last backend group on load balancer ${lbId}. Keep at least one backend group attached.`,
    {
      code: 'LAST_BACKEND_GROUP_NOT_DELETABLE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Delete load balancer ${lbId} instead if you want to remove the final backend group.`
    }
  );
}

function throwBackendServerNotFound(
  lbId: string,
  groupName: string,
  serverName: string
): never {
  throw new CliError(
    `Server "${serverName}" was not found in backend group "${groupName}" on load balancer ${lbId}.`,
    {
      code: 'BACKEND_SERVER_NOT_FOUND',
      exitCode: EXIT_CODES.usage
    }
  );
}

function throwLastBackendServerNotDeletable(
  groupName: string,
  serverName: string
): never {
  throw new CliError(
    `Server "${serverName}" is the last server in backend group "${groupName}". Keep at least one server attached.`,
    {
      code: 'LAST_BACKEND_SERVER_NOT_DELETABLE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Add another server to backend group "${groupName}" before removing "${serverName}".`
    }
  );
}

function throwAmbiguousBackendServer(
  serverName: string,
  groupName: string
): never {
  throw new CliError(
    `Multiple servers named "${serverName}" were found in backend group "${groupName}".`,
    {
      code: 'BACKEND_SERVER_AMBIGUOUS',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Rename duplicate backend servers before removing one by name.'
    }
  );
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
