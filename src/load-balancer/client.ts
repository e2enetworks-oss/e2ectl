import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';
import {
  isLoadBalancerPublicIpReservedClient,
  normalizeLoadBalancerDetails
} from './mappers.js';

import type {
  LoadBalancerClient,
  LoadBalancerCreateRequest,
  LoadBalancerCreateResult,
  LoadBalancerDeleteQuery,
  LoadBalancerDetails,
  LoadBalancerListApiItem,
  LoadBalancerListApiResponse,
  LoadBalancerListPageResult,
  LoadBalancerPlan,
  LoadBalancerRawDetails,
  LoadBalancerSummary,
  LoadBalancerUpdateRequest
} from './types/index.js';

export type {
  LoadBalancerClient,
  LoadBalancerDeleteQuery
} from './types/index.js';

const LOAD_BALANCERS_PATH = '/appliances/load-balancers/';
const LOAD_BALANCER_PLANS_PATH = '/appliance-type/';
const APPLIANCES_PATH = '/appliances/';

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
    const response = await this.transport.get<
      ApiEnvelope<LoadBalancerRawDetails>
    >(buildAppliancePath(lbId));

    return normalizeLoadBalancerDetails(response.data);
  }

  async listLoadBalancerPlans(): Promise<LoadBalancerPlan[]> {
    const raw = await this.transport.get<
      ApiEnvelope<{ appliance_config: LoadBalancerPlan[] }[]>
    >(LOAD_BALANCER_PLANS_PATH);

    const data = raw.data;
    return Array.isArray(data) && data[0]?.appliance_config
      ? data[0].appliance_config
      : [];
  }

  async listLoadBalancersPage(
    pageNumber: number,
    perPage: number
  ): Promise<LoadBalancerListPageResult> {
    const response = await this.transport.get<LoadBalancerListApiResponse>(
      APPLIANCES_PATH,
      {
        query: {
          advance_search_string: 'false',
          page_no: String(pageNumber),
          per_page: String(perPage)
        }
      }
    );

    return {
      items: response.data.map(normalizeLoadBalancerSummary),
      ...(response.total_page_number === undefined
        ? {}
        : { total_page_number: response.total_page_number })
    };
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

function normalizeLoadBalancerSummary(
  item: LoadBalancerListApiItem
): LoadBalancerSummary {
  const context = item.appliance_instance?.[0]?.context;
  const lbMode = normalizeLoadBalancerMode(
    item.lb_mode ?? context?.lb_mode,
    context?.tcp_backend
  );
  const lbType = normalizeLoadBalancerType(item.lb_type ?? context?.lb_type);
  const publicIp = normalizePublicIp(
    item.public_ip ?? item.node_detail?.public_ip
  );
  const privateIp = normalizePublicIp(
    item.private_ip ?? item.node_detail?.private_ip
  );

  return {
    appliance_name: item.appliance_name ?? item.name ?? String(item.id),
    id: item.id,
    ...(lbMode === undefined ? {} : { lb_mode: lbMode }),
    ...(lbType === undefined ? {} : { lb_type: lbType }),
    ...(publicIp === undefined ? {} : { public_ip: publicIp }),
    public_ip_reserved: isLoadBalancerPublicIpReservedClient(
      item.node_detail?.allow_reserve_ip?.is_already_reserved,
      publicIp,
      context?.lb_reserve_ip
    ),
    ...(privateIp === undefined ? {} : { private_ip: privateIp }),

    status: item.status
  };
}

function normalizeLoadBalancerMode(
  lbMode: string | undefined,
  tcpBackend: unknown[] | undefined
): string | undefined {
  if (Array.isArray(tcpBackend) && tcpBackend.length > 0) {
    return 'TCP';
  }

  if (lbMode === undefined) {
    return undefined;
  }

  const normalized = lbMode.trim();
  return normalized.length === 0 ? undefined : normalized.toUpperCase();
}

function normalizeLoadBalancerType(
  lbType: string | undefined
): string | undefined {
  if (lbType === undefined) {
    return undefined;
  }

  const normalized = lbType.trim();
  return normalized.length === 0 ? undefined : normalized.toLowerCase();
}

function normalizePublicIp(
  publicIp: string | null | undefined
): string | null | undefined {
  if (publicIp === undefined) {
    return undefined;
  }

  if (publicIp === null) {
    return null;
  }

  const normalized = publicIp.trim();
  return normalized.length === 0 || normalized === '[]' ? null : normalized;
}
