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
    >('/vpc/node/attach/', {
      body
    });

    return {
      message: response.message,
      ...response.data
    };
  }

  async createVpc(body: VpcCreateRequest): Promise<VpcCreateResult> {
    const response = await this.transport.post<ApiEnvelope<VpcCreateResult>>(
      '/vpc/',
      {
        body
      }
    );

    return response.data;
  }

  async deleteVpc(
    vpcId: number
  ): Promise<{ message: string; result: VpcDeleteResult }> {
    const response = await this.transport.delete<ApiEnvelope<VpcDeleteResult>>(
      `/vpc/${vpcId}/`
    );

    return {
      message: response.message,
      result: response.data
    };
  }

  async detachNodeVpc(
    body: VpcNodeActionRequest
  ): Promise<VpcNodeActionResult> {
    const response = await this.transport.post<
      ApiEnvelope<Omit<VpcNodeActionResult, 'message'>>
    >('/vpc/node/detach/', {
      body
    });

    return {
      message: response.message,
      ...response.data
    };
  }

  async getVpc(vpcId: number): Promise<VpcSummary> {
    const response = await this.transport.get<ApiEnvelope<VpcSummary>>(
      `/vpc/${vpcId}/`
    );

    return response.data;
  }

  async listVpcPlans(): Promise<VpcPlan[]> {
    const response =
      await this.transport.get<ApiEnvelope<VpcPlan[]>>('/vpc/plans/');

    return response.data;
  }

  async listVpcs(pageNumber: number, perPage: number): Promise<VpcListResult> {
    const response = await this.transport.get<VpcListApiResponse>(
      '/vpc/list/',
      {
        query: {
          page_no: String(pageNumber),
          per_page: String(perPage)
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
}
