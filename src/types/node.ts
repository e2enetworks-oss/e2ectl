import type { ApiEnvelope } from './api.js';

export interface NodeSummary {
  id: number;
  name: string;
  status: string;
  public_ip_address?: string | null;
  private_ip_address?: string | null;
  plan: string;
  is_locked?: boolean;
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

export interface NodeListEnvelope extends ApiEnvelope<NodeSummary[]> {
  total_count?: number;
  total_page_number?: number;
}
