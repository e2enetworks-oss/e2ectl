export const IMAGE_OS_CHOICES = [
  'CENTOS',
  'UBUNTU',
  'WINDOWS_BIOS',
  'WINDOWS_UEFI'
] as const;

export type ImageOsChoice = (typeof IMAGE_OS_CHOICES)[number];

export const IMAGE_ACTION_RENAME = 'rename' as const;

export interface ImageSummary {
  creation_time: string;
  image_id: string;
  image_name: string;
  image_size: string;
  image_state: string;
  is_windows?: boolean;
  node_plans_available?: boolean;
  os_distribution: string;
  project_name?: string;
  running_vms: number;
  scaler_group_count?: number;
}

export interface ImageImportRequest {
  image_name: string;
  location: string;
  os?: ImageOsChoice;
  public_url: string;
}

export interface ImageActionRequest {
  action_type: typeof IMAGE_ACTION_RENAME;
  location?: string;
  name: string;
}

export interface ImageActionResult {
  message: string;
  status: boolean;
}
