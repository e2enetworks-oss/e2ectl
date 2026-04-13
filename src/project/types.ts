export interface ProjectAssociatedPolicySummary {
  id: number | null;
  policy_name: string;
  policy_set_type: string | null;
}

export interface ProjectAssociatedMemberPolicySummary {
  policy_id: number;
  policy_name: string;
}

export interface ProjectAssociatedMemberSummary {
  email: string;
  iam_type: string;
  policies: ProjectAssociatedMemberPolicySummary[];
  role: string;
}

export interface ProjectSummary {
  associated_members: ProjectAssociatedMemberSummary[];
  associated_policies: ProjectAssociatedPolicySummary[];
  current_user_role: string;
  is_active_project: boolean;
  is_default: boolean;
  is_starred: boolean;
  name: string;
  project_id: number;
}
