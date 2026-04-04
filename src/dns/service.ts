import { isIPv4, isIPv6 } from 'node:net';

import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { formatCliCommand } from '../app/metadata.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { DnsClient } from './client.js';
import type {
  DnsDetailsResponse,
  DnsListEntry,
  DnsNameserverDiagnosticResponse,
  DnsTtlDiagnosticResponse,
  DnsValidityDiagnosticResponse,
  DnsZoneRecord,
  DnsZoneRrset
} from './types.js';

const HIDDEN_RRSET_TYPES = new Set(['NS', 'SOA']);
const SUPPORTED_RECORD_TYPES = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'SRV'
] as const;

type SupportedDnsRecordType = (typeof SUPPORTED_RECORD_TYPES)[number];

export interface DnsContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface DnsCreateOptions extends DnsContextOptions {
  ip: string;
}

export interface DnsDeleteOptions extends DnsContextOptions {
  force?: boolean;
}

interface DnsRecordValueOptions {
  exchange?: string;
  port?: string;
  priority?: string;
  target?: string;
  value?: string;
  weight?: string;
}

export interface DnsRecordCreateOptions
  extends DnsContextOptions, DnsRecordValueOptions {
  name?: string;
  ttl?: string;
  type: string;
}

export interface DnsRecordUpdateOptions
  extends DnsContextOptions, DnsRecordValueOptions {
  currentValue: string;
  name?: string;
  ttl?: string;
  type: string;
}

export interface DnsRecordDeleteOptions extends DnsContextOptions {
  force?: boolean;
  name?: string;
  type: string;
  value: string;
}

export interface DnsListItem {
  created_at: string | null;
  deleted: boolean;
  domain_name: string;
  id: number;
  ip_address: string;
  validity: string | null;
}

export interface DnsZoneRecordItem {
  content: string;
  disabled: boolean;
}

export interface DnsZoneRrsetItem {
  name: string;
  records: DnsZoneRecordItem[];
  ttl: number | null;
  type: string;
}

export interface DnsDerivedSoaItem {
  name: string;
  ttl: number | null;
  values: string[];
}

export interface DnsFlattenedRecordItem {
  disabled: boolean;
  name: string;
  ttl: number | null;
  type: string;
  value: string;
}

export interface DnsDomainDetailsItem {
  domain_name: string;
  domain_ttl: number | null;
  ip_address: string;
  nameservers: string[];
  records: DnsFlattenedRecordItem[];
  rrsets: DnsZoneRrsetItem[];
  soa: DnsDerivedSoaItem | null;
}

export interface DnsListCommandResult {
  action: 'list';
  items: DnsListItem[];
}

export interface DnsGetCommandResult {
  action: 'get';
  domain: DnsDomainDetailsItem;
}

export interface DnsCreateCommandResult {
  action: 'create';
  domain: {
    id: number;
  };
  message: string;
  requested: {
    domain_name: string;
    ip_address: string;
  };
}

export interface DnsDeleteCommandResult {
  action: 'delete';
  cancelled: boolean;
  domain_name: string;
  message?: string;
}

export interface DnsVerifyNsCommandResult {
  action: 'verify-ns';
  authority: boolean | null;
  domain_name: string;
  e2e_nameservers: string[];
  global_nameservers: string[];
  message: string;
  problem: number | null;
  status: boolean;
}

export interface DnsNameserversCommandResult {
  action: 'nameservers';
  authority_match: boolean;
  configured_nameservers: string[];
  delegated_nameservers: string[];
  domain_name: string;
  message: string;
  problem: number | null;
  status: boolean;
}

export interface DnsVerifyValidityCommandResult {
  action: 'verify-validity';
  domain_name: string;
  expiry_date: string | null;
  message: string;
  problem: number | null;
  status: boolean;
  validity_ok: boolean | null;
}

export interface DnsVerifyTtlCommandResult {
  action: 'verify-ttl';
  domain_name: string;
  low_ttl_count: number;
  low_ttl_records: DnsZoneRrsetItem[];
  message: string;
  status: boolean;
}

export interface DnsRecordListCommandResult {
  action: 'record-list';
  domain_name: string;
  items: DnsFlattenedRecordItem[];
}

