import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { SecurityGroupClient } from './client.js';
import type {
  SecurityGroupCreateRequest,
  SecurityGroupRuleInput,
  SecurityGroupRuleSummary,
  SecurityGroupSummary,
  SecurityGroupUpdateRequest
} from './types.js';

export interface SecurityGroupContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface SecurityGroupCreateOptions extends SecurityGroupContextOptions {
  default?: boolean;
  description?: string;
  name: string;
  rulesFile: string;
}

export interface SecurityGroupUpdateOptions extends SecurityGroupContextOptions {
  description?: string;
  name: string;
  rulesFile: string;
}

export interface SecurityGroupDeleteOptions extends SecurityGroupContextOptions {
  force?: boolean;
}

export interface SecurityGroupRuleItem {
  description: string;
  id: number | null;
  network: string;
  network_cidr: string;
  network_size: number | null;
  port_range: string;
  protocol_name: string;
  rule_type: string;
  vpc_id: number | null;
}

export interface SecurityGroupItem {
  description: string;
  id: number;
  is_all_traffic_rule: boolean;
  is_default: boolean;
  name: string;
  rules: SecurityGroupRuleItem[];
}

export interface SecurityGroupListCommandResult {
  action: 'list';
  items: SecurityGroupItem[];
}

export interface SecurityGroupGetCommandResult {
  action: 'get';
  security_group: SecurityGroupItem;
}

export interface SecurityGroupCreateCommandResult {
  action: 'create';
  message: string;
  security_group: {
    description: string;
    is_default: boolean;
    label_id: string | null;
    name: string;
    resource_type: string | null;
    rule_count: number;
  };
}

export interface SecurityGroupUpdateCommandResult {
  action: 'update';
  message: string;
  security_group: {
    description: string;
    id: number;
    name: string;
    rule_count: number;
  };
}

export interface SecurityGroupDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  message?: string;
  security_group: {
    id: number;
    name: string | null;
  };
}

export type SecurityGroupCommandResult =
  | SecurityGroupCreateCommandResult
  | SecurityGroupDeleteCommandResult
  | SecurityGroupGetCommandResult
  | SecurityGroupListCommandResult
  | SecurityGroupUpdateCommandResult;

interface SecurityGroupStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface SecurityGroupServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createSecurityGroupClient(
    credentials: ResolvedCredentials
  ): SecurityGroupClient;
  isInteractive: boolean;
  readRulesFile(path: string): Promise<string>;
  readRulesFromStdin(): Promise<string>;
  store: SecurityGroupStore;
}

interface NormalizedSecurityGroupInput {
  description: string;
  name: string;
  rules: SecurityGroupRuleInput[];
}

interface NormalizedSecurityGroupUpdateLocalInput {
  description?: string;
  name: string;
  rules: SecurityGroupRuleInput[];
}

export class SecurityGroupService {
  constructor(
    private readonly dependencies: SecurityGroupServiceDependencies
  ) {}

  async createSecurityGroup(
    options: SecurityGroupCreateOptions
  ): Promise<SecurityGroupCreateCommandResult> {
    const input = await this.normalizeCreateInput(options);
    const client = await this.createClient(options);
    const result = await client.createSecurityGroup(
      buildCreateRequest(input, options.default ?? false)
    );

    return {
      action: 'create',
      message: result.message,
      security_group: {
        description: input.description,
        is_default: options.default ?? false,
        label_id: result.result.label_id ?? null,
        name: input.name,
        resource_type: result.result.resource_type ?? null,
        rule_count: input.rules.length
      }
    };
  }

