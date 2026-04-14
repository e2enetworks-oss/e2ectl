export interface ReservedIpFloatingAttachmentNode {
  id?: number;
  ip_address_private?: string | null;
  ip_address_public?: string | null;
  name?: string;
  security_group_status?: string | null;
  status_name?: string;
  vm_id?: number;
}

export interface ReservedIpSummary {
  appliance_type?: string | null;
  bought_at?: string;
  floating_ip_attached_nodes?: ReservedIpFloatingAttachmentNode[];
  ip_address: string;
  project_name?: string | null;
  reserve_id?: number;
  reserved_type?: string | null;
  status?: string;
  vm_id?: number | null;
  vm_name?: string | null;
}

export interface ReservedIpNodeActionRequest {
  type: 'attach' | 'detach';
  vm_id: number;
}

export interface ReservedIpPublicIpDetachRequest {
  public_ip: string;
  type: 'detach';
  vm_id: number;
}

export interface ReservedIpReserveNodeRequest {
  type: 'live-reserve';
  vm_id: number;
}

export interface ReservedIpNodeActionResult {
  ip_address: string;
  message: string;
  status: string | null;
  vm_id: number | null;
  vm_name: string | null;
}

export interface ReservedIpDeleteResult {
  message: string;
}
