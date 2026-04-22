import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  LoadBalancerCreateRequest,
  LoadBalancerCreateResult,
  LoadBalancerDetails,
  LoadBalancerPlan,
  LoadBalancerSummary,
  LoadBalancerUpdateRequest
} from './types.js';

const LOAD_BALANCERS_PATH = '/appliances/load-balancers/';
const LOAD_BALANCER_PLANS_PATH = '/appliances/load-balancers/plans/';
const APPLIANCES_PATH = '/appliances/';

export type LoadBalancerDeleteQuery = Record<'reserve_ip_required', 'true'>;

export interface LoadBalancerClient {
  createLoadBalancer(
    body: LoadBalancerCreateRequest
  ): Promise<LoadBalancerCreateResult>;
  deleteLoadBalancer(
    lbId: string,
    query?: LoadBalancerDeleteQuery
  ): Promise<{ message: string }>;
  getLoadBalancer(lbId: string): Promise<LoadBalancerDetails>;
  listLoadBalancerPlans(): Promise<LoadBalancerPlan[]>;
  listLoadBalancers(): Promise<LoadBalancerSummary[]>;
  updateLoadBalancer(
    lbId: string,
    body: LoadBalancerUpdateRequest
  ): Promise<{ message: string }>;
}

export class LoadBalancerApiClient implements LoadBalancerClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createLoadBalancer(
    body: LoadBalancerCreateRequest
  ): Promise<LoadBalancerCreateResult> {
    const response = await this.transport.post<
      ApiEnvelope<LoadBalancerCreateResult>
    >(LOAD_BALANCERS_PATH, { body });

    return response.data;
  }

  async deleteLoadBalancer(
    lbId: string,
    query?: LoadBalancerDeleteQuery
  ): Promise<{ message: string }> {
    const response = await this.transport.delete<ApiEnvelope<unknown>>(
      buildAppliancePath(lbId),
      query === undefined ? undefined : { query }
    );

    return { message: response.message };
  }

  async getLoadBalancer(lbId: string): Promise<LoadBalancerDetails> {
    const response = await this.transport.get<ApiEnvelope<LoadBalancerDetails>>(
      buildLoadBalancerPath(lbId)
    );

    return response.data;
  }

  async listLoadBalancerPlans(): Promise<LoadBalancerPlan[]> {
    const response = await this.transport.get<ApiEnvelope<LoadBalancerPlan[]>>(
      LOAD_BALANCER_PLANS_PATH
    );

    return response.data;
  }

  async listLoadBalancers(): Promise<LoadBalancerSummary[]> {
    const response =
      await this.transport.get<ApiEnvelope<LoadBalancerSummary[]>>(
        LOAD_BALANCERS_PATH
      );

    return response.data;
  }

  async updateLoadBalancer(
    lbId: string,
    body: LoadBalancerUpdateRequest
  ): Promise<{ message: string }> {
    const response = await this.transport.request<ApiEnvelope<unknown>>({
      body,
      method: 'PUT',
      path: buildLoadBalancerPath(lbId)
    });

    return { message: response.message };
  }
}

function buildLoadBalancerPath(lbId: string): string {
  return `${LOAD_BALANCERS_PATH}${lbId}/`;
}

function buildAppliancePath(lbId: string): string {
  return `${APPLIANCES_PATH}${lbId}/`;
}