  async deleteSecurityGroup(
    securityGroupId: string,
    options: SecurityGroupDeleteOptions
  ): Promise<SecurityGroupDeleteCommandResult> {
    const normalizedSecurityGroupId = normalizeSecurityGroupId(securityGroupId);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
      const confirmed = await this.dependencies.confirm(
        `Delete security group ${normalizedSecurityGroupId}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          security_group: {
            id: normalizedSecurityGroupId,
            name: null
          }
        };
      }
    }

    const client = await this.createClient(options);
    const result = await client.deleteSecurityGroup(normalizedSecurityGroupId);

    return {
      action: 'delete',
      cancelled: false,
      message: result.message,
      security_group: {
        id: normalizedSecurityGroupId,
        name: result.result.name ?? null
      }
    };
  }

  async getSecurityGroup(
    securityGroupId: string,
    options: SecurityGroupContextOptions
  ): Promise<SecurityGroupGetCommandResult> {
    const normalizedSecurityGroupId = normalizeSecurityGroupId(securityGroupId);
    const client = await this.createClient(options);

    return {
      action: 'get',
      security_group: summarizeSecurityGroup(
        await client.getSecurityGroup(normalizedSecurityGroupId)
      )
    };
  }

  async listSecurityGroups(
    options: SecurityGroupContextOptions
  ): Promise<SecurityGroupListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      items: (await client.listSecurityGroups()).map((item) =>
        summarizeSecurityGroup(item)
      )
    };
  }

  async updateSecurityGroup(
    securityGroupId: string,
    options: SecurityGroupUpdateOptions
  ): Promise<SecurityGroupUpdateCommandResult> {
    const normalizedSecurityGroupId = normalizeSecurityGroupId(securityGroupId);
    const localInput = await this.normalizeUpdateLocalInput(options);
    const client = await this.createClient(options);
    const input: NormalizedSecurityGroupInput = {
      description:
        localInput.description ??
        normalizeExistingDescription(
          await client.getSecurityGroup(normalizedSecurityGroupId)
        ),
      name: localInput.name,
      rules: localInput.rules
    };
    const result = await client.updateSecurityGroup(
      normalizedSecurityGroupId,
      buildUpdateRequest(input)
    );

    return {
      action: 'update',
      message: result.message,
      security_group: {
        description: input.description,
        id: normalizedSecurityGroupId,
        name: input.name,
        rule_count: input.rules.length
      }
    };
  }

  private async createClient(
    options: SecurityGroupContextOptions
  ): Promise<SecurityGroupClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

    return this.dependencies.createSecurityGroupClient(credentials);
  }

  private async normalizeCreateInput(
    options: SecurityGroupCreateOptions
  ): Promise<NormalizedSecurityGroupInput> {
    return {
      description: normalizeOptionalDescription(options.description),
      name: normalizeRequiredOption(options.name, 'Name', '--name'),
      rules: await this.loadRules(options.rulesFile)
    };
  }

  private async normalizeUpdateLocalInput(
    options: SecurityGroupUpdateOptions
  ): Promise<NormalizedSecurityGroupUpdateLocalInput> {
    return {
      ...(options.description === undefined
        ? {}
        : {
            description: normalizeOptionalDescription(options.description)
          }),
      name: normalizeRequiredOption(options.name, 'Name', '--name'),
      rules: await this.loadRules(options.rulesFile)
    };
  }

  private async loadRules(
    rulesFile: string
  ): Promise<SecurityGroupRuleInput[]> {
    const normalizedRulesFile = normalizeRequiredOption(
      rulesFile,
      'Rules file',
      '--rules-file'
    );

    try {
      const content =
        normalizedRulesFile === '-'
          ? await this.dependencies.readRulesFromStdin()
          : await this.dependencies.readRulesFile(normalizedRulesFile);

      return normalizeRulesJson(content);
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      throw wrapRulesReadError(normalizedRulesFile, error);
    }
  }
}

function assertCanDelete(isInteractive: boolean): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(
    'Deleting a security group requires confirmation in an interactive terminal.',
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
    }
  );
}

function buildCreateRequest(
  input: NormalizedSecurityGroupInput,
  isDefault: boolean
): SecurityGroupCreateRequest {
  return {
    ...(isDefault ? { default: true } : {}),
    description: input.description,
    name: input.name,
    rules: input.rules
  };
}

function buildUpdateRequest(
  input: NormalizedSecurityGroupInput
): SecurityGroupUpdateRequest {
  return {
    description: input.description,
    name: input.name,
    rules: input.rules
  };
}

function normalizeExistingDescription(
  securityGroup: SecurityGroupSummary | null
): string {
  return securityGroup?.description ?? '';
}

function normalizeOptionalDescription(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value.trim();
}

function normalizeRequiredOption(
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

function normalizeRulesJson(content: string): SecurityGroupRuleInput[] {
  const normalizedContent = content.trim();
  if (normalizedContent.length === 0) {
    throw new CliError('Rules content cannot be empty.', {
      code: 'EMPTY_RULES_FILE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Provide a JSON array of backend-compatible security-group rule objects.'
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedContent);
  } catch (error: unknown) {
    throw wrapRulesParseError(error);
  }

  if (!Array.isArray(parsed)) {
    throw new CliError('Rules content must be a JSON array.', {
      code: 'INVALID_RULES_FILE',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Provide a JSON array of backend-compatible security-group rule objects.'
    });
  }

  const normalizedRules: SecurityGroupRuleInput[] = [];

  parsed.forEach((rule, index) => {
    if (rule === null || Array.isArray(rule) || typeof rule !== 'object') {
      throw new CliError(
        `Rule ${index + 1} must be a JSON object compatible with the backend rule schema.`,
        {
          code: 'INVALID_RULES_FILE',
          exitCode: EXIT_CODES.usage,
          suggestion:
            'Each rule entry should be an object, for example {"network":"any","rule_type":"Inbound","protocol_name":"Custom_TCP","port_range":"22"}.'
        }
      );
    }

    normalizedRules.push(rule as SecurityGroupRuleInput);
  });

  return normalizedRules;
}

function normalizeSecurityGroupId(securityGroupId: string): number {
  const normalizedValue = normalizeRequiredOption(
    securityGroupId,
    'Security group ID',
    '<securityGroupId>'
  );

  if (/^\d+$/.test(normalizedValue)) {
    const parsed = Number(normalizedValue);
    if (parsed <= Number.MAX_SAFE_INTEGER) {
      return parsed;
    }
  }

  throw new CliError('Security group ID must be numeric.', {
    code: 'INVALID_SECURITY_GROUP_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass the numeric security group id as the first argument.'
  });
}

function summarizeSecurityGroup(item: SecurityGroupSummary): SecurityGroupItem {
  return {
    description: item.description ?? '',
    id: item.id,
    is_all_traffic_rule: item.is_all_traffic_rule ?? false,
    is_default: item.is_default,
    name: item.name,
    rules: (item.rules ?? []).map((rule) => summarizeSecurityGroupRule(rule))
  };
}

function summarizeSecurityGroupRule(
  rule: SecurityGroupRuleSummary
): SecurityGroupRuleItem {
  return {
    description: rule.description ?? '',
    id: rule.id ?? null,
    network: rule.network ?? '',
    network_cidr: rule.network_cidr ?? '',
    network_size: rule.network_size ?? null,
    port_range: rule.port_range ?? '',
    protocol_name: rule.protocol_name ?? '',
    rule_type: rule.rule_type ?? '',
    vpc_id: rule.vpc_id ?? null
  };
}

function wrapRulesParseError(error: unknown): CliError {
  const reason =
    error instanceof Error ? error.message : 'Unknown parse error.';

  return new CliError('Rules content is not valid JSON.', {
    code: 'INVALID_RULES_FILE',
    details: [`Reason: ${reason}`],
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Fix the JSON syntax so the file contains a valid array of backend-compatible security-group rule objects.'
  });
}

function wrapRulesReadError(rulesFile: string, error: unknown): CliError {
  return new CliError(
    rulesFile === '-'
      ? 'Could not read security-group rules from stdin.'
      : `Could not read security-group rules file: ${rulesFile}`,
    {
      code: 'RULES_FILE_READ_FAILED',
      cause: error,
      exitCode: EXIT_CODES.usage,
      suggestion:
        rulesFile === '-'
          ? `Pipe a JSON rules array into the command, for example: cat rules.json | ${formatCliCommand('security-group create --name demo --rules-file -')}`
          : 'Verify that the file exists, is readable, and contains a JSON array of rule objects.'
    }
  );
}
