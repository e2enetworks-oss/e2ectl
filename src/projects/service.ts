import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { ProjectClient } from './client.js';

export interface ProjectContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export type ProjectListOptions = ProjectContextOptions;

export interface ProjectCreateOptions extends ProjectContextOptions {
  name: string;
}

export interface ProjectItem {
  is_default: boolean;
  is_starred: boolean;
  name: string;
  project_id: number;
}

export interface ProjectListCommandResult {
  action: 'list';
  items: ProjectItem[];
}

export interface ProjectCreateCommandResult {
  action: 'create';
  name: string;
  project_id: number;
}

export type ProjectCommandResult =
  | ProjectCreateCommandResult
  | ProjectListCommandResult;

interface ProjectStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface ProjectServiceDependencies {
  createProjectClient(credentials: ResolvedCredentials): ProjectClient;
  store: ProjectStore;
}

export class ProjectService {
  constructor(private readonly dependencies: ProjectServiceDependencies) {}

  async listProjects(
    options: ProjectListOptions
  ): Promise<ProjectListCommandResult> {
    const client = await this.createClient(options);
    const perPage = 100;
    const collected: ProjectItem[] = [];
    let page = 1;

    while (true) {
      const response = await client.listProjects({
        page_no: page,
        per_page: perPage,
        search_string: ''
      });

      for (const item of response.items) {
        collected.push({
          is_default: item.is_default ?? false,
          is_starred: item.is_starred ?? false,
          name: item.name,
          project_id: item.project_id
        });
      }

      const totalPages = response.total_page_number ?? page;
      if (page >= totalPages || response.items.length === 0) {
        break;
      }

      page += 1;
    }

    return {
      action: 'list',
      items: collected
    };
  }

  async createProject(
    options: ProjectCreateOptions
  ): Promise<ProjectCreateCommandResult> {
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const client = await this.createClient(options);
    const created = await client.createProject({ name });

    return {
      action: 'create',
      name: created.project_name,
      project_id: created.project_id
    };
  }

  private async createClient(
    options: ProjectContextOptions
  ): Promise<ProjectClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

    return this.dependencies.createProjectClient(credentials);
  }
}

function normalizeRequiredString(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = value.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}
