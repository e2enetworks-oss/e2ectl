export interface DbaasSoftwareSummary {
  description?: string | null;
  engine: string;
  eol_date?: string | null;
  id: number;
  name: string;
  version: string;
}

export interface DbaasCommittedSku {
  committed_days?: number;
  committed_node_message?: string;
  committed_sku_id?: number;
  committed_sku_name?: string;
  committed_sku_price?: number;
  committed_upto_date?: string;
}

export interface DbaasTemplatePlan {
  available_inventory_status: boolean;
  committed_sku?: DbaasCommittedSku[];
  cpu: string;
  currency?: string | null;
  disk: string;
  iops?: number | Record<string, never>;
  name: string;
  price?: number | string | null;
  price_per_hour?: number | null;
  price_per_month?: number | null;
  ram: string;
  software: DbaasSoftwareSummary;
  template_id: number;
}

export interface DbaasPlanCatalog {
  database_engines: DbaasSoftwareSummary[];
  is_private_cluster_user?: boolean;
  storage_price?: number | null;
  template_plans: DbaasTemplatePlan[];
}

export interface DbaasDatabaseDetails {
  database: string;
  id: number;
  pg_detail?: Record<string, unknown> | null;
  username: string;
}

export interface DbaasMasterNodeSummary {
  cluster_id?: number;
  database: DbaasDatabaseDetails;
  domain?: string | null;
  port?: number | string | null;
  private_ip_address?: string | null;
  public_ip_address?: string | null;
  public_port?: number | string | null;
}

export interface DbaasClusterSummary {
  created_at?: string;
  id: number;
  master_node: DbaasMasterNodeSummary;
  name: string;
  software: DbaasSoftwareSummary;
  status?: string;
  status_title?: string;
}

export type DbaasClusterDetail = DbaasClusterSummary;

export interface DbaasListResult {
  items: DbaasClusterSummary[];
  total_count?: number;
  total_page_number?: number;
}

export type DbaasCommittedRenewal = 'auto_renew' | 'hourly_billing';

export interface DbaasVpcEntry {
  ipv4_cidr: string;
  network_id: number;
  subnet_id?: number;
  target: 'vpcs';
  vpc_name: string;
}

export interface DbaasCreateRequest {
  cn_id?: number;
  cn_status?: DbaasCommittedRenewal;
  database: {
    dbaas_number: number;
    name: string;
    password: string;
    user: string;
  };
  name: string;
  public_ip_required: boolean;
  software_id: number;
  template_id: number;
  vpcs?: DbaasVpcEntry[];
}

export interface DbaasCreateResult {
  cluster_id?: number;
  id?: number;
  name?: string;
}

export interface DbaasDeleteResult {
  cluster_id?: number;
  name?: string;
}

export interface DbaasResetPasswordRequest {
  password: string;
  username: string;
}

export interface DbaasResetPasswordResult {
  cluster_id?: number;
  message: string;
  name?: string;
}

export interface DbaasVpcAttachRequest {
  vpcs: DbaasVpcEntry[];
}

export interface DbaasVpcAttachResult {
  message?: string;
}
