export interface SmokeManifest {
  addon_reserved_ip: string | null;
  addon_reserved_ip_attached_node_id: number | null;
  addon_reserved_ip_deleted: boolean;
  created_at: string;
  node_deleted: boolean;
  node_id: number | null;
  prefix: string;
  preserved_reserved_ip: string | null;
  preserved_reserved_ip_deleted: boolean;
  saved_image_deleted: boolean;
  saved_image_id: string | null;
  security_group_attached_node_id: number | null;
  security_group_deleted: boolean;
  security_group_id: number | null;
  ssh_key_attached_node_id: number | null;
  ssh_key_deleted: boolean;
  ssh_key_id: number | null;
  temp_rules_file_path: string | null;
  updated_at: string;
  version: 1;
  volume_attached_node_id: number | null;
  volume_deleted: boolean;
  volume_id: number | null;
  vpc_attached_node_id: number | null;
  vpc_deleted: boolean;
  vpc_id: number | null;
}

export interface CreateSmokeManifestOptions {
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
