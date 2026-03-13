export interface SshKeySummary {
  label: string;
  pk: number;
  project_name?: string;
  ssh_key: string;
  ssh_key_type?: string;
  timestamp: string;
  total_attached_nodes?: number;
}

export interface SshKeyCreateResult {
  label: string;
  pk: number;
  project_id?: string | null;
  ssh_key: string;
  timestamp: string;
}
