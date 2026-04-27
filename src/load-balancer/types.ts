export type LoadBalancerMode = 'HTTP' | 'HTTPS' | 'BOTH' | 'TCP';
export type LoadBalancerVpc = 'external' | 'internal';
export type LoadBalancerAlgorithm = 'source' | 'roundrobin' | 'leastconn';
export type LoadBalancerCommittedStatus = 'auto_renew' | 'hourly_billing';

export interface LoadBalancerCommittedPlan {
  committed_days?: number;
  committed_node_message?: string;
  committed_sku_id: number;
  committed_sku_name: string;
  committed_sku_price: number;
  committed_upto_date?: string | null;
}

export interface LoadBalancerPlan {
  template_id: string;
  name: string;
  price: number;
  hourly?: number;
  vcpu?: number;
  ram?: number;
  disk?: number;
  committed_sku?: LoadBalancerCommittedPlan[];
}

export type LoadBalancerPlanItem = LoadBalancerPlan;

export interface LoadBalancerServer {
  backend_name: string;
  backend_ip: string;
  backend_port: number;
  target?: string;
}

export interface LoadBalancerBackend {
  name: string;
  domain_name: string;
  backend_mode?: 'http' | 'https';
  balance: LoadBalancerAlgorithm;
  backend_ssl: boolean;
  http_check: boolean;
  check_url: string;
  servers: LoadBalancerServer[];
  websocket_timeout?: number | null;
  target?: string;
  checkbox_enable?: boolean;
  scaler_port?: string | null;
  scaler_id?: string | null;
}

export interface LoadBalancerTcpBackend {
  backend_name: string;
  port: number;
  balance: LoadBalancerAlgorithm;
  servers: LoadBalancerServer[];
}

export interface LoadBalancerAclRule {
  acl_name: string;
  acl_condition: string;
  acl_matching_path: string;
}

export interface LoadBalancerAclMapRule {
  acl_name: string;
  acl_condition_state: boolean | string;
  acl_backend: string;
}

export interface LoadBalancerPlansCommandResult {
  action: 'plans';
  items: LoadBalancerPlanItem[];
  message?: string;
}

export interface LoadBalancerVpcAttachment {
  ip?: string | null;
  ipv4_cidr: string;
  network_id: number | string;
  subnet_id?: number | string | null;
  subnet_name?: string | null;
  vpc_name: string;
}

export interface LoadBalancerCreateRequest {
  lb_name: string;
  lb_type: LoadBalancerVpc;
  lb_mode: LoadBalancerMode;
  lb_port: string;
  plan_name: string;
  node_list_type: 'S' | 'D';
  backends: LoadBalancerBackend[];
  tcp_backend: LoadBalancerTcpBackend[];
  acl_list: LoadBalancerAclRule[];
  acl_map: LoadBalancerAclMapRule[];
  client_timeout: number;
  server_timeout: number;
  connection_timeout: number;
  http_keep_alive_timeout: number;
  checkbox_enable?: string;
  cn_id?: number | null;
  cn_status?: LoadBalancerCommittedStatus | null;
  custom_sku?: Record<string, unknown>;
  default_backend?: string;
  enable_bitninja?: boolean;
  enable_eos_logger?: Record<string, unknown>;
  encryption_passphrase?: string;
  eos_log_enable?: boolean;
  host_ids?: number[];
  host_target_ipv6?: string;
  isEncryptionEnabled?: boolean;
  is_ipv6_attached?: boolean;
  is_private?: boolean;
  lb_reserve_ip?: string | null;
  maxconn?: number;
  scaler_id?: string | null;
  scaler_port?: string | null;
  security_group_id?: number | null;
  ssl_certificate_id?: number | null;
  ssl_context?: Record<string, unknown>;
  vpc_list?: LoadBalancerVpcAttachment[];
}

export type LoadBalancerUpdateRequest = LoadBalancerCreateRequest;

export interface LoadBalancerSummary {
  id: number;
  appliance_name: string;
  status: string;
  lb_mode?: string;
  lb_type?: string;
  public_ip?: string | null;
  private_ip?: string | null;
}

export interface LoadBalancerDetails {
  id: number;
  appliance_name: string;
  status: string;
  lb_mode?: string;
  lb_type?: string;
  public_ip?: string | null;
  private_ip?: string | null;
  created_at?: string;
  node_detail?: {
    billing_type?: string;
    plan_name?: string;
    price?: string;
  };
  context?:
    | {
        acl_list?: LoadBalancerAclRule[];
        acl_map?: LoadBalancerAclMapRule[];
        backends?: LoadBalancerBackend[];
        cn_id?: number | null;
        cn_status?: LoadBalancerCommittedStatus | null;
        tcp_backend?: LoadBalancerTcpBackend[];
        custom_sku?: Record<string, unknown>;
        default_backend?: string;
        enable_bitninja?: boolean;
        enable_eos_logger?: Record<string, unknown>;
        encryption_passphrase?: string;
        eos_log_enable?: boolean;
        host_ids?: number[];
        host_target_ipv6?: string;
        http_keep_alive_timeout?: number;
        isEncryptionEnabled?: boolean;
        is_ipv6_attached?: boolean;
        is_private?: boolean;
        lb_reserve_ip?: string | null;
        lb_port?: string;
        maxconn?: number;
        node_list_type?: 'S' | 'D';
        plan_name?: string;
        scaler_id?: string | null;
        scaler_port?: string | null;
        security_group_id?: number | null;
        ssl_certificate_id?: number | null;
        ssl_context?: Record<string, unknown>;
        vpc_list?: LoadBalancerVpcAttachment[];
        [key: string]: unknown;
      }[]
    | undefined;
}

export interface LoadBalancerCreateResult {
  appliance_id: number;
  id: string;
  resource_type: string;
  label_id: string;
}
