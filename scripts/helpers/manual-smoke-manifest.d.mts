export interface SmokeManifestDnsRecord {
  current_value: string;
  deleted: boolean;
  domain_name: string;
  name: string;
  type: string;
}

export interface SmokeManifest {
  addon_reserved_ip: string | null;
  addon_reserved_ip_attached_node_id: number | null;
  addon_reserved_ip_deleted: boolean;
  created_at: string;
  dns_domain: string;
  dns_records: SmokeManifestDnsRecord[];
  node_deleted: boolean;
  node_id: number | null;
  prefix: string;
  preserved_reserved_ip: string | null;
  preserved_reserved_ip_deleted: boolean;
  security_group_attached_node_id: number | null;
  security_group_deleted: boolean;
  security_group_id: number | null;
  ssh_key_deleted: boolean;
  ssh_key_id: number | null;
  temp_rules_file_path: string | null;
  updated_at: string;
  version: 1;
  volume_deleted: boolean;
  volume_id: number | null;
  vpc_deleted: boolean;
  vpc_id: number | null;
}

export interface CreateSmokeManifestOptions {
  dnsDomain: string;
  manifestPath?: string;
  prefix: string;
  tempRulesFilePath?: string;
}

export function createSmokeManifest(
  options: CreateSmokeManifestOptions
): Promise<{
  manifest: SmokeManifest;
  path: string;
}>;

export function loadSmokeManifest(manifestPath: string): Promise<SmokeManifest>;

export function updateSmokeManifest(
  manifestPath: string,
  mutate: (manifest: SmokeManifest) => void
): Promise<SmokeManifest>;
