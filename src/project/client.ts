import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type { ProjectSummary } from './types.js';

const PROJECTS_PATH = '/pbac/project/';

export interface ProjectClient {
  listProjects(): Promise<ProjectSummary[]>;
}

export class ProjectApiClient implements ProjectClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async listProjects(): Promise<ProjectSummary[]> {
    const response = await this.transport.get<ApiEnvelope<ProjectSummary[]>>(
      PROJECTS_PATH,
      {
        includeProjectContext: false
      }
    );

    return response.data;
  }
}
