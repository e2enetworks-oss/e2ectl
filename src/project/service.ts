import {
  resolveStoredAccountCredentials,
  type ConfigFile,
  type ResolvedAccountCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { ProjectClient } from './client.js';
import type { ProjectSummary } from './types.js';

export interface ProjectContextOptions {
  alias?: string;
}

export interface ProjectItem {
  is_cli_default_project: boolean;
  is_default: boolean;
  is_starred: boolean;
  name: string;
  project_id: number;
}

export interface ProjectCreateOptions {
  alias?: string;
  name: string;
}

export interface ProjectStarOptions {
  alias?: string;
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

export interface ProjectStarCommandResult {
  action: 'star';
  name: string;
  project_id: number;
}

export interface ProjectUnstarCommandResult {
  action: 'unstar';
  name: string;
  project_id: number;
}

export type ProjectCommandResult =
  | ProjectCreateCommandResult
  | ProjectListCommandResult
  | ProjectStarCommandResult
  | ProjectUnstarCommandResult;

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

  async createProject(
    options: ProjectCreateOptions
  ): Promise<ProjectCreateCommandResult> {
    const name = normalizeRequiredString(options.name, 'Name', '--name');
    const credentials = await resolveStoredAccountCredentials(
      this.dependencies.store,
      options
    );
    const client = this.dependencies.createProjectClient(credentials);
    const created = await client.createProject({ name });

    return {
      action: 'create',
      name: created.project_name,
      project_id: created.project_id
    };
  }

  async starProject(
    projectId: string,
    options: ProjectStarOptions
  ): Promise<ProjectStarCommandResult> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const credentials = await resolveStoredAccountCredentials(
      this.dependencies.store,
      options
    );
    const client = this.dependencies.createProjectClient(credentials);
    const project = await findProjectById(client, normalizedProjectId);
    const result = await client.starUnstarProject({
      is_starred: true,
      name: project.name,
      project_id: normalizedProjectId
    });

    return {
      action: 'star',
      name: result.project_name,
      project_id: result.project_id
    };
  }

  async unstarProject(
    projectId: string,
    options: ProjectStarOptions
  ): Promise<ProjectUnstarCommandResult> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const credentials = await resolveStoredAccountCredentials(
      this.dependencies.store,
      options
    );
    const client = this.dependencies.createProjectClient(credentials);
    const project = await findProjectById(client, normalizedProjectId);
    const result = await client.starUnstarProject({
      is_starred: false,
      name: project.name,
      project_id: normalizedProjectId
    });

    return {
      action: 'unstar',
      name: result.project_name,
      project_id: result.project_id
    };
  }

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

function normalizeProjectId(projectId: string): number {
  const normalized = projectId.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new CliError('Project ID must be numeric.', {
      code: 'INVALID_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric project id as the first argument.'
    });
  }

  return Number(normalized);
}

async function findProjectById(
  client: ProjectClient,
  projectId: number
): Promise<ProjectSummary> {
  const projects = await client.listProjects();
  const match = projects.find((item) => item.project_id === projectId);

  if (match === undefined) {
    throw new CliError(`Project ${projectId} was not found.`, {
      code: 'PROJECT_NOT_FOUND',
      exitCode: EXIT_CODES.network,
      suggestion:
        'Run `e2ectl project list` to inspect available projects, then retry with an exact project id.'
    });
  }

  return match;
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

function summarizeProject(
  item: ProjectSummary,
  cliDefaultProjectId: string | undefined
): ProjectItem {
  return {
    is_cli_default_project:
      cliDefaultProjectId !== undefined &&
      String(item.project_id) === cliDefaultProjectId,
    is_default: item.is_default,
    is_starred: item.is_starred,
    name: item.name,
    project_id: item.project_id
  };
}
