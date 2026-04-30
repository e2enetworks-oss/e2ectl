import {
  resolveStoredCredentials,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { DbaasClient } from './client.js';
import { DBAAS_LIST_MAX_PAGES, DBAAS_LIST_PAGE_SIZE } from './constants.js';
import {
  buildCreateRequest,
  buildConnectionEndpoint,
  buildConnectionPort,
  buildDbaasVpcEntry,
  extractCreatedDbaasId,
  normalizeWhitelistedIpItem,
  resolveSoftware,
  resolveTemplatePlan,
  sortDbaasListItems,
  summarizeDbaasDetail,
  summarizeEngineTypes,
  summarizeSupportedCluster,
  summarizeSupportedClusterOrNull,
  summarizeTemplatePlans
} from './mappers.js';
import {
  assertCanDelete,
  assertCanDetachPublicIp,
  computePageCount,
  normalizeDatabaseType,
  normalizeDbaasCreateInput,
  normalizeDbaasIdArg,
  normalizeHost,
  normalizeIpAddress,
  normalizeOptionalString,
  normalizePassword,
  normalizePasswordSource,
  normalizeRequiredNumericId,
  normalizeRequiredString,
  wrapPasswordReadError
} from './normalizers.js';
import type {
  DbaasAttachVpcOptions,
  DbaasClusterSummary,
  DbaasContextOptions,
  DbaasCreateCommandResult,
  DbaasCreateOptions,
  DbaasDeleteCommandResult,
  DbaasDeleteOptions,
  DbaasDetachVpcOptions,
  DbaasGetCommandResult,
  DbaasGetOptions,
  DbaasListCommandResult,
  DbaasListOptions,
  DbaasListTypesCommandResult,
  DbaasListTypesOptions,
  DbaasPasswordOptions,
  DbaasPlansCommandResult,
  DbaasPlansOptions,
  DbaasPublicIpAttachCommandResult,
  DbaasPublicIpDetachCommandResult,
  DbaasPublicIpDetachOptions,
  DbaasPublicIpOptions,
  DbaasResetPasswordCommandResult,
  DbaasResetPasswordOptions,
  DbaasServiceDependencies,
  DbaasVpcAttachCommandResult,
  DbaasVpcDetachCommandResult,
  DbaasVpcEntry,
  DbaasWhitelistedIp,
  DbaasWhitelistListCommandResult,
  DbaasWhitelistListOptions,
  DbaasWhitelistUpdateCommandResult,
  DbaasWhitelistUpdateOptions,
  SupportedDatabaseType
} from './types/index.js';

export class DbaasService {
  constructor(private readonly dependencies: DbaasServiceDependencies) {}

  async createDbaas(
    options: DbaasCreateOptions
  ): Promise<DbaasCreateCommandResult> {
    const password = await this.loadPassword(options);
    const input = normalizeDbaasCreateInput(options, password);
    const credentials = await this.resolveCredentials(options);
    const client = this.dependencies.createDbaasClient(credentials);
    const catalog = await client.listPlans();
    const software = resolveSoftware(catalog, input.type, input.version);
    const softwareCatalog = await client.listPlans(software.id);
    const templatePlan = resolveTemplatePlan(softwareCatalog, input.plan);

    let vpcEntry: DbaasVpcEntry | undefined;
    if (input.vpcId !== null) {
      const vpcClient = this.dependencies.createVpcClient(credentials);
      const vpc = await vpcClient.getVpc(input.vpcId);
      vpcEntry = buildDbaasVpcEntry(vpc, input.subnetId);
    }

    const createResult = await client.createDbaas(
      buildCreateRequest(input, software.id, templatePlan.template_id, vpcEntry)
    );
    const dbaasId = extractCreatedDbaasId(createResult);

    return {
      action: 'create',
      dbaas: {
        database_name: input.databaseName,
        id: dbaasId,
        name: input.name,
        type: input.type,
        username: input.username,
        version: input.version
      },
      requested: {
        billing_type: input.billingType,
        ...(input.committedPlanId === null
          ? {}
          : { committed_plan_id: input.committedPlanId }),
        database_name: input.databaseName,
        name: input.name,
        plan: templatePlan.name,
        public_ip: input.publicIp,
        template_id: templatePlan.template_id,
        type: input.type,
        username: input.username,
        version: input.version,
        ...(input.vpcId === null ? {} : { vpc_id: input.vpcId })
      }
    };
  }

  async deleteDbaas(
    dbaasId: string,
    options: DbaasDeleteOptions
  ): Promise<DbaasDeleteCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const client = await this.createClient(options);
    const detail = await client.getDbaas(normalizedDbaasId);
    const summary = summarizeSupportedCluster(detail);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete DBaaS ${summary.id} (${summary.name})? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          dbaas: summary,
          dbaas_id: normalizedDbaasId
        };
      }
    }

    const result = await client.deleteDbaas(normalizedDbaasId);

    return {
      action: 'delete',
      cancelled: false,
      dbaas: summary,
      dbaas_id: normalizedDbaasId,
      ...(result.name === undefined
        ? {}
        : { message: `Deleted ${result.name}.` })
    };
  }

  async getDbaas(
    dbaasId: string,
    options: DbaasGetOptions
  ): Promise<DbaasGetCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const client = await this.createClient(options);
    const [detail, vpcConnections, publicIpStatus] = await Promise.all([
      client.getDbaas(normalizedDbaasId),
      client.listVpcConnections(normalizedDbaasId),
      client.getPublicIpStatus(normalizedDbaasId)
    ]);

    return {
      action: 'get',
      dbaas: summarizeDbaasDetail(
        detail,
        vpcConnections,
        publicIpStatus.public_ip_status
      )
    };
  }

  async listDbaas(options: DbaasListOptions): Promise<DbaasListCommandResult> {
    const requestedType =
      options.type === undefined ? null : normalizeDatabaseType(options.type);
    const client = await this.createClient(options);
    const rawItems = await this.fetchAllDbaasClusters(client, requestedType);
    const items = sortDbaasListItems(
      rawItems.flatMap((item) => {
        const normalized = summarizeSupportedClusterOrNull(item);
        if (normalized === null) {
          return [];
        }

        return [
          {
            connection_string: normalized.connection_string,
            connection_endpoint: buildConnectionEndpoint(item.master_node),
            connection_port: buildConnectionPort(item.master_node),
            database_name: normalized.database_name,
            id: normalized.id,
            name: normalized.name,
            private_ips: [
              normalizeHost(item.master_node.private_ip_address)
            ].filter((ip): ip is string => ip !== null),
            public_ip: normalizeHost(item.master_node.public_ip_address),
            status: normalizeOptionalString(item.status),
            type: normalized.type,
            version: normalized.version
          }
        ];
      })
    );

    return {
      action: 'list',
      filters: {
        type: requestedType
      },
      items,
      total_count: items.length,
      total_page_number: computePageCount(items.length, DBAAS_LIST_PAGE_SIZE)
    };
  }

  async listTypes(
    options: DbaasListTypesOptions
  ): Promise<DbaasListTypesCommandResult> {
    const requestedType =
      options.type === undefined ? null : normalizeDatabaseType(options.type);
    const client = await this.createClient(options);
    const catalog = await client.listPlans();
    const allItems = summarizeEngineTypes(catalog.database_engines);
    const items =
      requestedType === null
        ? allItems
        : allItems.filter((item) => item.type === requestedType);

    return {
      action: 'list-types',
      filters: { type: requestedType },
      items,
      total_count: items.length
    };
  }

  async listPlans(
    options: DbaasPlansOptions
  ): Promise<DbaasPlansCommandResult> {
    const requestedType = normalizeDatabaseType(options.type);
    const requestedVersion = normalizeRequiredString(
      options.dbVersion,
      'DB version',
      '--db-version'
    );
    const client = await this.createClient(options);
    const catalog = await client.listPlans();
    const software = resolveSoftware(catalog, requestedType, requestedVersion);
    const softwareCatalog = await client.listPlans(software.id);
    const items = summarizeTemplatePlans(
      requestedType,
      requestedVersion,
      softwareCatalog.template_plans
    );

    return {
      action: 'plans',
      filters: { type: requestedType, version: requestedVersion },
      items,
      total_count: items.length
    };
  }

  async resetPassword(
    dbaasId: string,
    options: DbaasResetPasswordOptions
  ): Promise<DbaasResetPasswordCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const password = await this.loadPassword(options);
    const client = await this.createClient(options);
    const detail = await client.getDbaas(normalizedDbaasId);
    const summary = summarizeSupportedCluster(detail);

    if (summary.username === null) {
      throw new CliError(
        `DBaaS ${normalizedDbaasId} does not expose a resettable admin username.`,
        {
          code: 'INVALID_DBAAS_RESET_PASSWORD_TARGET',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Inspect the DBaaS in the MyAccount UI and retry once the admin user is available.'
        }
      );
    }

    const result = await client.resetPassword(normalizedDbaasId, {
      password,
      username: summary.username
    });

    return {
      action: 'reset-password',
      dbaas: summary,
      message: result.message
    };
  }

  async attachVpc(
    dbaasId: string,
    options: DbaasAttachVpcOptions
  ): Promise<DbaasVpcAttachCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const { subnetId, vpcEntry, vpcId } = await this.resolveVpcEntry(options);
    const client = await this.createClient(options);
    await client.attachVpc(normalizedDbaasId, {
      action: 'attach',
      vpcs: [vpcEntry]
    });

    return {
      action: 'vpc-attach',
      dbaas_id: normalizedDbaasId,
      vpc: { id: vpcId, name: vpcEntry.vpc_name, subnet_id: subnetId }
    };
  }

  async detachVpc(
    dbaasId: string,
    options: DbaasDetachVpcOptions
  ): Promise<DbaasVpcDetachCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const { subnetId, vpcEntry, vpcId } = await this.resolveVpcEntry(options);
    const client = await this.createClient(options);
    const result = await client.detachVpc(normalizedDbaasId, {
      action: 'detach',
      vpcs: [vpcEntry]
    });

    return {
      action: 'vpc-detach',
      dbaas_id: normalizedDbaasId,
      message: normalizeOptionalString(result.message),
      vpc: { id: vpcId, name: vpcEntry.vpc_name, subnet_id: subnetId }
    };
  }

  async attachPublicIp(
    dbaasId: string,
    options: DbaasPublicIpOptions
  ): Promise<DbaasPublicIpAttachCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const client = await this.createClient(options);
    const result = await client.attachPublicIp(normalizedDbaasId);

    return {
      action: 'public-ip-attach',
      dbaas_id: normalizedDbaasId,
      message: normalizeOptionalString(result.message)
    };
  }

  async detachPublicIp(
    dbaasId: string,
    options: DbaasPublicIpDetachOptions
  ): Promise<DbaasPublicIpDetachCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);

    if (!(options.force ?? false)) {
      assertCanDetachPublicIp(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Detach public IP from DBaaS ${normalizedDbaasId}? External connectivity will be lost.`
      );

      if (!confirmed) {
        return {
          action: 'public-ip-detach',
          cancelled: true,
          dbaas_id: normalizedDbaasId,
          message: null
        };
      }
    }

    const client = await this.createClient(options);
    const result = await client.detachPublicIp(normalizedDbaasId);

    return {
      action: 'public-ip-detach',
      cancelled: false,
      dbaas_id: normalizedDbaasId,
      message: normalizeOptionalString(result.message)
    };
  }

  async listWhitelistedIps(
    dbaasId: string,
    options: DbaasWhitelistListOptions
  ): Promise<DbaasWhitelistListCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const client = await this.createClient(options);
    const items = await this.fetchAllWhitelistedIps(client, normalizedDbaasId);

    return {
      action: 'whitelist-list',
      dbaas_id: normalizedDbaasId,
      items: items.map(normalizeWhitelistedIpItem),
      total_count: items.length
    };
  }

  async addWhitelistedIp(
    dbaasId: string,
    options: DbaasWhitelistUpdateOptions
  ): Promise<DbaasWhitelistUpdateCommandResult> {
    return this.updateWhitelistedIp('attach', dbaasId, options);
  }

  async removeWhitelistedIp(
    dbaasId: string,
    options: DbaasWhitelistUpdateOptions
  ): Promise<DbaasWhitelistUpdateCommandResult> {
    return this.updateWhitelistedIp('detach', dbaasId, options);
  }

  private async resolveCredentials(
    options: DbaasContextOptions
  ): Promise<ResolvedCredentials> {
    return resolveStoredCredentials(this.dependencies.store, {
      ...(options.alias === undefined ? {} : { alias: options.alias }),
      ...(options.location === undefined ? {} : { location: options.location }),
      ...(options.projectId === undefined
        ? {}
        : { projectId: options.projectId })
    });
  }

  private async createClient(
    options: DbaasContextOptions
  ): Promise<DbaasClient> {
    const credentials = await this.resolveCredentials(options);
    return this.dependencies.createDbaasClient(credentials);
  }

  private async resolveVpcEntry(
    options: {
      subnetId?: string;
      vpcId: string;
    } & DbaasContextOptions
  ): Promise<{
    subnetId: number | null;
    vpcEntry: DbaasVpcEntry;
    vpcId: number;
  }> {
    const vpcId = normalizeRequiredNumericId(
      options.vpcId,
      'VPC ID',
      '--vpc-id'
    );
    const subnetId =
      options.subnetId === undefined
        ? null
        : normalizeRequiredNumericId(
            options.subnetId,
            'Subnet ID',
            '--subnet-id'
          );
    const credentials = await this.resolveCredentials(options);
    const vpcClient = this.dependencies.createVpcClient(credentials);
    const vpc = await vpcClient.getVpc(vpcId);

    return {
      subnetId,
      vpcEntry: buildDbaasVpcEntry(vpc, subnetId),
      vpcId
    };
  }

  private async updateWhitelistedIp(
    action: 'attach' | 'detach',
    dbaasId: string,
    options: DbaasWhitelistUpdateOptions
  ): Promise<DbaasWhitelistUpdateCommandResult> {
    const normalizedDbaasId = normalizeDbaasIdArg(dbaasId);
    const ip = normalizeIpAddress(options.ip);
    const client = await this.createClient(options);
    const result = await client.updateWhitelistedIps(
      normalizedDbaasId,
      action,
      {
        allowed_hosts: [{ ip }]
      }
    );

    return {
      action: action === 'attach' ? 'whitelist-add' : 'whitelist-remove',
      dbaas_id: normalizedDbaasId,
      ip,
      message: normalizeOptionalString(result.message)
    };
  }

  private async loadPassword(options: DbaasPasswordOptions): Promise<string> {
    const source = normalizePasswordSource(options);

    try {
      const content =
        source.kind === 'value'
          ? source.value
          : source.path === '-'
            ? await this.dependencies.readPasswordFromStdin()
            : await this.dependencies.readPasswordFile(source.path);

      return normalizePassword(content, source.label);
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      throw source.kind === 'file'
        ? wrapPasswordReadError(source.path, error)
        : error;
    }
  }

  private async fetchAllWhitelistedIps(
    client: DbaasClient,
    dbaasId: number
  ): Promise<DbaasWhitelistedIp[]> {
    const items: DbaasWhitelistedIp[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= DBAAS_LIST_MAX_PAGES;
      pageNumber += 1
    ) {
      const response = await client.listWhitelistedIps(
        dbaasId,
        pageNumber,
        DBAAS_LIST_PAGE_SIZE
      );
      items.push(...response.items);

      const totalPages = response.total_page_number ?? 1;
      if (pageNumber >= totalPages) {
        return items;
      }
    }

    throw new CliError(
      'DBaaS whitelist listing exceeded the maximum supported pagination depth.',
      {
        code: 'DBAAS_WHITELIST_PAGINATION_LIMIT',
        exitCode: EXIT_CODES.network,
        suggestion:
          'Retry the command. If the problem persists, narrow the whitelist by removing stale entries.'
      }
    );
  }

  private async fetchAllDbaasClusters(
    client: DbaasClient,
    requestedType: SupportedDatabaseType | null
  ): Promise<DbaasClusterSummary[]> {
    const items: DbaasClusterSummary[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= DBAAS_LIST_MAX_PAGES;
      pageNumber += 1
    ) {
      const response = await client.listDbaas(
        pageNumber,
        DBAAS_LIST_PAGE_SIZE,
        {
          ...(requestedType === null ? {} : { softwareType: requestedType })
        }
      );
      items.push(...response.items);

      const totalPages = response.total_page_number ?? 1;
      if (pageNumber >= totalPages) {
        return items;
      }
    }

    throw new CliError(
      'DBaaS listing exceeded the maximum supported pagination depth.',
      {
        code: 'DBAAS_LIST_PAGINATION_LIMIT',
        exitCode: EXIT_CODES.network,
        suggestion:
          'Retry the command. If the problem persists, narrow the result set or inspect the account in the MyAccount UI.'
      }
    );
  }
}
