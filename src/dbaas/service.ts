import { formatCliCommand } from '../app/metadata.js';
import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { DbaasClient } from './client.js';
import type {
  DbaasClusterDetail,
  DbaasClusterSummary,
  DbaasCreateRequest,
  DbaasCreateResult,
  DbaasPlanCatalog,
  DbaasSoftwareSummary,
  DbaasTemplatePlan
} from './types.js';

const DBAAS_LIST_PAGE_SIZE = 100;
const DBAAS_LIST_MAX_PAGES = 500;
const DBAAS_NAME_REGEX = /^[a-zA-Z0-9-_]{1,128}$/;
const DBAAS_USERNAME_REGEX = /^[a-z0-9]+$/;
const DBAAS_PASSWORD_REGEX =
  /^(?=\D*\d)(?=[^a-z]*[a-z])(?=[^A-Z]*[A-Z])(?=.*[#?!@$%^&|,.:<>{}()]).{16,30}$/;
type SupportedDatabaseType = 'MariaDB' | 'MySQL' | 'PostgreSQL';

const SUPPORTED_DATABASE_TYPES: ReadonlyArray<{
  aliases: readonly string[];
  canonical: SupportedDatabaseType;
}> = [
  { aliases: ['maria', 'mariadb'], canonical: 'MariaDB' },
  { aliases: ['mysql', 'sql'], canonical: 'MySQL' },
  { aliases: ['postgres', 'postgresql'], canonical: 'PostgreSQL' }
];

export interface DbaasContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface DbaasPlansOptions extends DbaasContextOptions {
  dbVersion?: string;
  type?: string;
}

export interface DbaasListOptions extends DbaasContextOptions {
  type?: string;
}

export interface DbaasCreateOptions extends DbaasContextOptions {
  databaseName: string;
  dbVersion: string;
  name: string;
  password: string;
  plan: string;
  publicIp?: boolean;
  type: string;
  username?: string;
}

export interface DbaasResetPasswordOptions extends DbaasContextOptions {
  password: string;
}

export interface DbaasDeleteOptions extends DbaasContextOptions {
  force?: boolean;
}

export interface DbaasListItem {
  connection_string: string | null;
  database_name: string | null;
  id: number;
  name: string;
  status: string | null;
  type: SupportedDatabaseType;
  version: string;
}

export interface DbaasPlansEngineItem {
  description: string | null;
  engine: string;
  software_id: number;
  type: SupportedDatabaseType;
  version: string;
}

export interface DbaasPlansTemplateItem {
  available: boolean;
  currency: string | null;
  disk: string;
  name: string;
  price_per_hour: number | null;
  ram: string;
  template_id: number;
  type: SupportedDatabaseType;
  version: string;
  vcpu: string;
}

export interface DbaasSummaryItem {
  connection_string: string | null;
  database_name: string | null;
  id: number;
  name: string;
  type: SupportedDatabaseType;
  username: string | null;
  version: string;
}

export interface DbaasListCommandResult {
  action: 'list';
  filters: {
    type: SupportedDatabaseType | null;
  };
  items: DbaasListItem[];
  total_count: number;
  total_page_number: number;
}

export interface DbaasPlansEngineCommandResult {
  action: 'plans';
  filters: {
    type: SupportedDatabaseType | null;
    version: string | null;
  };
  items: DbaasPlansEngineItem[];
  mode: 'engines';
  total_count: number;
}

export interface DbaasPlansTemplateCommandResult {
  action: 'plans';
  filters: {
    type: SupportedDatabaseType;
    version: string;
  };
  items: DbaasPlansTemplateItem[];
  mode: 'templates';
  total_count: number;
}

export interface DbaasCreateCommandResult {
  action: 'create';
  dbaas: DbaasSummaryItem;
  requested: {
    database_name: string;
    name: string;
    plan: string;
    public_ip: boolean;
    template_id: number;
    type: SupportedDatabaseType;
    username: string;
    version: string;
  };
}

export interface DbaasResetPasswordCommandResult {
  action: 'reset-password';
  dbaas: DbaasSummaryItem;
  message: string;
}

export interface DbaasDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  dbaas: DbaasSummaryItem | null;
  dbaas_id: number;
  message?: string;
}

export type DbaasPlansCommandResult =
  | DbaasPlansEngineCommandResult
  | DbaasPlansTemplateCommandResult;

export type DbaasCommandResult =
  | DbaasCreateCommandResult
  | DbaasDeleteCommandResult
  | DbaasListCommandResult
  | DbaasPlansCommandResult
  | DbaasResetPasswordCommandResult;

interface DbaasStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface DbaasServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createDbaasClient(credentials: ResolvedCredentials): DbaasClient;
  isInteractive: boolean;
  store: DbaasStore;
}

