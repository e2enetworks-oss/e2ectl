import {
  resolveStoredAccountCredentials,
  type ConfigFile,
  type ResolvedAccountCredentials
} from '../config/index.js';
import type { ProjectClient } from './client.js';
import type { ProjectSummary } from './types.js';

export interface ProjectContextOptions {
  alias?: string;
}

export interface ProjectItem {
  associated_member_count: number;
  associated_policy_count: number;
  current_user_role: string;
  is_backend_active_project: boolean;
  is_cli_default_project: boolean;
  is_default: boolean;
  is_starred: boolean;
  name: string;
  project_id: number;
}

export interface ProjectListCommandResult {
  action: 'list';
  items: ProjectItem[];
}

export type ProjectCommandResult = ProjectListCommandResult;

interface ProjectStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface ProjectServiceDependencies {
  createProjectClient(credentials: ResolvedAccountCredentials): ProjectClient;
  store: ProjectStore;
}

export class ProjectService {
  constructor(private readonly dependencies: ProjectServiceDependencies) {}

  async listProjects(
    options: ProjectContextOptions
  ): Promise<ProjectListCommandResult> {
    const credentials = await resolveStoredAccountCredentials(
      this.dependencies.store,
      options
    );
    const client = this.dependencies.createProjectClient(credentials);
    const cliDefaultProjectId = credentials.project_id;

    return {
      action: 'list',
      items: (await client.listProjects()).map((item) =>
        summarizeProject(item, cliDefaultProjectId)
      )
    };
  }
}

function summarizeProject(
  item: ProjectSummary,
  cliDefaultProjectId: string | undefined
): ProjectItem {
  return {
    associated_member_count: item.associated_members.length,
    associated_policy_count: item.associated_policies.length,
    current_user_role: item.current_user_role,
    is_backend_active_project: item.is_active_project,
    is_cli_default_project:
      cliDefaultProjectId !== undefined &&
      String(item.project_id) === cliDefaultProjectId,
    is_default: item.is_default,
    is_starred: item.is_starred,
    name: item.name,
    project_id: item.project_id
  };
}
