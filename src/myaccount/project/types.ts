export interface ProjectSummary {
  is_default: boolean;
  is_starred: boolean;
  name: string;
  project_id: number;
}

export interface ProjectCreateResult {
  project_id: number;
  project_name: string;
}

export interface ProjectStarUnstarRequest {
  is_starred: boolean;
  name: string;
  project_id: number;
}

export interface ProjectStarUnstarResult {
  project_id: number;
  project_name: string;
}
