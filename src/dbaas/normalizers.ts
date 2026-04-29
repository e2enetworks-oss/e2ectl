import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import {
  DBAAS_CREATE_BILLING_TYPES,
  DBAAS_IP_REGEX,
  DBAAS_NAME_REGEX,
  DBAAS_PASSWORD_REGEX,
  DBAAS_USERNAME_REGEX,
  SUPPORTED_DATABASE_TYPES
} from './constants.js';
import type {
  DbaasCommittedRenewal,
  DbaasCreateBillingType,
  DbaasCreateOptions,
  DbaasPasswordOptions,
  NormalizedDbaasCreateInput,
  SupportedDatabaseType
} from './types/index.js';

export function normalizeDbaasCreateInput(
  options: DbaasCreateOptions,
  password: string
): NormalizedDbaasCreateInput {
  const name = normalizeDbaasName(options.name, 'Name', '--name');
  const databaseName = normalizeDatabaseName(options.databaseName);
  const username = normalizeUsername(options.username ?? 'admin');
  const billingType = normalizeCreateBillingType(options.billingType);
  const committedPlanId = normalizeCommittedPlanId(
    billingType,
    options.committedPlanId
  );
  const committedRenewal = normalizeCommittedRenewal(options.committedRenewal);
  const vpcId =
    options.vpcId === undefined
      ? null
      : normalizeRequiredNumericId(options.vpcId, 'VPC ID', '--vpc-id');
  const subnetId =
    options.subnetId === undefined
      ? null
      : normalizeRequiredNumericId(
          options.subnetId,
          'Subnet ID',
          '--subnet-id'
        );

  if (vpcId === null && subnetId !== null) {
    throw new CliError('--subnet-id can only be used with --vpc-id.', {
      code: 'UNEXPECTED_DBAAS_SUBNET_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Remove --subnet-id, or add --vpc-id to attach the DBaaS to a VPC during creation.'
    });
  }

  if (vpcId === null && options.publicIp !== undefined) {
    throw new CliError(
      'DBaaS public IP creation flags can only be used with --vpc-id.',
      {
        code: 'UNEXPECTED_DBAAS_PUBLIC_IP_FLAG',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Attach the DBaaS to a VPC with --vpc-id before choosing --public-ip or --no-public-ip.'
      }
    );
  }

  return {
    billingType,
    committedPlanId,
    committedRenewal,
    databaseName,
    name,
    type: normalizeDatabaseType(options.type),
    password,
    plan: normalizeRequiredString(options.plan, 'Plan', '--plan'),
    publicIp: options.publicIp ?? true,
    subnetId,
    username,
    version: normalizeRequiredString(
      options.dbVersion,
      'DB version',
      '--db-version'
    ),
    vpcId
  };
}

export function normalizeCreateBillingType(
  value: string | undefined
): DbaasCreateBillingType {
  if (value === undefined) {
    return 'hourly';
  }

  const normalized = value.trim().toLowerCase();
  if (
    DBAAS_CREATE_BILLING_TYPES.includes(normalized as DbaasCreateBillingType)
  ) {
    return normalized as DbaasCreateBillingType;
  }

  throw new CliError(
    `Billing type must be one of: ${DBAAS_CREATE_BILLING_TYPES.join(', ')}.`,
    {
      code: 'INVALID_DBAAS_BILLING_TYPE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass --billing-type ${DBAAS_CREATE_BILLING_TYPES.join(' or --billing-type ')}.`
    }
  );
}

export function normalizeCommittedPlanId(
  billingType: DbaasCreateBillingType,
  committedPlanId: string | undefined
): number | null {
  if (billingType === 'committed') {
    if (committedPlanId === undefined) {
      throw new CliError(
        'Committed plan ID is required when --billing-type committed is used.',
        {
          code: 'MISSING_COMMITTED_PLAN_ID',
          exitCode: EXIT_CODES.usage,
          suggestion: 'Pass a committed SKU ID with --committed-plan-id.'
        }
      );
    }

    return normalizeRequiredNumericId(
      committedPlanId,
      'Committed plan ID',
      '--committed-plan-id'
    );
  }

  if (committedPlanId !== undefined) {
    throw new CliError(
      '--committed-plan-id can only be used with --billing-type committed.',
      {
        code: 'UNEXPECTED_COMMITTED_PLAN_ID',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Remove --committed-plan-id, or add --billing-type committed.'
      }
    );
  }

  return null;
}

export function normalizeCommittedRenewal(
  value: string | undefined
): DbaasCommittedRenewal {
  if (value === undefined || value === 'auto-renew') {
    return 'auto_renew';
  }

  if (value === 'hourly') {
    return 'hourly_billing';
  }

  throw new CliError('Committed renewal must be auto-renew or hourly.', {
    code: 'INVALID_DBAAS_COMMITTED_RENEWAL',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass --committed-renewal auto-renew to renew automatically, or --committed-renewal hourly to switch to hourly billing after the term.'
  });
}

