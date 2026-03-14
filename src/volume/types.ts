export interface VolumeApiAttachment {
  all_action_disabled?: boolean;
  node_id?: number;
  vm_id?: number;
  vm_name?: string;
}

export interface VolumeApiDrData {
  is_dr_source?: boolean;
  is_dr_stopped?: boolean;
  is_dr_target?: boolean;
  is_in_drill_mode?: boolean;
}

export interface VolumeSummary {
  block_id: number;
  dr_data?: VolumeApiDrData;
  name: string;
  size: number;
  size_string?: string;
  status: string;
  vm_detail?: VolumeApiAttachment;
}

export interface VolumeListResult {
  items: VolumeSummary[];
  total_count?: number;
  total_page_number?: number;
}

export interface VolumeCommittedPlan {
  committed_days?: number;
  committed_node_message?: string;
  committed_sku_id?: number;
  committed_sku_name?: string;
  committed_sku_price?: number;
  committed_upto_date?: string;
}

export interface VolumePlan {
  available_inventory_status: boolean;
  bs_size: number;
  committed_sku?: VolumeCommittedPlan[];
  currency?: string;
  iops: number;
  is_active?: boolean;
  location?: string;
  name: string;
  price?: number | string | null;
}

export interface VolumeCreateRequest {
  cn_id?: number;
  cn_status?: 'auto_renew' | 'hourly_billing';
  iops: number;
  name: string;
  size: number;
}

export interface VolumeCreateResult {
  id: number;
  image_name: string;
  label_id?: number | null;
  resource_type?: string | null;
}

export interface VolumeNodeActionRequest {
  vm_id: number;
}

export interface VolumeNodeActionResult {
  image_id: number;
  message: string;
  vm_id: number;
}
