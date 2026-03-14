export interface VpcSubnetSummary {
  cidr: string;
  id: number;
  subnet_name: string;
  totalIPs?: number;
  usedIPs?: number;
}

export interface VpcSummary {
  created_at?: string;
  gateway_ip?: string;
  ipv4_cidr: string;
  is_e2e_vpc: boolean;
  location?: string;
  name: string;
  network_id: number;
  project_name?: string;
  state: string;
  subnets?: VpcSubnetSummary[];
  vm_count?: number;
}

export interface VpcListResult {
  items: VpcSummary[];
  total_count?: number;
  total_page_number?: number;
}

export interface VpcCommittedPlan {
  committed_days?: number;
  committed_node_message?: string;
  committed_sku_id?: number;
  committed_sku_name?: string;
  committed_sku_price?: number;
  committed_upto_date?: string;
}

export interface VpcPlan {
  committed_sku?: VpcCommittedPlan[];
  currency?: string;
  iops?: Record<string, unknown>;
  location?: string;
  name: string;
  price?: string;
  price_per_hour?: number | null;
  price_per_month?: number | null;
}

export interface VpcCreateRequest {
  cn_id?: number;
  cn_status?: 'auto_renew' | 'hourly_billing';
  ipv4?: string;
  is_e2e_vpc: boolean;
  vpc_name: string;
}

export interface VpcCreateResult {
  is_credit_sufficient: boolean;
  label_id?: string | null;
  network_id: number;
  project_id?: string | null;
  resource_type?: string | null;
  vpc_id: number;
  vpc_name: string;
}

export interface VpcNodeActionRequest {
  action: 'attach' | 'detach';
  input_ip?: string;
  network_id: number;
  node_id: number;
  subnet_id?: number;
}

export interface VpcNodeActionResult {
  message: string;
  project_id?: string | null;
  vpc_id: number;
  vpc_name: string;
}