interface NormalizedDbaasCreateInput {
  databaseName: string;
  name: string;
  password: string;
  plan: string;
  publicIp: boolean;
  type: SupportedDatabaseType;
  username: string;
  version: string;
}

export class DbaasService {
  constructor(private readonly dependencies: DbaasServiceDependencies) {}

  async createDbaas(
    options: DbaasCreateOptions
  ): Promise<DbaasCreateCommandResult> {
    const input = normalizeDbaasCreateInput(options);
    const client = await this.createClient(options);
    const catalog = await client.listPlans();
    const software = resolveSoftware(catalog, input.type, input.version);
    const softwareCatalog = await client.listPlans(software.id);
    const templatePlan = resolveTemplatePlan(softwareCatalog, input.plan);
    const createResult = await client.createDbaas(
      buildCreateRequest(input, software.id, templatePlan.template_id)
    );
    const dbaasId = extractCreatedDbaasId(createResult);
    const detail = await client.getDbaas(dbaasId);
    const summary = summarizeSupportedCluster(detail);

    return {
      action: 'create',
      dbaas: summary,
      requested: {
        database_name: input.databaseName,
        name: input.name,
        plan: templatePlan.name,
        public_ip: input.publicIp,
        template_id: templatePlan.template_id,
        type: input.type,
        username: input.username,
        version: input.version
      }
    };
  }