export function normalizePasswordSource(
  options: DbaasPasswordOptions
):
  | { kind: 'value'; label: string; value: string }
  | { kind: 'file'; label: string; path: string } {
  if (options.password !== undefined && options.passwordFile !== undefined) {
    throw new CliError('Use only one password source.', {
      code: 'CONFLICTING_DBAAS_PASSWORD_FLAGS',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Remove one password source. Prefer --password-file for scripts and secret managers.'
    });
  }

  if (options.password !== undefined) {
    return { kind: 'value', label: '--password', value: options.password };
  }

  if (options.passwordFile !== undefined) {
    const path = normalizeRequiredString(
      options.passwordFile,
      'Password file',
      '--password-file'
    );
    return { kind: 'file', label: '--password-file', path };
  }

  throw new CliError('Password is required.', {
    code: 'MISSING_DBAAS_PASSWORD',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass --password for interactive use, or --password-file with a file path or - for stdin.'
  });
}

export function wrapPasswordReadError(
  passwordFile: string,
  error: unknown
): CliError {
  return new CliError(
    passwordFile === '-'
      ? 'Could not read DBaaS password from stdin.'
      : `Could not read DBaaS password file: ${passwordFile}`,
    {
      code: 'DBAAS_PASSWORD_READ_FAILED',
      cause: error,
      exitCode: EXIT_CODES.usage,
      suggestion:
        passwordFile === '-'
          ? `Pipe the password into the command, for example: printf '%s' '<password>' | ${formatCliCommand('dbaas create --name <name> --type <database-type> --db-version <version> --plan <plan-name> --database-name <database-name> --password-file -')}`
          : 'Verify that the file exists, is readable, and contains only the DBaaS admin password.'
    }
  );
}

export function normalizeDatabaseType(value: string): SupportedDatabaseType {
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

export function normalizeSupportedDatabaseTypeOrNull(
  value: string
): SupportedDatabaseType | null {
  const normalizedValue = value.trim().toLowerCase();
  const match = SUPPORTED_DATABASE_TYPES.find(
    ({ canonical }) => canonical.toLowerCase() === normalizedValue
  );

  return match?.canonical ?? null;
}

export function normalizeDbaasName(
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

export function normalizeDatabaseName(value: string): string {
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

export function normalizeUsername(value: string): string {
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

export function normalizePassword(value: string, flag: string): string {
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

export function normalizeRequiredString(
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

export function normalizeRequiredNumericId(
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

export function normalizeIpAddress(value: string): string {
  const normalized = normalizeRequiredString(value, 'IP address', '--ip');
  if (!DBAAS_IP_REGEX.test(normalized)) {
    throw new CliError('IP address must be a valid IPv4 address or CIDR.', {
      code: 'INVALID_DBAAS_WHITELIST_IP',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass an IPv4 address such as 203.0.113.10, or a CIDR such as 203.0.113.0/24.'
    });
  }

  return normalized;
}

export function normalizeTagIds(values: string[]): number[] {
  return values.map((value) =>
    normalizeRequiredNumericId(value, 'Tag ID', '--tag-id')
  );
}

export function assertCanDelete(isInteractive: boolean): void {
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

export function assertCanDetachPublicIp(isInteractive: boolean): void {
  if (!isInteractive) {
    throw new CliError(
      'Detaching a DBaaS public IP requires confirmation in an interactive terminal.',
      {
        code: 'DBAAS_PUBLIC_IP_DETACH_CONFIRMATION_REQUIRED',
        exitCode: EXIT_CODES.usage,
        suggestion:
          'Re-run the command with --force only if you accept that external DBaaS connectivity will be lost.'
      }
    );
  }
}

export function compareVersions(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

export function computePageCount(totalCount: number, pageSize: number): number {
  if (totalCount === 0) {
    return 0;
  }

  return Math.ceil(totalCount / pageSize);
}

export function normalizeHost(value: string | null | undefined): string | null {
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

export function normalizePort(value: number | string | null): string | null {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }

  return null;
}

export function normalizePlanValue(
  value: number | string | null | undefined
): string | null {
  if (typeof value === 'number') {
    return String(value);
  }

  return normalizeOptionalString(value);
}

export function normalizeOptionalNumber(
  value: number | null | undefined
): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeSubnetId(
  subnet: number | number[] | null | undefined,
  subnets: Array<{ id?: number }> | undefined
): number | null {
  if (typeof subnet === 'number') {
    return subnet;
  }

  if (Array.isArray(subnet)) {
    const first = subnet.find((item) => Number.isInteger(item));
    return first ?? null;
  }

  const firstSubnet = subnets?.find((item) => Number.isInteger(item.id));
  return firstSubnet?.id ?? null;
}
export function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function typeToFlagValue(value: SupportedDatabaseType): string {
  switch (value) {
    case 'MariaDB':
      return 'maria';
    case 'MySQL':
      return 'sql';
    case 'PostgreSQL':
      return 'postgres';
  }
}
