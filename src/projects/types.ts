export interface ProjectSummary {
  is_default?: boolean;
  is_starred?: boolean;
  name: string;
  project_id: number;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
  total_count?: number;
  total_page_number?: number;
}

export interface ProjectCreateResult {
  project_id: number;
  project_name: string;
}
