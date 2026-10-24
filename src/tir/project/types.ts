export interface TirProjectApiItem {
  created_at?: string;
  project_id: number;
  project_name: string;
}

export interface TirProjectItem {
  created_at: string;
  id: number;
  name: string;
}

export interface TirProjectContextOptions {
  accountId?: string;
  alias?: string;
}

export interface TirConfigureOptions {
  accountId: string;
  alias?: string;
  location: string;
  projectId: string;
}

export interface TirProjectListCommandResult {
  account_id: number;
  action: 'list';
  items: TirProjectItem[];
}

export interface TirConfigureCommandResult {
  account: { email: string; id: number; name: string };
  action: 'configure';
  alias: string;
  location: string;
  project: { id: number; name: string };
}

export type TirProjectCommandResult =
  TirConfigureCommandResult | TirProjectListCommandResult;