  async deleteDbaas(
    dbaasId: string,
    options: DbaasDeleteOptions
  ): Promise<DbaasDeleteCommandResult> {
    const normalizedDbaasId = normalizeRequiredNumericId(
      dbaasId,
      'DBaaS ID',
      'the first argument'
    );
    const client = await this.createClient(options);
    const detail = await client.getDbaas(normalizedDbaasId);
    const summary = summarizeSupportedCluster(detail);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete DBaaS ${summary.id} (${summary.name})? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          dbaas: summary,
          dbaas_id: normalizedDbaasId
        };
      }
    }

    const result = await client.deleteDbaas(normalizedDbaasId);

    return {
      action: 'delete',
      cancelled: false,
      dbaas: summary,
      dbaas_id: normalizedDbaasId,
      ...(result.name === undefined
        ? {}
        : { message: `Deleted ${result.name}.` })
    };
  }

  async listDbaas(options: DbaasListOptions): Promise<DbaasListCommandResult> {
    const requestedType =
      options.type === undefined ? null : normalizeDatabaseType(options.type);
    const client = await this.createClient(options);
    const rawItems = await this.fetchAllDbaasClusters(client, requestedType);
    const items = sortDbaasListItems(
      rawItems.flatMap((item) => {
        const normalized = summarizeSupportedClusterOrNull(item);
        if (normalized === null) {
          return [];
        }

        return [
          {
            connection_string: normalized.connection_string,
            database_name: normalized.database_name,
            id: normalized.id,
            name: normalized.name,
            status: normalizeOptionalString(item.status),
            type: normalized.type,
            version: normalized.version
          }
        ];
      })
    );

    return {
      action: 'list',
      filters: {
        type: requestedType
      },
      items,
      total_count: items.length,
      total_page_number: computePageCount(items.length, DBAAS_LIST_PAGE_SIZE)
    };
  }

  async listPlans(
    options: DbaasPlansOptions
  ): Promise<DbaasPlansCommandResult> {
    if (options.dbVersion !== undefined && options.type === undefined) {
      throw new CliError('--db-version requires --type.', {
        code: 'INVALID_DBAAS_PLAN_FILTERS',
        exitCode: EXIT_CODES.usage,
        suggestion: `Run ${formatCliCommand('dbaas plans --type <database-type> --db-version <version>')}.`
      });
    }

    const requestedType =
      options.type === undefined ? null : normalizeDatabaseType(options.type);
    const requestedVersion =
      options.dbVersion === undefined
        ? null
        : normalizeRequiredString(
            options.dbVersion,
            'DB version',
            '--db-version'
          );
    const client = await this.createClient(options);
    const catalog = await client.listPlans();
    const engines = summarizeEnginePlans(catalog.database_engines);

    if (requestedType === null) {
      return {
        action: 'plans',
        filters: {
          type: null,
          version: null
        },
        items: engines,
        mode: 'engines',
        total_count: engines.length
      };
    }

    if (requestedVersion === null) {
      const filteredItems = engines.filter(
        (item) => item.type === requestedType
      );

      return {
        action: 'plans',
        filters: {
          type: requestedType,
          version: null
        },
        items: filteredItems,
        mode: 'engines',
        total_count: filteredItems.length
      };
    }

    const software = resolveSoftware(catalog, requestedType, requestedVersion);
    const softwareCatalog = await client.listPlans(software.id);
    const items = summarizeTemplatePlans(
      requestedType,
      requestedVersion,
      softwareCatalog.template_plans
    );

    return {
      action: 'plans',
      filters: {
        type: requestedType,
        version: requestedVersion
      },
      items,
      mode: 'templates',
      total_count: items.length
    };
  }

  async resetPassword(
    dbaasId: string,
    options: DbaasResetPasswordOptions
  ): Promise<DbaasResetPasswordCommandResult> {
    const normalizedDbaasId = normalizeRequiredNumericId(
      dbaasId,
      'DBaaS ID',
      'the first argument'
    );
    const password = normalizePassword(options.password, '--password');
    const client = await this.createClient(options);
    const detail = await client.getDbaas(normalizedDbaasId);
    const summary = summarizeSupportedCluster(detail);

    if (summary.username === null) {
      throw new CliError(
        `DBaaS ${normalizedDbaasId} does not expose a resettable admin username.`,
        {
          code: 'INVALID_DBAAS_RESET_PASSWORD_TARGET',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Inspect the DBaaS in the MyAccount UI and retry once the admin user is available.'
        }
      );
    }

    const result = await client.resetPassword(normalizedDbaasId, {
      password,
      username: summary.username
    });

    return {
      action: 'reset-password',
      dbaas: summary,
      message: result.message
    };
  }

  private async createClient(
    options: DbaasContextOptions
  ): Promise<DbaasClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      {
        ...(options.alias === undefined ? {} : { alias: options.alias }),
        ...(options.location === undefined
          ? {}
          : { location: options.location }),
        ...(options.projectId === undefined
          ? {}
          : { projectId: options.projectId })
      }
    );

    return this.dependencies.createDbaasClient(credentials);
  }

  private async fetchAllDbaasClusters(
    client: DbaasClient,
    requestedType: SupportedDatabaseType | null
  ): Promise<DbaasClusterSummary[]> {
    const items: DbaasClusterSummary[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= DBAAS_LIST_MAX_PAGES;
      pageNumber += 1
    ) {
      const response = await client.listDbaas(
        pageNumber,
        DBAAS_LIST_PAGE_SIZE,
        {
          ...(requestedType === null ? {} : { softwareType: requestedType })
        }
      );
      items.push(...response.items);

      const totalPages = response.total_page_number ?? 1;
      if (pageNumber >= totalPages) {
        return items;
      }
    }

    throw new CliError(
      'DBaaS listing exceeded the maximum supported pagination depth.',
      {
        code: 'DBAAS_LIST_PAGINATION_LIMIT',
        exitCode: EXIT_CODES.network,
        suggestion:
          'Retry the command. If the problem persists, narrow the result set or inspect the account in the MyAccount UI.'
      }
    );
  }
}

function normalizeDbaasCreateInput(
  options: DbaasCreateOptions
): NormalizedDbaasCreateInput {
  const name = normalizeDbaasName(options.name, 'Name', '--name');
  const databaseName = normalizeDatabaseName(options.databaseName);
  const username = normalizeUsername(options.username ?? 'admin');

  return {
    databaseName,
    name,
    type: normalizeDatabaseType(options.type),
    password: normalizePassword(options.password, '--password'),
    plan: normalizeRequiredString(options.plan, 'Plan', '--plan'),
    publicIp: options.publicIp ?? true,
    username,
    version: normalizeRequiredString(
      options.dbVersion,
      'DB version',
      '--db-version'
    )
  };
}

