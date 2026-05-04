import type {
  LoadBalancerAlgorithm,
  LoadBalancerBackend,
  LoadBalancerCommittedStatus,
  LoadBalancerCreateResult,
  LoadBalancerDetails,
  LoadBalancerMode,
  LoadBalancerPlan,
  LoadBalancerServer,
  LoadBalancerSummary,
  LoadBalancerTcpBackend,
  LoadBalancerVpc
} from './api.js';

export interface LoadBalancerGlobalOptions {
  json?: boolean;
}

export interface LoadBalancerContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface LoadBalancerCreateOptions extends LoadBalancerContextOptions {
  billingType?: string;
  committedPlan?: string;
  committedPlanId?: string;
  lbType?: string;
  name: string;
  plan: string;
  frontendProtocol?: string;
  port?: string;
  networkId?: string;
  postCommitBehavior?: string;
  vpc?: string;
  subnet?: string;
  backendGroup?: string;
  backendServer?: string[];
  algorithm?: string;
  backendProtocol?: string;
  reserveIp?: string;
  securityGroupId?: string;
  sslCertificateId?: string;
}

export interface LoadBalancerDeleteOptions extends LoadBalancerContextOptions {
  force?: boolean;
  reservePublicIp?: boolean;
}

export interface LoadBalancerUpdateOptions extends LoadBalancerContextOptions {
  frontendProtocol?: string;
  name?: string;
  redirectHttpToHttps?: boolean;
  sslCertificateId?: string;
}

export interface LoadBalancerVpcAttachOptions extends LoadBalancerContextOptions {
  subnet?: string;
  vpc: string;
}

export interface LoadBalancerVpcDetachOptions extends LoadBalancerContextOptions {
  vpc: string;
}

export interface LoadBalancerBackendGroupCreateOptions extends LoadBalancerContextOptions {
  name: string;
  algorithm?: string;
  backendProtocol?: string;
  backendServer?: string[];
  httpCheck?: boolean;
  serverIp?: string;
  serverName?: string;
  serverPort?: string;
}

export interface LoadBalancerBackendGroupUpdateOptions extends LoadBalancerContextOptions {
  algorithm?: string;
  backendProtocol?: string;
}

export interface LoadBalancerBackendServerAddOptions extends LoadBalancerContextOptions {
  backendGroup?: string;
  backendServer?: string;
}

export interface LoadBalancerBackendServerUpdateOptions extends LoadBalancerContextOptions {
  backendGroup: string;
  backendServerName: string;
  ip?: string;
  port?: string;
}

export interface LoadBalancerBackendServerDeleteOptions extends LoadBalancerContextOptions {
  backendGroup?: string;
  backendServerName?: string;
  backendName?: string;
  serverIp?: string;
  serverName?: string;
  serverPort?: string;
}

export interface LoadBalancerListCommandResult {
  action: 'list';
  items: LoadBalancerSummary[];
}

export interface LoadBalancerGetCommandResult {
  action: 'get';
  item: LoadBalancerDetails;
}

export interface LoadBalancerCreateCommandResult {
  action: 'create';
  billing: {
    committed_plan_id: number | null;
    committed_plan_name: string | null;
    post_commit_behavior: LoadBalancerCommittedStatus | null;
    type: 'committed' | 'hourly';
  };
  backend: LoadBalancerCreatedBackendSummary;
  requested: LoadBalancerRequestedSummary;
  result: LoadBalancerCreateResult;
}

export interface LoadBalancerDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  lb_id: string;
  message?: string;
}

export interface LoadBalancerUpdateCommandResult {
  action: 'update';
  lb_id: string;
  lb_name: string;
  message: string;
  changes: {
    name?: string;
    protocol?: string;
    ssl_certificate_id?: number;
    redirect_http_to_https?: boolean;
  };
}

export interface LoadBalancerBackendGroupListCommandResult {
  action: 'backend-group-list';
  lb_id: string;
  lb_mode: string;
  backends: LoadBalancerBackend[];
  tcp_backends: LoadBalancerTcpBackend[];
}

export interface LoadBalancerBackendGroupCreateCommandResult {
  action: 'backend-group-add';
  group: LoadBalancerCreatedBackendSummary;
  lb_id: string;
  lb_name: string;
  message: string;
}

export interface LoadBalancerBackendGroupUpdateCommandResult {
  action: 'backend-group-update';
  group_name: string;
  lb_id: string;
  lb_name: string;
  message: string;
  algorithm?: string;
  backend_protocol?: string;
}

export interface LoadBalancerBackendGroupDeleteCommandResult {
  action: 'backend-group-remove';
  lb_id: string;
  lb_name: string;
  group_name: string;
  message: string;
}

export interface LoadBalancerBackendServerAddCommandResult {
  action: 'backend-server-add';
  group_name: string;
  lb_id: string;
  lb_name: string;
  message: string;
  server_name: string;
}

export interface LoadBalancerBackendServerUpdateCommandResult {
  action: 'backend-server-update';
  group_name: string;
  lb_id: string;
  lb_name: string;
  message: string;
  server_name: string;
  ip?: string;
  port?: string;
}

export interface LoadBalancerBackendServerDeleteCommandResult {
  action: 'backend-server-remove';
  group_name: string;
  lb_id: string;
  lb_name: string;
  message: string;
  server_name: string;
}

export interface LoadBalancerNetworkCommandResult {
  action:
    | 'network-reserve-ip-reserve'
    | 'network-vpc-attach'
    | 'network-vpc-detach';
  lb_id: string;
  lb_name: string;
  message: string;
  reserve_ip?: string;
  vpc_id?: string;
  subnet_id?: string;
}

export interface LoadBalancerPlansCommandResult {
  action: 'plans';
  items: LoadBalancerPlan[];
}

export interface LoadBalancerRequestedSummary {
  frontend_port: number;
  mode: LoadBalancerMode;
  name: string;
  plan_name: string;
  type: LoadBalancerVpc;
}

export interface LoadBalancerCreatedBackendSummary {
  backend_port: number | null;
  health_check: boolean | null;
  name: string;
  protocol: 'HTTP' | 'HTTPS' | 'TCP';
  routing_policy: LoadBalancerAlgorithm;
  servers: LoadBalancerServer[];
}

export type LoadBalancerCommandResult =
  | LoadBalancerListCommandResult
  | LoadBalancerGetCommandResult
  | LoadBalancerCreateCommandResult
  | LoadBalancerDeleteCommandResult
  | LoadBalancerUpdateCommandResult
  | LoadBalancerPlansCommandResult
  | LoadBalancerBackendGroupListCommandResult
  | LoadBalancerBackendGroupCreateCommandResult
  | LoadBalancerBackendGroupUpdateCommandResult
  | LoadBalancerBackendGroupDeleteCommandResult
  | LoadBalancerBackendServerAddCommandResult
  | LoadBalancerBackendServerUpdateCommandResult
  | LoadBalancerBackendServerDeleteCommandResult
  | LoadBalancerNetworkCommandResult;
