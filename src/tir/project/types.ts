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

export interface TirProjectListCommandResult {
  account_id: number;
  action: 'list';
  items: TirProjectItem[];
}

export type TirProjectCommandResult = TirProjectListCommandResult;
