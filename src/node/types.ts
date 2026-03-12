export interface NodeSummary {
  id: number;
  is_locked?: boolean;
  name: string;
  plan: string;
  private_ip_address?: string | null;
  public_ip_address?: string | null;
  status: string;
}

export interface NodeOsInfo {
  category?: string;
  full_name?: string;
  name?: string;
  version?: string;
}

export interface NodeDetails extends NodeSummary {
  created_at?: string;
  disk?: string;
  label?: string;
  location?: string;
  memory?: string;
  os_info?: NodeOsInfo;
  price?: string;
  vm_id?: number;
  vcpus?: string;
}

export interface NodeListResult {
  nodes: NodeSummary[];
  total_count?: number;
  total_page_number?: number;
}

export interface NodeCatalogOsVersion {
  number_of_domains?: string | null;
  os: string;
  software_version?: string;
  sub_category: string;
  version: string;
}

export interface NodeCatalogOsGroup {
  OS: string;
  category: string[];
  version: NodeCatalogOsVersion[];
}

export interface NodeCatalogOsData {
  category_list: NodeCatalogOsGroup[];
}

export interface NodeCatalogOsEntry {
  category: string;
  display_category: string;
  number_of_domains: string | null;
  os: string;
  os_version: string;
  software_version: string;
}

export type NodeCatalogQuery = Record<
  'category' | 'display_category' | 'os' | 'osversion',
  string
>;

export interface NodeCatalogPlanOsInfo {
  category?: string;
  image?: string;
  name?: string;
  version?: string;
}

export interface NodeCatalogCommittedSku {
  committed_days?: number;
  committed_node_message?: string;
  committed_sku_id?: number;
  committed_sku_name?: string;
  committed_sku_price?: number;
  committed_upto_date?: string;
}

export interface NodeCatalogPlanSpecs {
  committed_sku?: NodeCatalogCommittedSku[];
  cpu?: number;
  disk_space?: number;
  family?: string;
  id?: string;
  minimum_billing_amount?: number;
  price_per_hour?: number;
  price_per_month?: number;
  ram?: string;
  series?: string;
  sku_name?: string;
}

export interface NodeCatalogPlan {
  available_inventory_status?: boolean;
  bitninja_discount_percentage?: number;
  cpu_type?: string;
  currency?: string;
  image: string;
  is_blockstorage_attachable?: boolean;
  location?: string;
  name: string;
  node_description?: string;
  os?: NodeCatalogPlanOsInfo;
  plan: string;
  specs?: NodeCatalogPlanSpecs;
}

export interface NodeCreateRequest {
  backups: boolean;
  default_public_ip: boolean;
  disable_password: boolean;
  enable_bitninja: boolean;
  image: string;
  is_ipv6_availed: boolean;
  is_saved_image: boolean;
  label: string;
  name: string;
  number_of_instances: number;
  plan: string;
  ssh_keys: string[];
  start_scripts: string[];
}

export interface NodeCreateResult {
  node_create_response: NodeDetails[];
  total_number_of_node_created: number;
  total_number_of_node_requested: number;
}

export interface NodeDeleteResult {
  message: string;
}
