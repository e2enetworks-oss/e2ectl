export type SupportedDatabaseType = 'MariaDB' | 'MySQL' | 'PostgreSQL';
export type DbaasCreateBillingType = 'hourly' | 'committed';

export interface DbaasListItem {
  connection_string: string | null;
  connection_endpoint: string | null;
  connection_port: string | null;
  database_name: string | null;
  id: number;
  name: string;
  private_ips: string[];
  public_ip: string | null;
  status: string | null;
  type: SupportedDatabaseType;
  version: string;
}

export interface DbaasVpcConnectionItem {
  appliance_id: number | null;
  ip_address: string | null;
  subnet_id: number | null;
  vpc_id: number | null;
  vpc_name: string | null;
  vpc_cidr: string | null;
}

export interface DbaasWhitelistedIpItem {
  ip: string;
  tags: Array<{
    id: number | null;
    name: string | null;
  }>;
}

export interface DbaasPublicIpInfo {
  attached: boolean;
  enabled: boolean;
  ip_address: string | null;
}

export interface DbaasPlanInfo {
  configuration: {
    cpu: string | null;
    disk: string | null;
    ram: string | null;
  };
  name: string | null;
  price: string | null;
  price_per_hour: string | null;
  price_per_month: string | null;
}

export interface DbaasListTypeItem {
  description: string | null;
  engine: string;
  software_id: number;
  type: SupportedDatabaseType;
  version: string;
}

export interface DbaasCommittedSkuItem {
  committed_days: number | null;
  committed_sku_id: number;
  committed_sku_name: string;
  committed_sku_price: number | null;
  currency: string | null;
  plan_name: string;
  template_id: number;
}

export interface DbaasPlansTemplateItem {
  available: boolean;
  committed_sku: DbaasCommittedSkuItem[];
  currency: string | null;
  disk: string;
  name: string;
  price_per_hour: number | null;
  ram: string;
  template_id: number;
  type: SupportedDatabaseType;
  version: string;
  vcpu: string;
}

export interface DbaasSummaryItem {
  connection_string: string | null;
  database_name: string | null;
  id: number;
  name: string;
  type: SupportedDatabaseType;
  username: string | null;
  version: string;
}

export interface DbaasDetailItem extends DbaasSummaryItem {
  connection_endpoint: string | null;
  connection_port: string | null;
  created_at: string | null;
  plan: DbaasPlanInfo;
  public_ip: DbaasPublicIpInfo;
  status: string | null;
  vpc_connections: DbaasVpcConnectionItem[];
  whitelisted_ips: DbaasWhitelistedIpItem[];
}

export interface DbaasListCommandResult {
  action: 'list';
  filters: {
    type: SupportedDatabaseType | null;
  };
  items: DbaasListItem[];
  total_count: number;
  total_page_number: number;
}

export interface DbaasGetCommandResult {
  action: 'get';
  dbaas: DbaasDetailItem;
}

export interface DbaasListTypesCommandResult {
  action: 'list-types';
  filters: {
    type: SupportedDatabaseType | null;
  };
  items: DbaasListTypeItem[];
  total_count: number;
}

export interface DbaasPlansCommandResult {
  action: 'plans';
  filters: {
    type: SupportedDatabaseType;
    version: string;
  };
  items: DbaasPlansTemplateItem[];
  total_count: number;
}

export interface DbaasCreateCommandResult {
  action: 'create';
  dbaas: DbaasSummaryItem;
  requested: {
    billing_type: DbaasCreateBillingType;
    committed_plan_id?: number;
    database_name: string;
    name: string;
    plan: string;
    public_ip: boolean;
    template_id: number;
    type: SupportedDatabaseType;
    username: string;
    version: string;
    vpc_id?: number;
  };
}

export interface DbaasResetPasswordCommandResult {
  action: 'reset-password';
  dbaas: DbaasSummaryItem;
  message: string;
}

export interface DbaasDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  dbaas: DbaasSummaryItem | null;
  dbaas_id: number;
  message?: string;
}

export interface DbaasVpcAttachCommandResult {
  action: 'vpc-attach';
  dbaas_id: number;
  vpc: {
    id: number;
    name: string;
    subnet_id: number | null;
  };
}

export interface DbaasVpcDetachCommandResult {
  action: 'vpc-detach';
  dbaas_id: number;
  message: string | null;
  vpc: {
    id: number;
    name: string;
    subnet_id: number | null;
  };
}

export interface DbaasPublicIpAttachCommandResult {
  action: 'public-ip-attach';
  dbaas_id: number;
  message: string | null;
}

export interface DbaasPublicIpDetachCommandResult {
  action: 'public-ip-detach';
  cancelled: boolean;
  dbaas_id: number;
  message: string | null;
}

export interface DbaasWhitelistListCommandResult {
  action: 'whitelist-list';
  dbaas_id: number;
  items: DbaasWhitelistedIpItem[];
  total_count: number;
}

export interface DbaasWhitelistUpdateCommandResult {
  action: 'whitelist-add' | 'whitelist-remove';
  dbaas_id: number;
  ip: string;
  message: string | null;
  tag_ids: number[];
}

export type DbaasCommandResult =
  | DbaasCreateCommandResult
  | DbaasDeleteCommandResult
  | DbaasGetCommandResult
  | DbaasListCommandResult
  | DbaasListTypesCommandResult
  | DbaasPlansCommandResult
  | DbaasPublicIpAttachCommandResult
  | DbaasPublicIpDetachCommandResult
  | DbaasResetPasswordCommandResult
  | DbaasVpcAttachCommandResult
  | DbaasVpcDetachCommandResult
  | DbaasWhitelistListCommandResult
  | DbaasWhitelistUpdateCommandResult;