function buildCreateRequest(
  input: NormalizedDbaasCreateInput,
  softwareId: number,
  templateId: number
): DbaasCreateRequest {
  return {
    database: {
      dbaas_number: 1,
      name: input.databaseName,
      password: input.password,
      user: input.username
    },
    name: input.name,
    public_ip_required: input.publicIp,
    software_id: softwareId,
    template_id: templateId
  };
}

function summarizeEnginePlans(
  databaseEngines: DbaasSoftwareSummary[]
): DbaasPlansEngineItem[] {
  const items = databaseEngines.flatMap((software) => {
    const type = normalizeSupportedDatabaseTypeOrNull(software.name);
    if (type === null) {
      return [];
    }

    return [
      {
        description: normalizeOptionalString(software.description),
        engine: software.engine,
        software_id: software.id,
        type,
        version: software.version
      }
    ];
  });

  return items.sort((left, right) => {
    const typeComparison = left.type.localeCompare(right.type);
    if (typeComparison !== 0) {
      return typeComparison;
    }

    return compareVersions(right.version, left.version);
  });
}

function summarizeTemplatePlans(
  type: SupportedDatabaseType,
  version: string,
  templatePlans: DbaasTemplatePlan[]
): DbaasPlansTemplateItem[] {
  return [...templatePlans]
    .map((plan) => ({
      available: plan.available_inventory_status,
      currency: normalizeOptionalString(plan.currency),
      disk: plan.disk,
      name: plan.name,
      price_per_hour: normalizePlanHourlyPrice(plan),
      ram: plan.ram,
      template_id: plan.template_id,
      type,
      version,
      vcpu: plan.cpu
    }))
    .sort((left, right) => {
      if (left.available !== right.available) {
        return left.available ? -1 : 1;
      }

      const priceComparison =
        (left.price_per_hour ?? Number.MAX_SAFE_INTEGER) -
        (right.price_per_hour ?? Number.MAX_SAFE_INTEGER);
      if (priceComparison !== 0) {
        return priceComparison;
      }

      return left.name.localeCompare(right.name);
    });
}

