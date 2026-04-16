import type {
  ApiEnvelope,
  ApiResponse,
  MyAccountTransport
} from '../myaccount/index.js';

import type {
  VpcCreateRequest,
  VpcCreateResult,
  VpcDeleteResult,
  VpcListResult,
  VpcNodeActionRequest,
  VpcNodeActionResult,
  VpcPlan,
  VpcSummary
} from './types.js';

type VpcListApiResponse = ApiResponse<
  VpcSummary[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

const VPCS_PATH = '/vpc/';
const VPC_LIST_PATH = '/vpc/list/';
const VPC_PLANS_PATH = '/vpc/plans/';
const VPC_NODE_PATH = '/vpc/node/';

export interface VpcClient {
  attachNodeVpc(body: VpcNodeActionRequest): Promise<VpcNodeActionResult>;
  createVpc(body: VpcCreateRequest): Promise<VpcCreateResult>;
  deleteVpc(
    vpcId: number
  ): Promise<{ message: string; result: VpcDeleteResult }>;
  detachNodeVpc(body: VpcNodeActionRequest): Promise<VpcNodeActionResult>;
  getVpc(vpcId: number): Promise<VpcSummary>;
  listVpcPlans(): Promise<VpcPlan[]>;
  listVpcs(pageNumber: number, perPage: number): Promise<VpcListResult>;
}

export class VpcApiClient implements VpcClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async attachNodeVpc(
    body: VpcNodeActionRequest
  ): Promise<VpcNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<Omit<VpcNodeActionResult, 'message'>>
    >(buildVpcNodeActionPath('attach'), {
      body
    });

    return mapVpcNodeActionResponse(response);
  }

  async createVpc(body: VpcCreateRequest): Promise<VpcCreateResult> {
    const response = await this.transport.post<ApiEnvelope<VpcCreateResult>>(
      VPCS_PATH,
      {
        body
      }
    );

    return mapVpcCreateResponse(response);
  }

  async deleteVpc(
    vpcId: number
  ): Promise<{ message: string; result: VpcDeleteResult }> {
    const response = await this.transport.delete<ApiEnvelope<VpcDeleteResult>>(
      buildVpcPath(vpcId)
    );

    return mapVpcDeleteResponse(response);
  }

  async detachNodeVpc(
    body: VpcNodeActionRequest
  ): Promise<VpcNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<Omit<VpcNodeActionResult, 'message'>>
    >(buildVpcNodeActionPath('detach'), {
      body
    });

    return mapVpcNodeActionResponse(response);
  }

  async getVpc(vpcId: number): Promise<VpcSummary> {
    const response = await this.transport.get<ApiEnvelope<VpcSummary>>(
      buildVpcPath(vpcId)
    );

    return mapVpcSummaryResponse(response);
  }

  async listVpcPlans(): Promise<VpcPlan[]> {
    const response =
      await this.transport.get<ApiEnvelope<VpcPlan[]>>(VPC_PLANS_PATH);

    return mapVpcPlansResponse(response);
  }

  async listVpcs(pageNumber: number, perPage: number): Promise<VpcListResult> {
    const response = await this.transport.get<VpcListApiResponse>(
      VPC_LIST_PATH,
      {
        query: {
          page_no: String(pageNumber),
          per_page: String(perPage)
        }
      }
    );

    return mapVpcListResponse(response);
  }
}

function buildVpcPath(vpcId: number): string {
  return `${VPCS_PATH}${vpcId}/`;
}

function buildVpcNodeActionPath(
  action: VpcNodeActionRequest['action']
): string {
  return `${VPC_NODE_PATH}${action}/`;
}

function mapVpcNodeActionResponse(
  response: ApiEnvelope<Omit<VpcNodeActionResult, 'message'>>
): VpcNodeActionResult {
  return {
    message: response.message,
    ...response.data
  };
}

function mapVpcCreateResponse(
  response: ApiEnvelope<VpcCreateResult>
): VpcCreateResult {
  return response.data;
}

function mapVpcDeleteResponse(response: ApiEnvelope<VpcDeleteResult>): {
  message: string;
  result: VpcDeleteResult;
} {
  return {
    message: response.message,
    result: response.data
  };
}

function mapVpcSummaryResponse(response: ApiEnvelope<VpcSummary>): VpcSummary {
  return response.data;
}

function mapVpcPlansResponse(response: ApiEnvelope<VpcPlan[]>): VpcPlan[] {
  return response.data;
}

function mapVpcListResponse(response: VpcListApiResponse): VpcListResult {
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