export interface DnsRecordCreateCommandResult {
  action: 'record-create';
  domain_name: string;
  message: string;
  record: {
    name: string;
    ttl: number | null;
    type: string;
    value: string;
  };
}

export interface DnsRecordUpdateCommandResult {
  action: 'record-update';
  domain_name: string;
  message: string;
  record: {
    current_value: string;
    name: string;
    new_value: string;
    ttl: number | null;
    type: string;
  };
}

export interface DnsRecordDeleteCommandResult {
  action: 'record-delete';
  cancelled: boolean;
  domain_name: string;
  message?: string;
  record: {
    name: string;
    type: string;
    value: string;
  };
}

export type DnsCommandResult =
  | DnsCreateCommandResult
  | DnsDeleteCommandResult
  | DnsGetCommandResult
  | DnsListCommandResult
  | DnsNameserversCommandResult
  | DnsRecordCreateCommandResult
  | DnsRecordDeleteCommandResult
  | DnsRecordListCommandResult
  | DnsRecordUpdateCommandResult
  | DnsVerifyNsCommandResult
  | DnsVerifyTtlCommandResult
  | DnsVerifyValidityCommandResult;

interface BuiltDnsRecordValue {
  backendContent: string;
  displayValue: string;
}

interface DnsStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface DnsServiceDependencies {
  confirm(message: string): Promise<boolean>;
  createDnsClient(credentials: ResolvedCredentials): DnsClient;
  isInteractive: boolean;
  store: DnsStore;
}

export class DnsService {
  constructor(private readonly dependencies: DnsServiceDependencies) {}

  async createDomain(
    domainName: string,
    options: DnsCreateOptions
  ): Promise<DnsCreateCommandResult> {
    const requestedDomainName = normalizeRequestedDomainName(domainName);
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const ipAddress = assertIpv4Address(options.ip);
    const client = await this.createClient(options);
    const result = await client.createDomain({
      domain_name: canonicalDomainName,
      ip_addr: ipAddress
    });

    return {
      action: 'create',
      domain: {
        id: result.id
      },
      message: result.message,
      requested: {
        domain_name: requestedDomainName,
        ip_address: ipAddress
      }
    };
  }

  async createRecord(
    domainName: string,
    options: DnsRecordCreateOptions
  ): Promise<DnsRecordCreateCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const recordType = assertSupportedRecordType(options.type);
    const recordNameInput = normalizeRecordNameInput(options.name, recordType);
    const recordName = canonicalizeRecordName(
      recordNameInput,
      canonicalDomainName
    );
    const recordTtl = parseOptionalPositiveInteger(
      options.ttl,
      '--ttl',
      'Pass a positive integer TTL like 300 with --ttl.'
    );
    const recordValue = buildRecordValue(recordType, options);
    const client = await this.createClient(options);
    const result = await client.createRecord(canonicalDomainName, {
      ...(recordTtl === undefined ? {} : { record_ttl: recordTtl }),
      content: recordValue.backendContent,
      record_name: recordName,
      record_type: recordType,
      zone_name: canonicalDomainName
    });

