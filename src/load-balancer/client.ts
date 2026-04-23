import type {
  ApiEnvelope,
  ApiResponse,
  MyAccountTransport
} from '../myaccount/index.js';

import type {
  LoadBalancerCreateRequest,
  LoadBalancerCreateResult,
  LoadBalancerDetails,
  LoadBalancerPlan,
  LoadBalancerSummary,
  LoadBalancerUpdateRequest
} from './types.js';

const LOAD_BALANCERS_PATH = '/appliances/load-balancers/';
const LOAD_BALANCER_PLANS_PATH = '/appliance-type/';
const APPLIANCES_PATH = '/appliances/';
const LOAD_BALANCER_LIST_PAGE_SIZE = 100;

interface LoadBalancerListContext {
  lb_mode?: string;
  lb_type?: string;
  tcp_backend?: unknown[];
}

interface LoadBalancerListApiItem {
  id: number;
  appliance_name?: string;
  name?: string;
  status: string;
  lb_mode?: string;
  lb_type?: string;
  public_ip?: string | null;
  private_ip?: string | null;
  node_detail?: {
    public_ip?: string | null;
    private_ip?: string | null;
  };
  appliance_instance?: Array<{
    context?: LoadBalancerListContext;
  }>;
}

type LoadBalancerListApiResponse = ApiResponse<
  LoadBalancerListApiItem[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

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
    type RawDetail = Omit<LoadBalancerDetails, 'appliance_name' | 'context'> & {
      appliance_name?: string;
      name?: string;
      node_detail?: {
        public_ip?: string | null;
        private_ip?: string | null;
      };
      private_ip?: string | null;
      appliance_instance?: Array<{
        context?: LoadBalancerDetails['context'] extends
          | Array<infer T>
          | undefined
          ? T
          : never;
      }>;
    };

    const response = await this.transport.get<ApiEnvelope<RawDetail>>(
      buildAppliancePath(lbId)
    );

    const data = response.data;
    const context = data.appliance_instance
      ?.map((instance) => instance.context)
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    const primaryContext = context?.[0] as
      | { lb_mode?: string; lb_type?: string }
      | undefined;
    const result: LoadBalancerDetails = {
      ...data,
      appliance_name: data.appliance_name ?? data.name ?? String(data.id),
      context
    };

    const lbMode = data.lb_mode ?? primaryContext?.lb_mode;
    if (lbMode !== undefined) {
      result.lb_mode = lbMode;
    }

    const lbType = data.lb_type ?? primaryContext?.lb_type;
    if (lbType !== undefined) {
      result.lb_type = lbType;
    }

    const publicIp = data.public_ip ?? data.node_detail?.public_ip;
    if (publicIp !== undefined) {
      result.public_ip = publicIp;
    }

    const privateIp = data.private_ip ?? data.node_detail?.private_ip;
    if (privateIp !== undefined) {
      (
        result as LoadBalancerDetails & { private_ip?: string | null }
      ).private_ip = privateIp;
    }

    return result;
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

  async listLoadBalancers(): Promise<LoadBalancerSummary[]> {
    const items: LoadBalancerSummary[] = [];
    let pageNumber = 1;
    let totalPages: number | undefined;

    while (true) {
      const response = await this.transport.get<LoadBalancerListApiResponse>(
        APPLIANCES_PATH,
        {
          query: {
            advance_search_string: 'false',
            page_no: String(pageNumber),
            per_page: String(LOAD_BALANCER_LIST_PAGE_SIZE)
          }
        }
      );

      items.push(...response.data.map(normalizeLoadBalancerSummary));
      totalPages = response.total_page_number ?? totalPages;

      if (totalPages !== undefined) {
        if (pageNumber >= totalPages) {
          break;
        }
      } else if (response.data.length < LOAD_BALANCER_LIST_PAGE_SIZE) {
        break;
      }

      pageNumber += 1;
    }

    return items;
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
