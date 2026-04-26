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
  DbaasResetPasswordRequest,
  DbaasResetPasswordResult,
  DbaasVpcAttachRequest,
  DbaasVpcAttachResult
} from './types.js';

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

export interface DbaasListFilters {
  softwareType?: string;
}

export interface DbaasClient {
  attachVpc(
    dbaasId: number,
    body: DbaasVpcAttachRequest
  ): Promise<DbaasVpcAttachResult>;
  createDbaas(body: DbaasCreateRequest): Promise<DbaasCreateResult>;
  deleteDbaas(dbaasId: number): Promise<DbaasDeleteResult>;
  getDbaas(dbaasId: number): Promise<DbaasClusterDetail>;
  listDbaas(
    pageNumber: number,
    perPage: number,
    filters?: DbaasListFilters
  ): Promise<DbaasListResult>;
  listPlans(softwareId?: number): Promise<DbaasPlanCatalog>;
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

  async getDbaas(dbaasId: number): Promise<DbaasClusterDetail> {
    const response = await this.transport.get<ApiEnvelope<DbaasClusterDetail>>(
      buildDbaasPath(dbaasId)
    );

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
