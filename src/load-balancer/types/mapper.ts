import type {
  LoadBalancerAclMapRule,
  LoadBalancerAclRule,
  LoadBalancerAlgorithm,
  LoadBalancerBackend,
  LoadBalancerDetails,
  LoadBalancerServer,
  LoadBalancerTcpBackend,
  LoadBalancerUpdateRequest
} from './api.js';

export type LoadBalancerContextPayload = NonNullable<
  LoadBalancerDetails['context']
>[number];

export interface LoadBalancerContextAclData {
  aclList: LoadBalancerAclRule[];
  aclMap: LoadBalancerAclMapRule[];
}

export type LoadBalancerUpdateRequestOverrides = Pick<
  LoadBalancerUpdateRequest,
  | 'acl_list'
  | 'acl_map'
  | 'backends'
  | 'lb_mode'
  | 'lb_port'
  | 'plan_name'
  | 'tcp_backend'
> &
  Partial<
    Pick<
      LoadBalancerUpdateRequest,
      | 'lb_name'
      | 'lb_reserve_ip'
      | 'lb_type'
      | 'ssl_certificate_id'
      | 'ssl_context'
      | 'vpc_list'
    >
  >;

export interface ResolvedLoadBalancerMutationContext {
  aclList: LoadBalancerAclRule[];
  aclMap: LoadBalancerAclMapRule[];
  backends: LoadBalancerBackend[];
  context: LoadBalancerContextPayload;
  isNlb: boolean;
  lbPort: string;
  planName: string;
  tcpBackends: LoadBalancerTcpBackend[];
}

export interface LoadBalancerBackendGroupMutationResult {
  exists: boolean;
  lastGroup: boolean;
  overrides: Partial<LoadBalancerUpdateRequestOverrides> | null;
}

export interface LoadBalancerBackendGroupUpdatePatch {
  algorithm?: LoadBalancerAlgorithm;
  backendProtocol?: 'HTTP' | 'HTTPS';
}

export interface LoadBalancerBackendServerPatch {
  backend_ip?: string;
  backend_port?: number;
}

export interface LoadBalancerBackendServerMutationResult {
  ambiguous: boolean;
  groupFound: boolean;
  lastServer: boolean;
  removedServer: LoadBalancerServer | null;
  serverFound: boolean;
  overrides: Partial<LoadBalancerUpdateRequestOverrides> | null;
}
