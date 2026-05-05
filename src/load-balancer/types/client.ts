import type { ApiResponse } from '../../myaccount/index.js';
import type {
  LoadBalancerCreateRequest,
  LoadBalancerCreateResult,
  LoadBalancerDetails,
  LoadBalancerPlan,
  LoadBalancerSummary,
  LoadBalancerUpdateRequest
} from './api.js';

export interface LoadBalancerListContext {
  lb_reserve_ip?: string | null;
  lb_mode?: string;
  lb_type?: string;
  tcp_backend?: unknown[];
}

export interface LoadBalancerListApiItem {
  id: number;
  appliance_name?: string;
  name?: string;
  status: string;
  lb_mode?: string;
  lb_type?: string;
  public_ip?: string | null;
  private_ip?: string | null;
  node_detail?: {
    allow_reserve_ip?: {
      is_already_reserved?: boolean;
    };
    public_ip?: string | null;
    private_ip?: string | null;
  };
  appliance_instance?: Array<{
    context?: LoadBalancerListContext;
  }>;
}

export type LoadBalancerListApiResponse = ApiResponse<
  LoadBalancerListApiItem[],
  {
    total_count?: number;
    total_page_number?: number;
  }
>;

export type LoadBalancerDetailsContext = NonNullable<
  LoadBalancerDetails['context']
>[number];

export type LoadBalancerRawDetails = Omit<
  LoadBalancerDetails,
  'appliance_name' | 'context' | 'node_detail' | 'private_ip'
> & {
  appliance_name?: string;
  name?: string;
  node_detail?: {
    allow_reserve_ip?: {
      is_already_reserved?: boolean;
    };
    public_ip?: string | null;
    private_ip?: string | null;
  };
  private_ip?: string | null;
  appliance_instance?: Array<{
    context?: LoadBalancerDetailsContext;
  }>;
};

export interface LoadBalancerDeleteQuery {
  [key: string]: string | undefined;
  reserve_ip_required?: string;
}

export interface LoadBalancerListPageResult {
  items: LoadBalancerSummary[];
  total_page_number?: number;
}

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
  listLoadBalancersPage(
    pageNumber: number,
    perPage: number
  ): Promise<LoadBalancerListPageResult>;
  updateLoadBalancer(
    lbId: string,
    body: LoadBalancerUpdateRequest
  ): Promise<{ message: string }>;
}