function resolveSoftware(
  catalog: DbaasPlanCatalog,
  requestedType: SupportedDatabaseType,
  requestedVersion: string
): DbaasSoftwareSummary {
  const matches = catalog.database_engines.filter((software) => {
    const type = normalizeSupportedDatabaseTypeOrNull(software.name);
    return type === requestedType && software.version === requestedVersion;
  });

  const firstMatch = matches[0];
  if (matches.length === 1 && firstMatch !== undefined) {
    return firstMatch;
  }

  const availableVersions = summarizeEnginePlans(catalog.database_engines)
    .filter((item) => item.type === requestedType)
    .map((item) => item.version);
  const versionsSummary =
    availableVersions.length === 0 ? 'none' : availableVersions.join(', ');

  throw new CliError(
    `No supported ${requestedType} engine matches version ${requestedVersion}.`,
    {
      code: 'DBAAS_VERSION_NOT_FOUND',
      details: [`Available versions: ${versionsSummary}`],
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatCliCommand(`dbaas plans --type ${typeToFlagValue(requestedType)}`)} to inspect valid versions.`
    }
  );
}

function resolveTemplatePlan(
  catalog: DbaasPlanCatalog,
  requestedPlan: string
): DbaasTemplatePlan {
  const normalizedRequestedPlan = requestedPlan.trim().toLowerCase();
  const exactMatches = catalog.template_plans.filter(
    (item) => item.name.trim().toLowerCase() === normalizedRequestedPlan
  );

  if (exactMatches.length === 0) {
    throw new CliError(`No DBaaS plan matches "${requestedPlan}".`, {
      code: 'DBAAS_PLAN_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Run dbaas plans with the same --type and --db-version values, then retry with one of the listed plan names.'
    });
  }

  const availableMatches = exactMatches.filter(
    (item) => item.available_inventory_status
  );
  const firstAvailableMatch = availableMatches[0];
  if (availableMatches.length === 1 && firstAvailableMatch !== undefined) {
    return firstAvailableMatch;
  }

  if (availableMatches.length > 1) {
    const details = availableMatches.map(
      (item) => `template_id=${item.template_id}, name=${item.name}`
    );

    throw new CliError(
      `Multiple available DBaaS plans match "${requestedPlan}".`,
      {
        code: 'DBAAS_PLAN_AMBIGUOUS',
        details,
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Retry with a more specific plan name after reviewing the output of dbaas plans.'
      }
    );
  }

  throw new CliError(
    `DBaaS plan "${requestedPlan}" is currently unavailable.`,
    {
      code: 'DBAAS_PLAN_UNAVAILABLE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Choose a plan row marked Available=yes from dbaas plans, or retry later once inventory returns.'
    }
  );
}

function summarizeSupportedCluster(
  cluster: DbaasClusterDetail
): DbaasSummaryItem {
  const summary = summarizeSupportedClusterOrNull(cluster);

  if (summary === null) {
    throw new CliError(
      `DBaaS ${cluster.id} is not one of the supported engines (MariaDB, MySQL, PostgreSQL).`,
      {
        code: 'UNSUPPORTED_DBAAS_ENGINE',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Use this command with MariaDB, MySQL, or PostgreSQL clusters only.'
      }
    );
  }

  return summary;
}

function summarizeSupportedClusterOrNull(
  cluster: DbaasClusterSummary
): DbaasSummaryItem | null {
  const type = normalizeSupportedDatabaseTypeOrNull(cluster.software.name);
  if (type === null) {
    return null;
  }

  const databaseName = normalizeOptionalString(
    cluster.master_node.database?.database
  );
  const username = normalizeOptionalString(
    cluster.master_node.database?.username
  );

  return {
    connection_string: buildConnectionString(
      type,
      databaseName,
      username,
      cluster.master_node
    ),
    database_name: databaseName,
    id: cluster.id,
    name: cluster.name,
    type,
    username,
    version: cluster.software.version
  };
}

function buildConnectionString(
  type: SupportedDatabaseType,
  databaseName: string | null,
  username: string | null,
  masterNode: DbaasClusterSummary['master_node']
): string | null {
  const host =
    normalizeHost(masterNode.domain) ??
    normalizeHost(masterNode.public_ip_address) ??
    normalizeHost(masterNode.private_ip_address);
  const port = normalizePort(masterNode.public_port ?? masterNode.port ?? null);

  if (host === null || username === null) {
    return null;
  }

  if (type === 'PostgreSQL') {
    return databaseName === null
      ? `psql -h ${host}${port === null ? '' : ` -p ${port}`} -U ${username}`
      : `psql -h ${host}${port === null ? '' : ` -p ${port}`} -U ${username} -d ${databaseName}`;
  }

  return `mysql -h ${host}${port === null ? '' : ` -P ${port}`} -u ${username} -p`;
}

function extractCreatedDbaasId(result: DbaasCreateResult): number {
  const candidate = result.id ?? result.cluster_id ?? null;
  if (
    typeof candidate === 'number' &&
    Number.isInteger(candidate) &&
    candidate > 0
  ) {
    return candidate;
  }

  throw new CliError(
    'The DBaaS create response did not include a usable cluster id.',
    {
      code: 'INVALID_DBAAS_CREATE_RESPONSE',
      exitCode: EXIT_CODES.network,
      suggestion:
        'Retry the command. If the resource was created, use dbaas list to find it.'
    }
  );
}

function normalizeDatabaseType(value: string): SupportedDatabaseType {
  const normalizedValue = normalizeRequiredString(
    value,
    'Database type',
    '--type'
  ).toLowerCase();
  const match = SUPPORTED_DATABASE_TYPES.find(({ aliases }) =>
    aliases.some((alias) => alias === normalizedValue)
  );

  if (match !== undefined) {
    return match.canonical;
  }

  throw new CliError(`Unsupported database type "${value}".`, {
    code: 'UNSUPPORTED_DBAAS_TYPE',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Use one of: maria, sql, postgres.'
  });
}

function normalizeSupportedDatabaseTypeOrNull(
  value: string
): SupportedDatabaseType | null {
  const normalizedValue = value.trim().toLowerCase();
  const match = SUPPORTED_DATABASE_TYPES.find(
    ({ canonical }) => canonical.toLowerCase() === normalizedValue
  );

  return match?.canonical ?? null;
}

function normalizeDbaasName(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = normalizeRequiredString(value, label, flag);
  if (normalized.length > 128 || !DBAAS_NAME_REGEX.test(normalized)) {
    throw new CliError(`${label} must match ^[a-zA-Z0-9-_]{1,128}$.`, {
      code: 'INVALID_DBAAS_NAME',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a name with letters, numbers, hyphens, or underscores using ${flag}.`
    });
  }

  return normalized;
}

