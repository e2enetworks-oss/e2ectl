import {
  VALID_LOCATIONS,
  formatConfigCommand,
  resolveStoredTirCredentials,
  type ConfigFile,
  type ProfileConfig,
  type ResolvedTirCredentials
} from '../../config/index.js';
import { CliError, EXIT_CODES } from '../../core/errors.js';
import type { TirAccountClient, TirAccountItem } from '../account/index.js';
import { toTirAccountItem } from '../account/index.js';
import { formatTirCommand } from '../api.js';
import type { TirProjectClient } from './client.js';
import type {
  TirConfigureCommandResult,
  TirConfigureOptions,
  TirProjectApiItem,
  TirProjectContextOptions,
  TirProjectItem,
  TirProjectListCommandResult
} from './types.js';

interface TirProjectStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
  updateProfile(
    alias: string,
    patch: Partial<ProfileConfig>
  ): Promise<ConfigFile>;
}

export interface TirProjectServiceDependencies {
  createTirAccountClient(credentials: ResolvedTirCredentials): TirAccountClient;
  createTirProjectClient(credentials: ResolvedTirCredentials): TirProjectClient;
  store: TirProjectStore;
}

export class TirProjectService {
  constructor(private readonly dependencies: TirProjectServiceDependencies) {}

  async list(
    options: TirProjectContextOptions
  ): Promise<TirProjectListCommandResult> {
    const credentials = await resolveStoredTirCredentials(
      this.dependencies.store,
      options,
      'account'
    );
    const accountId = credentials.account_id ?? '';
    const client = this.dependencies.createTirProjectClient(credentials);

    return {
      account_id: Number(accountId),
      action: 'list',
      items: (await client.listProjects(accountId)).map(toTirProjectItem)
    };
  }

  // Checks the account, project and location against TIR before saving
  // them, so a typo is caught here and not on every later command.
  async configure(
    options: TirConfigureOptions
  ): Promise<TirConfigureCommandResult> {
    const accountId = normalizeNumericId(
      options.accountId,
      'account',
      '--account-id'
    );
    const projectId = normalizeNumericId(
      options.projectId,
      'project',
      '--project-id'
    );
    const location = normalizeLocation(options.location);
    const alias = await this.findProfileToSave(options.alias);
    const credentials = await resolveStoredTirCredentials(
      this.dependencies.store,
      { alias },
      'auth'
    );

    const account = await this.findAccount(credentials, accountId);
    const project = await this.findProject(credentials, accountId, projectId);

    await this.dependencies.store.updateProfile(alias, {
      tir: {
        account_id: String(account.id),
        location,
        project_id: String(project.id)
      }
    });

    return {
      account: { email: account.email, id: account.id, name: account.name },
      action: 'configure',
      alias,
      location,
      project: { id: project.id, name: project.name }
    };
  }

  private async findProfileToSave(alias: string | undefined): Promise<string> {
    const config = await this.dependencies.store.read();
    const chosen = alias ?? config.default;

    if (chosen !== undefined && config.profiles[chosen] !== undefined) {
      return chosen;
    }

    throw new CliError(
      chosen === undefined
        ? 'There is no saved profile to keep the TIR context in.'
        : `Profile "${chosen}" was not found.`,
      {
        code: 'PROFILE_NOT_FOUND',
        exitCode: EXIT_CODES.config,
        suggestion: `Run \`${formatConfigCommand('import --file <path>')}\` to save a profile first, or set E2E_TIR_ACCOUNT_ID, E2E_TIR_PROJECT_ID and E2E_TIR_LOCATION instead.`
      }
    );
  }

  private async findAccount(
    credentials: ResolvedTirCredentials,
    accountId: number
  ): Promise<TirAccountItem> {
    const accounts = await this.dependencies
      .createTirAccountClient(credentials)
      .listAccounts();
    const found = accounts.find((account) => account.id === accountId);

    if (found === undefined) {
      throw new CliError(
        `TIR account ${accountId} is not one your key can use.`,
        {
          code: 'TIR_ACCOUNT_NOT_FOUND',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run \`${formatTirCommand('account list')}\` and pass one of the listed ids with --account-id.`
        }
      );
    }

    const account = toTirAccountItem(found);
    if (!account.tir_access) {
      throw new CliError(`TIR is not turned on for account ${accountId}.`, {
        code: 'TIR_ACCESS_DISABLED',
        exitCode: EXIT_CODES.usage,
        suggestion: `Pick an account with TIR access from \`${formatTirCommand('account list')}\`, or ask the account owner to turn TIR on.`
      });
    }

    return account;
  }

  private async findProject(
    credentials: ResolvedTirCredentials,
    accountId: number,
    projectId: number
  ): Promise<TirProjectItem> {
    const projects = await this.dependencies
      .createTirProjectClient(credentials)
      .listProjects(String(accountId));
    const found = projects.find((project) => project.project_id === projectId);

    if (found === undefined) {
      throw new CliError(
        `Project ${projectId} is not in TIR account ${accountId}.`,
        {
          code: 'TIR_PROJECT_NOT_FOUND',
          exitCode: EXIT_CODES.usage,
          suggestion: `Run \`${formatTirCommand(`project list --account-id ${accountId}`)}\` and pass one of the listed ids with --project-id.`
        }
      );
    }

    return toTirProjectItem(found);
  }
}

function toTirProjectItem(project: TirProjectApiItem): TirProjectItem {
  return {
    created_at: project.created_at ?? '',
    id: project.project_id,
    name: project.project_name
  };
}

function normalizeNumericId(
  value: string,
  label: 'account' | 'project',
  flag: string
): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  throw new CliError(`TIR ${label} ID must be numeric.`, {
    code: `INVALID_TIR_${label.toUpperCase()}_ID`,
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass the numeric id from \`${formatTirCommand(`${label} list`)}\` with ${flag}.`
  });
}

function normalizeLocation(value: string): string {
  const location = value.trim();
  if (VALID_LOCATIONS.includes(location as (typeof VALID_LOCATIONS)[number])) {
    return location;
  }

  throw new CliError(`Unsupported TIR location "${value}".`, {
    code: 'INVALID_LOCATION',
    details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass --location Delhi or --location Chennai.'
  });
}