    return {
      action: 'record-create',
      domain_name: canonicalDomainName,
      message: result.message,
      record: {
        name: recordName,
        ttl: recordTtl ?? null,
        type: recordType,
        value: recordValue.displayValue
      }
    };
  }

  async deleteDomain(
    domainName: string,
    options: DnsDeleteOptions
  ): Promise<DnsDeleteCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);

    if (!(options.force ?? false)) {
      assertCanDelete(
        this.dependencies.isInteractive,
        'Deleting a DNS domain requires confirmation in an interactive terminal.',
        'Re-run the command with --force to skip the prompt.'
      );
      const confirmed = await this.dependencies.confirm(
        `Delete DNS domain ${canonicalDomainName}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'delete',
          cancelled: true,
          domain_name: canonicalDomainName
        };
      }
    }

    const client = await this.createClient(options);
    const domainId = await resolveDomainId(client, canonicalDomainName);
    const result = await client.deleteDomain(domainId);

    return {
      action: 'delete',
      cancelled: false,
      domain_name: canonicalDomainName,
      message: result.message
    };
  }

  async deleteRecord(
    domainName: string,
    options: DnsRecordDeleteOptions
  ): Promise<DnsRecordDeleteCommandResult> {
    if (!(options.force ?? false)) {
      assertCanDelete(
        this.dependencies.isInteractive,
        'Deleting a DNS record requires confirmation in an interactive terminal.',
        'Re-run the command with --force to skip the prompt.'
      );
    }

    const canonicalDomainName = canonicalizeDomainName(domainName);
    const recordType = assertSupportedRecordType(options.type);
    const recordNameInput = normalizeRecordNameInput(options.name, recordType);
    const recordName = canonicalizeRecordName(
      recordNameInput,
      canonicalDomainName
    );
    const recordValue = assertRequiredRawArgument(
      options.value,
      '--value',
      'Pass the exact value shown by e2ectl dns record list with --value.'
    );
    const client = await this.createClient(options);
    const { record } = await resolveExactRecordMatch(
      client,
      canonicalDomainName,
      recordName,
      recordType,
      recordValue,
      '--value'
    );

    if (!(options.force ?? false)) {
      const confirmed = await this.dependencies.confirm(
        `Delete DNS record ${record.type} ${record.name} ${record.value} from ${canonicalDomainName}? This cannot be undone.`
      );

      if (!confirmed) {
        return {
          action: 'record-delete',
          cancelled: true,
          domain_name: canonicalDomainName,
          record: {
            name: record.name,
            type: record.type,
            value: record.value
          }
        };
      }
    }

    const result = await client.deleteRecord(canonicalDomainName, {
      content: toDeleteRecordContent(recordType, record.value),
      record_name: record.name,
      record_type: record.type,
      zone_name: canonicalDomainName
    });
    const message = normalizeRecordDeleteMessage(result.message);

    return {
      action: 'record-delete',
      cancelled: false,
      domain_name: canonicalDomainName,
      ...(message === undefined ? {} : { message }),
      record: {
        name: record.name,
        type: record.type,
        value: record.value
      }
    };
  }

  async getDomain(
    domainName: string,
    options: DnsContextOptions
  ): Promise<DnsGetCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const client = await this.createClient(options);
    const result = await client.getDomain(canonicalDomainName);

    return {
      action: 'get',
      domain: normalizeDomainDetails(result)
    };
  }

  async getNameservers(
    domainName: string,
    options: DnsContextOptions
  ): Promise<DnsNameserversCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const client = await this.createClient(options);
    const [domain, diagnostic] = await Promise.all([
      client.getDomain(canonicalDomainName),
      client.verifyNameservers(canonicalDomainName)
    ]);

    return normalizeNameserverSummary(canonicalDomainName, domain, diagnostic);
  }

  async listDomains(options: DnsContextOptions): Promise<DnsListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      items: (await client.listDomains()).map((item) => normalizeListItem(item))
    };
  }

  async listRecords(
    domainName: string,
    options: DnsContextOptions
  ): Promise<DnsRecordListCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const client = await this.createClient(options);
    const domain = normalizeDomainDetails(
      await client.getDomain(canonicalDomainName)
    );

    return {
      action: 'record-list',
      domain_name: canonicalDomainName,
      items: domain.records
    };
  }

  async updateRecord(
    domainName: string,
    options: DnsRecordUpdateOptions
  ): Promise<DnsRecordUpdateCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const recordType = assertSupportedRecordType(options.type);
    const recordNameInput = normalizeRecordNameInput(options.name, recordType);
    const recordName = canonicalizeRecordName(
      recordNameInput,
      canonicalDomainName
    );
    const currentValue = assertRequiredRawArgument(
      options.currentValue,
      '--current-value',
      'Pass the exact current value shown by e2ectl dns record list with --current-value.'
    );
    const client = await this.createClient(options);
    const { record } = await resolveExactRecordMatch(
      client,
      canonicalDomainName,
      recordName,
      recordType,
      currentValue,
      '--current-value'
    );
    const recordValue = buildRecordValue(recordType, options);
    const recordTtl =
      parseOptionalPositiveInteger(
        options.ttl,
        '--ttl',
        'Pass a positive integer TTL like 300 with --ttl.'
      ) ?? assertExistingRecordTtl(record);
    const result = await client.updateRecord(canonicalDomainName, {
      new_record_content: recordValue.backendContent,
      new_record_ttl: recordTtl,
      old_record_content: toUpdateOldRecordContent(recordType, record.value),
      record_name: record.name,
      record_type: record.type,
      zone_name: canonicalDomainName
    });

    return {
      action: 'record-update',
      domain_name: canonicalDomainName,
      message: result.message,
      record: {
        current_value: record.value,
        name: record.name,
        new_value: recordValue.displayValue,
        ttl: recordTtl,
        type: record.type
      }
    };
  }

  async verifyNameservers(
    domainName: string,
    options: DnsContextOptions
  ): Promise<DnsVerifyNsCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const client = await this.createClient(options);

    return normalizeNameserverDiagnostic(
      canonicalDomainName,
      await client.verifyNameservers(canonicalDomainName)
    );
  }

  async verifyTtl(
    domainName: string,
    options: DnsContextOptions
  ): Promise<DnsVerifyTtlCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const client = await this.createClient(options);

    return normalizeTtlDiagnostic(
      canonicalDomainName,
      await client.verifyTtl(canonicalDomainName)
    );
  }

  async verifyValidity(
    domainName: string,
    options: DnsContextOptions
  ): Promise<DnsVerifyValidityCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);
    const client = await this.createClient(options);

    return normalizeValidityDiagnostic(
      canonicalDomainName,
      await client.verifyValidity(canonicalDomainName)
    );
  }

  private async createClient(options: DnsContextOptions): Promise<DnsClient> {
    const credentials = await resolveStoredCredentials(
      this.dependencies.store,
      options
    );

    return this.dependencies.createDnsClient(credentials);
  }
}

function assertCanDelete(
  isInteractive: boolean,
  message: string,
  suggestion: string
): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(message, {
    code: 'CONFIRMATION_REQUIRED',
    exitCode: EXIT_CODES.usage,
    suggestion
  });
}

function assertExistingRecordTtl(record: DnsFlattenedRecordItem): number {
  if (record.ttl !== null) {
    return record.ttl;
  }

  throw new CliError(
    `DNS record ${record.type} ${record.name} does not have a TTL to preserve automatically.`,
    {
      code: 'DNS_RECORD_TTL_MISSING',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --ttl <seconds>.'
    }
  );
}

function assertIpv4Address(ipAddress: string): string {
  const normalizedIpAddress = ipAddress.trim();

  if (isIPv4(normalizedIpAddress)) {
    return normalizedIpAddress;
  }

  throw new CliError('IP address must be a valid IPv4 address.', {
    code: 'INVALID_IP_ADDRESS',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass a valid IPv4 address like 164.52.198.54 with --ip.'
  });
}

function assertIpv6Address(ipAddress: string): string {
  const normalizedIpAddress = ipAddress.trim();

  if (isIPv6(normalizedIpAddress)) {
    return normalizedIpAddress;
  }

  throw new CliError('IP address must be a valid IPv6 address.', {
    code: 'INVALID_IP_ADDRESS',
    exitCode: EXIT_CODES.usage,
    suggestion:
      'Pass a valid IPv6 address like 2001:db8::1 with --value for AAAA records.'
  });
}

function assertPositiveInteger(
  value: string,
  flagName: string,
  suggestion: string,
  options: {
    allowZero?: boolean;
    max?: number;
  } = {}
): number {
  const trimmedValue = value.trim();

  if (!/^\d+$/.test(trimmedValue)) {
    throw new CliError(`${flagName} must be a whole number.`, {
      code: 'INVALID_NUMERIC_ARGUMENT',
      exitCode: EXIT_CODES.usage,
      suggestion
    });
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);
  const minimum = options.allowZero ? 0 : 1;

  if (!Number.isSafeInteger(parsedValue) || parsedValue < minimum) {
    throw new CliError(`${flagName} must be ${minimum} or greater.`, {
      code: 'INVALID_NUMERIC_ARGUMENT',
      exitCode: EXIT_CODES.usage,
      suggestion
    });
  }

  if (options.max !== undefined && parsedValue > options.max) {
    throw new CliError(`${flagName} must be ${options.max} or lower.`, {
      code: 'INVALID_NUMERIC_ARGUMENT',
      exitCode: EXIT_CODES.usage,
      suggestion
    });
  }

  return parsedValue;
}

function assertRequiredRawArgument(
  value: string | undefined,
  flagName: string,
  suggestion: string
): string {
  if (value !== undefined && value.length > 0) {
    return value;
  }

  throw new CliError(`${flagName} is required for this record type.`, {
    code: 'MISSING_RECORD_ARGUMENT',
    exitCode: EXIT_CODES.usage,
    suggestion
  });
}

function assertRequiredTrimmedArgument(
  value: string | undefined,
  flagName: string,
  suggestion: string
): string {
  const rawValue = assertRequiredRawArgument(value, flagName, suggestion);
  const trimmedValue = rawValue.trim();

  if (trimmedValue.length > 0) {
    return trimmedValue;
  }

  throw new CliError(`${flagName} cannot be empty.`, {
    code: 'MISSING_RECORD_ARGUMENT',
    exitCode: EXIT_CODES.usage,
    suggestion
  });
}

function assertSupportedRecordType(type: string): SupportedDnsRecordType {
  const normalizedType = type.trim().toUpperCase();

  if (
    SUPPORTED_RECORD_TYPES.includes(normalizedType as SupportedDnsRecordType)
  ) {
    return normalizedType as SupportedDnsRecordType;
  }

  throw new CliError(
    `Record type must be one of ${SUPPORTED_RECORD_TYPES.join(', ')}.`,
    {
      code: 'INVALID_RECORD_TYPE',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass one of A, AAAA, CNAME, MX, TXT, or SRV with --type.'
    }
  );
}

function assertValidDnsHostName(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName === '' || trimmedName === '@') {
    return trimmedName;
  }

  if (/^\./.test(trimmedName)) {
    throw new CliError('Hostname cannot start with a period.', {
      code: 'INVALID_RECORD_NAME',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass @ for apex, a relative host like api, or an FQDN.'
    });
  }

  if (!/^[A-Za-z0-9.-]+$/.test(trimmedName)) {
    throw new CliError(
      'Hostname can only contain letters, digits, periods, and hyphens.',
      {
        code: 'INVALID_RECORD_NAME',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass @ for apex, a relative host like api, or an FQDN.'
      }
    );
  }

  if (
    !/^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.?)+\.?$/.test(trimmedName)
  ) {
    throw new CliError(
      'Hostname labels cannot start or end with a hyphen and must stay within DNS label length limits.',
      {
        code: 'INVALID_RECORD_NAME',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass @ for apex, a relative host like api, or an FQDN.'
      }
    );
  }

  return trimmedName;
}

function assertValidFlexibleDnsName(name: string, flagName: string): string {
  const trimmedName = name.trim();

  if (trimmedName === '' || trimmedName === '@') {
    return trimmedName;
  }

  if (!/^[A-Za-z0-9._*-]+\.?$/.test(trimmedName)) {
    throw new CliError(
      `${flagName} can only contain letters, digits, periods, hyphens, underscores, and asterisks.`,
      {
        code: 'INVALID_RECORD_NAME',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass @ for apex, a relative host like api, or an FQDN.'
      }
    );
  }

  return trimmedName;
}

function buildRecordValue(
  recordType: SupportedDnsRecordType,
  options: DnsRecordValueOptions
): BuiltDnsRecordValue {
  switch (recordType) {
    case 'A': {
      const value = assertIpv4Address(
        assertRequiredTrimmedArgument(
          options.value,
          '--value',
          'Pass a valid IPv4 address like 164.52.198.54 with --value.'
        )
      );
      return {
        backendContent: value,
        displayValue: value
      };
    }
    case 'AAAA': {
      const value = assertIpv6Address(
        assertRequiredTrimmedArgument(
          options.value,
          '--value',
          'Pass a valid IPv6 address like 2001:db8::1 with --value.'
        )
      );
      return {
        backendContent: value,
        displayValue: value
      };
    }
    case 'CNAME': {
      const value = normalizeAbsoluteTarget(
        options.value,
        '--value',
        'Pass a hostname target like app.example.net with --value.'
      );
      return {
        backendContent: value,
        displayValue: value
      };
    }
    case 'MX': {
      const priority = assertPositiveInteger(
        assertRequiredTrimmedArgument(
          options.priority,
          '--priority',
          'Pass an MX priority like 10 with --priority.'
        ),
        '--priority',
        'Pass an MX priority like 10 with --priority.',
        {
          allowZero: true
        }
      );
      const exchange = normalizeAbsoluteTarget(
        options.exchange,
        '--exchange',
        'Pass an MX exchange like mail.example.net with --exchange.'
      );
      const value = `${priority} ${exchange}`;
      return {
        backendContent: value,
        displayValue: value
      };
    }
    case 'TXT': {
      const rawValue = assertRequiredRawArgument(
        options.value,
        '--value',
        'Pass the TXT text with --value. The CLI handles quoting internally.'
      );
      const displayValue = stripEnclosingDoubleQuotes(rawValue);
      return {
        backendContent: quoteTxtValue(displayValue),
        displayValue
      };
    }
    case 'SRV': {
      const priority = assertPositiveInteger(
        assertRequiredTrimmedArgument(
          options.priority,
          '--priority',
          'Pass an SRV priority like 10 with --priority.'
        ),
        '--priority',
        'Pass an SRV priority like 10 with --priority.',
        {
          allowZero: true
        }
      );
      const weight = assertPositiveInteger(
        assertRequiredTrimmedArgument(
          options.weight,
          '--weight',
          'Pass an SRV weight like 5 with --weight.'
        ),
        '--weight',
        'Pass an SRV weight like 5 with --weight.',
        {
          allowZero: true
        }
      );
      const port = assertPositiveInteger(
        assertRequiredTrimmedArgument(
          options.port,
          '--port',
          'Pass an SRV port like 443 with --port.'
        ),
        '--port',
        'Pass an SRV port like 443 with --port.',
        {
          allowZero: true,
          max: 65_535
        }
      );
      const target = normalizeAbsoluteTarget(
        options.target,
        '--target',
        'Pass an SRV target like service.example.net with --target.'
      );
      const value = `${priority} ${weight} ${port} ${target}`;
      return {
        backendContent: value,
        displayValue: value
      };
    }
  }
}

function canonicalizeDomainName(domainName: string): string {
  return canonicalizeFqdn(normalizeRequestedDomainName(domainName));
}

function canonicalizeRecordName(recordName: string, zoneName: string): string {
  if (recordName === '' || recordName === '@') {
    return zoneName;
  }

  if (recordName.endsWith('.')) {
    return canonicalizeFqdn(recordName);
  }

  return canonicalizeFqdn(`${recordName}.${zoneName}`);
}

function canonicalizeFqdn(value: string): string {
  return `${value.trim().replace(/\.+$/, '').toLowerCase()}.`;
}

function normalizeStoredFqdn(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? '' : canonicalizeFqdn(trimmedValue);
}

function normalizeRequestedDomainName(domainName: string): string {
  const trimmedDomainName = domainName.trim();
  const withoutTrailingDots = trimmedDomainName.replace(/\.+$/, '');

  if (withoutTrailingDots.length > 0) {
    return trimmedDomainName;
  }

  throw new CliError('Domain name cannot be empty.', {
    code: 'INVALID_DOMAIN_NAME',
    exitCode: EXIT_CODES.usage,
    suggestion: 'Pass a domain name like example.com as the first argument.'
  });
}

function normalizeRecordNameInput(
  recordName: string | undefined,
  recordType: SupportedDnsRecordType
): string {
  const requestedRecordName = recordName ?? '@';

  if (recordType === 'A' || recordType === 'AAAA') {
    return assertValidDnsHostName(requestedRecordName);
  }

  return assertValidFlexibleDnsName(requestedRecordName, '--name');
}

function normalizeAbsoluteTarget(
  target: string | undefined,
  flagName: string,
  suggestion: string
): string {
  const normalizedTarget = assertValidFlexibleDnsName(
    assertRequiredTrimmedArgument(target, flagName, suggestion),
    flagName
  );

  if (normalizedTarget === '' || normalizedTarget === '@') {
    throw new CliError(`${flagName} must be a hostname, not apex shorthand.`, {
      code: 'INVALID_RECORD_VALUE',
      exitCode: EXIT_CODES.usage,
      suggestion
    });
  }

  return canonicalizeFqdn(normalizedTarget);
}

function normalizeDomainDetails(
  result: DnsDetailsResponse
): DnsDomainDetailsItem {
  const rrsets = normalizeRrsets(result.domain.rrsets ?? []);

  return {
    domain_name: canonicalizeFqdn(result.domain_name),
    domain_ttl: result.DOMAIN_TTL ?? null,
    ip_address: result.domain_ip,
    nameservers: deriveNameservers(rrsets),
    records: flattenForwardRecords(rrsets),
    rrsets,
    soa: deriveSoa(rrsets)
  };
}

function normalizeListItem(item: DnsListEntry): DnsListItem {
  return {
    created_at: item.created_at ?? null,
    deleted: item.deleted ?? false,
    domain_name: canonicalizeStoredDomainName(item.domain_name),
    id: item.id,
    ip_address: item.domain_ip,
    validity: item.validity ?? null
  };
}

function normalizeNameserverDiagnostic(
  domainName: string,
  result: DnsNameserverDiagnosticResponse
): DnsVerifyNsCommandResult {
  return {
    action: 'verify-ns',
    authority: result.data?.authority ?? null,
    domain_name: domainName,
    e2e_nameservers: normalizeNameserverList(
      result.data?.e2e_nameservers ?? []
    ),
    global_nameservers: normalizeNameserverList(
      result.data?.gl_nameservers ?? []
    ),
    message: result.message,
    problem: result.data?.problem ?? null,
    status: result.status
  };
}

function normalizeNameserverSummary(
  domainName: string,
  domainResult: DnsDetailsResponse,
  diagnosticResult: DnsNameserverDiagnosticResponse
): DnsNameserversCommandResult {
  const domain = normalizeDomainDetails(domainResult);
  const delegatedNameservers = normalizeNameserverList(
    diagnosticResult.data?.gl_nameservers ?? []
  );

  return {
    action: 'nameservers',
    authority_match:
      diagnosticResult.data?.authority ??
      nameserverListsMatch(domain.nameservers, delegatedNameservers),
    configured_nameservers: domain.nameservers,
    delegated_nameservers: delegatedNameservers,
    domain_name: domainName,
    message: diagnosticResult.message,
    problem: diagnosticResult.data?.problem ?? null,
    status: diagnosticResult.status
  };
}

function normalizeRrsetRecord(record: DnsZoneRecord): DnsZoneRecordItem {
  return {
    content: record.content ?? '',
    disabled: record.disabled ?? false
  };
}

function normalizeRrsets(rrsets: DnsZoneRrset[]): DnsZoneRrsetItem[] {
  return rrsets.map((rrset) => ({
    name: normalizeStoredFqdn(rrset.name),
    records: (rrset.records ?? []).map((record) =>
      normalizeRrsetRecord(record)
    ),
    ttl: rrset.ttl ?? null,
    type: (rrset.type ?? '').toUpperCase()
  }));
}

function flattenForwardRecords(
  rrsets: DnsZoneRrsetItem[]
): DnsFlattenedRecordItem[] {
  const items = rrsets
    .filter((rrset) => !HIDDEN_RRSET_TYPES.has(rrset.type))
    .flatMap((rrset) =>
      rrset.records.map((record) => ({
        disabled: record.disabled,
        name: rrset.name,
        ttl: rrset.ttl,
        type: rrset.type,
        value: toDisplayedRecordValue(rrset.type, record.content)
      }))
    );

  return sortDnsRecordItems(items);
}

function deriveNameservers(rrsets: DnsZoneRrsetItem[]): string[] {
  return normalizeNameserverList(
    rrsets
      .filter((rrset) => rrset.type === 'NS')
      .flatMap((rrset) => rrset.records.map((record) => record.content))
  );
}

function deriveSoa(rrsets: DnsZoneRrsetItem[]): DnsDerivedSoaItem | null {
  const soaRrset = rrsets.find((rrset) => rrset.type === 'SOA');

  if (soaRrset === undefined) {
    return null;
  }

  return {
    name: soaRrset.name,
    ttl: soaRrset.ttl,
    values: soaRrset.records.map((record) => record.content)
  };
}

function normalizeNameserverList(values: string[]): string[] {
  return uniqueStrings(
    values
      .map((value) => normalizeStoredFqdn(value))
      .filter((value) => value.length > 0)
      .sort((left, right) => left.localeCompare(right))
  );
}

function nameserverListsMatch(
  configuredNameservers: string[],
  delegatedNameservers: string[]
): boolean {
  if (configuredNameservers.length !== delegatedNameservers.length) {
    return false;
  }

  return configuredNameservers.every(
    (configuredNameserver, index) =>
      configuredNameserver === delegatedNameservers[index]
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeTtlDiagnostic(
  domainName: string,
  result: DnsTtlDiagnosticResponse
): DnsVerifyTtlCommandResult {
  const lowTtlRecords = normalizeRrsets(result.data ?? []);

  return {
    action: 'verify-ttl',
    domain_name: domainName,
    low_ttl_count: lowTtlRecords.length,
    low_ttl_records: lowTtlRecords,
    message: result.message,
    status: result.status
  };
}

function normalizeValidityDiagnostic(
  domainName: string,
  result: DnsValidityDiagnosticResponse
): DnsVerifyValidityCommandResult {
  return {
    action: 'verify-validity',
    domain_name: domainName,
    expiry_date: result.data?.expiry_date ?? null,
    message: result.message,
    problem: result.data?.problem ?? null,
    status: result.status,
    validity_ok: result.data?.validity ?? null
  };
}

async function resolveDomainId(
  client: DnsClient,
  canonicalDomainName: string
): Promise<number> {
  const domains = await client.listDomains();
  const matchedDomain = domains.find(
    (candidate) =>
      canonicalizeStoredDomainName(candidate.domain_name) ===
      canonicalDomainName
  );

  if (matchedDomain !== undefined) {
    return matchedDomain.id;
  }

  throw new CliError(`DNS domain ${canonicalDomainName} was not found.`, {
    code: 'DNS_DOMAIN_NOT_FOUND',
    exitCode: EXIT_CODES.network,
    suggestion: `Run ${formatCliCommand('dns list')} to inspect available DNS domains, then retry with an exact domain name.`
  });
}

async function resolveExactRecordMatch(
  client: DnsClient,
  canonicalDomainName: string,
  recordName: string,
  recordType: SupportedDnsRecordType,
  recordValue: string,
  flagName: '--current-value' | '--value'
): Promise<{
  domain: DnsDomainDetailsItem;
  record: DnsFlattenedRecordItem;
}> {
  const domain = normalizeDomainDetails(
    await client.getDomain(canonicalDomainName)
  );
  const record = domain.records.find(
    (candidate) =>
      candidate.name === recordName &&
      candidate.type === recordType &&
      candidate.value === recordValue
  );

  if (record !== undefined) {
    return {
      domain,
      record
    };
  }

  throw new CliError(
    `DNS record ${recordType} ${recordName} with value ${recordValue} was not found in ${canonicalDomainName}.`,
    {
      code: 'DNS_RECORD_NOT_FOUND',
      exitCode: EXIT_CODES.usage,
      suggestion: `Run ${formatCliCommand(`dns record list ${canonicalDomainName}`)} and retry with the exact current value via ${flagName}.`
    }
  );
}

function sortDnsRecordItems(
  items: DnsFlattenedRecordItem[]
): DnsFlattenedRecordItem[] {
  return [...items].sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.name.localeCompare(right.name) ||
      left.value.localeCompare(right.value)
  );
}

function stripEnclosingDoubleQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function quoteTxtValue(value: string): string {
  return `"${stripEnclosingDoubleQuotes(value)}"`;
}

function toDeleteRecordContent(
  recordType: SupportedDnsRecordType,
  value: string
): string {
  return recordType === 'TXT' ? stripEnclosingDoubleQuotes(value) : value;
}

function toDisplayedRecordValue(recordType: string, value: string): string {
  return recordType === 'TXT' ? stripEnclosingDoubleQuotes(value) : value;
}

function toUpdateOldRecordContent(
  recordType: SupportedDnsRecordType,
  value: string
): string {
  return recordType === 'TXT' ? quoteTxtValue(value) : value;
}

function normalizeRecordDeleteMessage(
  message: string | undefined
): string | undefined {
  if (message === undefined) {
    return undefined;
  }

  return /reverse dns/i.test(message)
    ? 'The record was deleted successfully!'
    : message;
}

function parseOptionalPositiveInteger(
  value: string | undefined,
  flagName: string,
  suggestion: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return assertPositiveInteger(value, flagName, suggestion);
}

function canonicalizeStoredDomainName(domainName: string): string {
  return canonicalizeFqdn(domainName);
}
