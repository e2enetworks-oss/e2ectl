import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  ProjectCreateResult,
  ProjectListResponse,
  ProjectSummary
} from './types.js';

export interface ProjectListQuery {
  page_no?: number;
  per_page?: number;
  search_string?: string;
}

export interface ProjectClient {
  createProject(input: { name: string }): Promise<ProjectCreateResult>;
  listProjects(query?: ProjectListQuery): Promise<ProjectListResponse>;
}

interface ProjectListEnvelope extends ApiEnvelope<ProjectSummary[]> {
  total_count?: number;
  total_page_number?: number;
}

export class ProjectApiClient implements ProjectClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createProject(input: {
    name: string;
  }): Promise<ProjectCreateResult> {
    const response = await this.transport.post<
      ApiEnvelope<ProjectCreateResult>
    >('/pbac/project/', { body: input });

    return response.data;
  }

  async listProjects(
    query: ProjectListQuery = {}
  ): Promise<ProjectListResponse> {
    const response = await this.transport.get<ProjectListEnvelope>(
      '/pbac/project/',
      {
        query: {
          page_no:
            query.page_no === undefined ? undefined : String(query.page_no),
          per_page:
            query.per_page === undefined ? undefined : String(query.per_page),
          search_string: query.search_string ?? ''
        }
      }
    );

    return {
      items: response.data,
      ...(response.total_count === undefined
        ? {}
        : { total_count: response.total_count }),
      ...(response.total_page_number === undefined
        ? {}
        : { total_page_number: response.total_page_number })
    };
  }
}
