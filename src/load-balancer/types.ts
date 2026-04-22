export type LoadBalancerMode = 'HTTP' | 'HTTPS' | 'BOTH' | 'TCP';
export type LoadBalancerType = 'external' | 'internal';
export type LoadBalancerAlgorithm = 'source' | 'roundrobin' | 'leastconn';

export interface LoadBalancerServer {
  backend_name: string;
  backend_ip: string;
  backend_port: number;
}

export interface LoadBalancerBackend {
  name: string;
  domain_name: string;
  backend_mode: 'http' | 'https';
  balance: LoadBalancerAlgorithm;
  backend_ssl: boolean;
  http_check: boolean;
  check_url: string;
  servers: LoadBalancerServer[];
  websocket_timeout?: number;
}

export interface LoadBalancerTcpBackend {
  backend_name: string;
  port: number;
  balance: LoadBalancerAlgorithm;
  servers: LoadBalancerServer[];
}

export interface LoadBalancerCreateRequest {
  lb_name: string;
  lb_type: LoadBalancerType;
  lb_mode: LoadBalancerMode;
  lb_port: string;
  plan_name: string;
  node_list_type: 'S';
  backends: LoadBalancerBackend[];
  tcp_backend: LoadBalancerTcpBackend[];
  acl_list: [];
  acl_map: [];
  client_timeout: number;
  server_timeout: number;
  connection_timeout: number;
  http_keep_alive_timeout: number;
}

export type LoadBalancerUpdateRequest = LoadBalancerCreateRequest;

export interface LoadBalancerSummary {
  id: number;
  appliance_name: string;
  status: string;
  lb_mode?: string;
  lb_type?: string;
  public_ip?: string | null;
}

export interface LoadBalancerDetails {
  id: number;
  appliance_name: string;
  status: string;
  lb_mode?: string;
  lb_type?: string;
  public_ip?: string | null;
  context?: {
    backends?: LoadBalancerBackend[];
    tcp_backend?: LoadBalancerTcpBackend[];
    [key: string]: unknown;
  }[];
}

export interface LoadBalancerCreateResult {
  appliance_id: number;
  id: string;
  resource_type: string;
  label_id: string;
}
