import type {
  ApiEnvelope,
  ApiResponse,
  MyAccountTransport
} from '../myaccount/index.js';

import type {
  DbaasClusterDetail,
  DbaasClusterSummary,
  DbaasCreateRequest,
  DbaasCreateResult,
  DbaasDeleteResult,
  DbaasListResult,
  DbaasPlanCatalog,
  DbaasPublicIpActionResult,
  DbaasPublicIpStatusResult,
  DbaasResetPasswordRequest,
  DbaasResetPasswordResult,
  DbaasVpcAttachRequest,
  DbaasVpcAttachResult,
  DbaasVpcConnection,
  DbaasVpcDetachRequest,
  DbaasVpcDetachResult,
  DbaasWhitelistActionResult,
  DbaasWhitelistListResult,
  DbaasWhitelistUpdateRequest
} from './types/index.js';

type DbaasListApiResponse = ApiResponse<
  DbaasClusterSummary[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

const DBAAS_CLUSTERS_PATH = '/rds/cluster/';
const DBAAS_PLANS_PATH = '/rds/plans/';
const DBAAS_VPC_ATTACH_SUFFIX = 'vpc-attach/';
const DBAAS_VPC_DETACH_SUFFIX = 'vpc-detach/';
const DBAAS_VPC_LIST_SUFFIX = 'vpc/';
const DBAAS_PUBLIC_IP_STATUS_SUFFIX = 'public-ip-status/';
const DBAAS_PUBLIC_IP_ATTACH_SUFFIX = 'public-ip-attach/';
const DBAAS_PUBLIC_IP_DETACH_SUFFIX = 'public-ip-detach/';
const DBAAS_UPDATE_ALLOWED_HOSTS_SUFFIX = 'update-allowed-hosts';

export interface DbaasListFilters {
  softwareType?: string;
}

export interface DbaasClient {
  attachVpc(
    dbaasId: number,
    body: DbaasVpcAttachRequest
  ): Promise<DbaasVpcAttachResult>;
  attachPublicIp(dbaasId: number): Promise<DbaasPublicIpActionResult>;
  createDbaas(body: DbaasCreateRequest): Promise<DbaasCreateResult>;
  deleteDbaas(dbaasId: number): Promise<DbaasDeleteResult>;
  detachPublicIp(dbaasId: number): Promise<DbaasPublicIpActionResult>;
  detachVpc(
    dbaasId: number,
    body: DbaasVpcDetachRequest
  ): Promise<DbaasVpcDetachResult>;
  getDbaas(dbaasId: number): Promise<DbaasClusterDetail>;
  getPublicIpStatus(dbaasId: number): Promise<DbaasPublicIpStatusResult>;
  listDbaas(
    pageNumber: number,
    perPage: number,
    filters?: DbaasListFilters
  ): Promise<DbaasListResult>;
  listPlans(softwareId?: number): Promise<DbaasPlanCatalog>;
  listVpcConnections(dbaasId: number): Promise<DbaasVpcConnection[]>;
  listWhitelistedIps(
    dbaasId: number,
    pageNumber: number,
    perPage: number
  ): Promise<DbaasWhitelistListResult>;
  updateWhitelistedIps(
    dbaasId: number,
    action: 'attach' | 'detach',
    body: DbaasWhitelistUpdateRequest
  ): Promise<DbaasWhitelistActionResult>;
  resetPassword(
    dbaasId: number,
    body: DbaasResetPasswordRequest
  ): Promise<DbaasResetPasswordResult>;
}

export class DbaasApiClient implements DbaasClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async attachVpc(
    dbaasId: number,
    body: DbaasVpcAttachRequest
  ): Promise<DbaasVpcAttachResult> {
    const response = await this.transport.request<
      ApiEnvelope<DbaasVpcAttachResult>
    >({
      body,
      method: 'PUT',
      path: `${buildDbaasPath(dbaasId)}${DBAAS_VPC_ATTACH_SUFFIX}`
    });

    return response.data;
  }

  async attachPublicIp(dbaasId: number): Promise<DbaasPublicIpActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<Record<string, never>>
    >({
      method: 'PUT',
      path: `${buildDbaasPath(dbaasId)}${DBAAS_PUBLIC_IP_ATTACH_SUFFIX}`
    });

    return { message: response.message };
  }

  async createDbaas(body: DbaasCreateRequest): Promise<DbaasCreateResult> {
    const response = await this.transport.post<ApiEnvelope<DbaasCreateResult>>(
      DBAAS_CLUSTERS_PATH,
      {
        body
      }
    );

    return response.data;
  }

  async deleteDbaas(dbaasId: number): Promise<DbaasDeleteResult> {
    const response = await this.transport.delete<
      ApiEnvelope<DbaasDeleteResult>
    >(buildDbaasPath(dbaasId));

    return response.data;
  }

  async detachPublicIp(dbaasId: number): Promise<DbaasPublicIpActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<Record<string, never>>
    >({
      method: 'PUT',
      path: `${buildDbaasPath(dbaasId)}${DBAAS_PUBLIC_IP_DETACH_SUFFIX}`
    });

    return { message: response.message };
  }

  async detachVpc(
    dbaasId: number,
    body: DbaasVpcDetachRequest
  ): Promise<DbaasVpcDetachResult> {
    const response = await this.transport.request<
      ApiEnvelope<DbaasVpcDetachResult>
    >({
      body,
      method: 'PUT',
      path: `${buildDbaasPath(dbaasId)}${DBAAS_VPC_DETACH_SUFFIX}`
    });

    return {
      message: response.message,
      ...response.data
    };
  }

  async getDbaas(dbaasId: number): Promise<DbaasClusterDetail> {
    const response = await this.transport.get<ApiEnvelope<DbaasClusterDetail>>(
      buildDbaasPath(dbaasId)
    );

    return response.data;
  }

  async getPublicIpStatus(dbaasId: number): Promise<DbaasPublicIpStatusResult> {
    const response = await this.transport.get<
      ApiEnvelope<DbaasPublicIpStatusResult>
    >(`${buildDbaasPath(dbaasId)}${DBAAS_PUBLIC_IP_STATUS_SUFFIX}`);

    return response.data;
  }

  async listDbaas(
    pageNumber: number,
    perPage: number,
    filters: DbaasListFilters = {}
  ): Promise<DbaasListResult> {
    const response = await this.transport.get<DbaasListApiResponse>(
      DBAAS_CLUSTERS_PATH,
      {
        query: {
          page_no: String(pageNumber),
          per_page: String(perPage),
          ...(filters.softwareType === undefined
            ? {}
            : { software_type: filters.softwareType })
        }
      }
    );

    return {
      items: response.data,
      ...(response.total_count === undefined
        ? {}
        : { total_count: response.total_count }),
      ...(response.total_page_number === undefined
        ? {}
        : { total_page_number: response.total_page_number })
    };
  }

  async listPlans(softwareId?: number): Promise<DbaasPlanCatalog> {
    const response = await this.transport.get<ApiEnvelope<DbaasPlanCatalog>>(
      DBAAS_PLANS_PATH,
      softwareId === undefined
        ? {}
        : {
            query: { software_id: String(softwareId) }
          }
    );

    return response.data;
  }

  async listVpcConnections(dbaasId: number): Promise<DbaasVpcConnection[]> {
    const response = await this.transport.get<
      ApiEnvelope<DbaasVpcConnection[]>
    >(`${buildDbaasPath(dbaasId)}${DBAAS_VPC_LIST_SUFFIX}`);

    return response.data;
  }

  async listWhitelistedIps(
    dbaasId: number,
    pageNumber: number,
    perPage: number
  ): Promise<DbaasWhitelistListResult> {
    const response = await this.transport.get<
      ApiResponse<
        DbaasWhitelistListResult['items'],
        {
          total_count?: number;
          total_page_number?: number;
        }
      >
    >(`${buildDbaasPath(dbaasId)}${DBAAS_UPDATE_ALLOWED_HOSTS_SUFFIX}`, {
      query: {
        page: String(pageNumber),
        page_size: String(perPage)
      }
    });

    return {
      items: response.data,
      ...(response.total_count === undefined
        ? {}
        : { total_count: response.total_count }),
      ...(response.total_page_number === undefined
        ? {}
        : { total_page_number: response.total_page_number })
    };
  }

  async updateWhitelistedIps(
    dbaasId: number,
    action: 'attach' | 'detach',
    body: DbaasWhitelistUpdateRequest
  ): Promise<DbaasWhitelistActionResult> {
    const response = await this.transport.request<
      ApiEnvelope<Record<string, never>>
    >({
      body,
      method: 'PUT',
      path: `${buildDbaasPath(dbaasId)}${DBAAS_UPDATE_ALLOWED_HOSTS_SUFFIX}`,
      query: { action }
    });

    return { message: response.message };
  }

  async resetPassword(
    dbaasId: number,
    body: DbaasResetPasswordRequest
  ): Promise<DbaasResetPasswordResult> {
    const response = await this.transport.request<
      ApiEnvelope<Omit<DbaasResetPasswordResult, 'message'>>
    >({
      body,
      method: 'PUT',
      path: buildResetPasswordPath(dbaasId)
    });

    return {
      message: response.message,
      ...response.data
    };
  }
}

function buildDbaasPath(dbaasId: number): string {
  return `${DBAAS_CLUSTERS_PATH}${dbaasId}/`;
}

function buildResetPasswordPath(dbaasId: number): string {
  return `${buildDbaasPath(dbaasId)}reset-password/`;
}
