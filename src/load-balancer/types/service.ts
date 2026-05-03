import type { ConfigFile, ResolvedCredentials } from '../../config/index.js';
import type { ReservedIpClient } from '../../reserved-ip/index.js';
import type { VpcClient } from '../../vpc/index.js';
import type { LoadBalancerCommittedStatus } from './api.js';
import type { LoadBalancerClient } from './client.js';

export interface LoadBalancerStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface LoadBalancerServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createLoadBalancerClient(
    credentials: ResolvedCredentials
  ): LoadBalancerClient;
  createReservedIpClient(credentials: ResolvedCredentials): ReservedIpClient;
  createVpcClient(credentials: ResolvedCredentials): VpcClient;
  isInteractive: boolean;
  store: LoadBalancerStore;
}

export interface LoadBalancerCreateBillingSelectionOptions {
  billingType?: string;
  committedPlan?: string;
  committedPlanId?: string;
  postCommitBehavior?: string;
}

export interface ResolvedLoadBalancerCreateBilling {
  basePlanName: string;
  committedPlanId: number | null;
  committedPlanName: string | null;
  postCommitBehavior: LoadBalancerCommittedStatus | null;
  type: 'committed' | 'hourly';
}
