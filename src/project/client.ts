import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  ProjectCreateResult,
  ProjectStarUnstarRequest,
  ProjectStarUnstarResult,
  ProjectSummary
} from './types.js';

const PROJECTS_PATH = '/pbac/project/';

export interface ProjectClient {
  createProject(input: { name: string }): Promise<ProjectCreateResult>;
  listProjects(): Promise<ProjectSummary[]>;
  starUnstarProject(
    body: ProjectStarUnstarRequest
  ): Promise<ProjectStarUnstarResult>;
}

export class ProjectApiClient implements ProjectClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createProject(input: { name: string }): Promise<ProjectCreateResult> {
    const response = await this.transport.post<
      ApiEnvelope<ProjectCreateResult>
    >(PROJECTS_PATH, {
      body: input,
      includeProjectContext: false
    });

    return response.data;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const response = await this.transport.get<ApiEnvelope<ProjectSummary[]>>(
      PROJECTS_PATH,
      {
        includeProjectContext: false
      }
    );

    return response.data;
  }

  async starUnstarProject(
    body: ProjectStarUnstarRequest
  ): Promise<ProjectStarUnstarResult> {
    const response = await this.transport.request<
      ApiEnvelope<ProjectStarUnstarResult>
    >({
      body,
      includeProjectContext: false,
      method: 'PUT',
      path: PROJECTS_PATH
    });

    return response.data;
  }
}