function normalizeDatabaseName(value: string): string {
  const normalized = normalizeRequiredString(
    value,
    'Database name',
    '--database-name'
  );
  if (normalized.length > 64) {
    throw new CliError('Database name must be 64 characters or fewer.', {
      code: 'INVALID_DBAAS_DATABASE_NAME',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Retry with a shorter value for --database-name.'
    });
  }

  return normalized;
}

function normalizeUsername(value: string): string {
  const normalized = normalizeRequiredString(value, 'Username', '--username');
  if (normalized.length > 80 || !DBAAS_USERNAME_REGEX.test(normalized)) {
    throw new CliError(
      'Username must contain only lowercase letters and digits, up to 80 characters.',
      {
        code: 'INVALID_DBAAS_USERNAME',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Retry with --username set to a lowercase alphanumeric value such as admin.'
      }
    );
  }

  return normalized;
}

function normalizePassword(value: string, flag: string): string {
  const normalized = normalizeRequiredString(value, 'Password', flag);
  if (!DBAAS_PASSWORD_REGEX.test(normalized)) {
    throw new CliError(
      'Password must be 16-30 characters and include uppercase, lowercase, numeric, and special characters.',
      {
        code: 'INVALID_DBAAS_PASSWORD',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Retry with a password that matches the MyAccount DBaaS password policy.'
      }
    );
  }

  return normalized;
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
    code: 'INVALID_DBAAS_INPUT',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}

function normalizeRequiredNumericId(
  value: string,
  label: string,
  flagDescription: string
): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new CliError(`${label} cannot be empty.`, {
      code: 'INVALID_DBAAS_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass the numeric ${label.toLowerCase()} as ${flagDescription}.`
    });
  }

  if (!/^\d+$/.test(normalized)) {
    throw new CliError(`${label} must be numeric.`, {
      code: 'INVALID_DBAAS_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass the numeric ${label.toLowerCase()} as ${flagDescription}.`
    });
  }

  return Number(normalized);
}

function assertCanDelete(isInteractive: boolean): void {
  if (!isInteractive) {
    throw new CliError(
      'Deleting a DBaaS requires confirmation in an interactive terminal.',
      {
        code: 'DBAAS_DELETE_CONFIRMATION_REQUIRED',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Re-run the command with --force to skip the prompt.'
      }
    );
  }
}

function compareVersions(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function computePageCount(totalCount: number, pageSize: number): number {
  if (totalCount === 0) {
    return 0;
  }

  return Math.ceil(totalCount / pageSize);
}

function normalizePlanHourlyPrice(plan: DbaasTemplatePlan): number | null {
  const candidate = plan.price_per_hour ?? plan.price;
  if (typeof candidate === 'number') {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeHost(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value);

  if (
    normalized === null ||
    normalized === '[]' ||
    normalized.toLowerCase() === 'none' ||
    normalized.toLowerCase() === 'null'
  ) {
    return null;
  }

  return normalized;
}

function normalizePort(value: number | string | null): string | null {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }

  return null;
}

function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function sortDbaasListItems(items: DbaasListItem[]): DbaasListItem[] {
  return [...items].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }

    const typeComparison = left.type.localeCompare(right.type);
    if (typeComparison !== 0) {
      return typeComparison;
    }

    const versionComparison = compareVersions(right.version, left.version);
    if (versionComparison !== 0) {
      return versionComparison;
    }

    return left.id - right.id;
  });
}

function typeToFlagValue(value: SupportedDatabaseType): string {
  switch (value) {
    case 'MariaDB':
      return 'maria';
    case 'MySQL':
      return 'sql';
    case 'PostgreSQL':
      return 'postgres';
  }
}
