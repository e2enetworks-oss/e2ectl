import type {
  LoadBalancerAclMapRule,
  LoadBalancerAclRule,
  LoadBalancerAlgorithm,
  LoadBalancerBackend,
  LoadBalancerMode,
  LoadBalancerDetails,
  LoadBalancerServer,
  LoadBalancerTcpBackend,
  LoadBalancerUpdateRequest,
  LoadBalancerVpc,
  LoadBalancerVpcAttachment
} from './api.js';
import type { ResolvedLoadBalancerCreateBilling } from './service.js';

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
  name?: string;
}

export interface LoadBalancerBackendServerMutationResult {
  ambiguous: boolean;
  groupFound: boolean;
  lastServer: boolean;
  removedServer: LoadBalancerServer | null;
  serverFound: boolean;
  overrides: Partial<LoadBalancerUpdateRequestOverrides> | null;
}

export interface LoadBalancerAlbBackendGroupInput {
  algorithm: LoadBalancerAlgorithm;
  backendProtocol: 'HTTP' | 'HTTPS';
  includeScalerDefaults?: boolean;
  name: string;
  servers: LoadBalancerServer[];
}

export interface LoadBalancerTcpBackendGroupInput {
  algorithm: LoadBalancerAlgorithm;
  name: string;
  port: number;
  servers: LoadBalancerServer[];
}

export interface LoadBalancerCreateRequestInput {
  backends: LoadBalancerBackend[];
  billing: ResolvedLoadBalancerCreateBilling;
  lbType: LoadBalancerVpc;
  mode: LoadBalancerMode;
  name: string;
  port: number;
  reserveIp: string;
  securityGroupId: number | null;
  sslCertificateId: number | null;
  tcpBackend: LoadBalancerTcpBackend[];
  vpcList: LoadBalancerVpcAttachment[];
}
