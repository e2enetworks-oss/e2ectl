import { isIPv4 } from 'node:net';

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

export interface DnsListCommandResult {
  action: 'list';
  items: DnsListItem[];
}

export interface DnsGetCommandResult {
  action: 'get';
  domain: {
    domain_name: string;
    domain_ttl: number | null;
    ip_address: string;
    rrsets: DnsZoneRrsetItem[];
  };
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

export type DnsCommandResult =
  | DnsCreateCommandResult
  | DnsDeleteCommandResult
  | DnsGetCommandResult
  | DnsListCommandResult
  | DnsVerifyNsCommandResult
  | DnsVerifyTtlCommandResult
  | DnsVerifyValidityCommandResult;

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

  async deleteDomain(
    domainName: string,
    options: DnsDeleteOptions
  ): Promise<DnsDeleteCommandResult> {
    const canonicalDomainName = canonicalizeDomainName(domainName);

    if (!(options.force ?? false)) {
      assertCanDelete(this.dependencies.isInteractive);
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

  async listDomains(options: DnsContextOptions): Promise<DnsListCommandResult> {
    const client = await this.createClient(options);

    return {
      action: 'list',
      items: (await client.listDomains()).map((item) => normalizeListItem(item))
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

function assertCanDelete(isInteractive: boolean): void {
  if (isInteractive) {
    return;
  }

  throw new CliError(
    'Deleting a DNS domain requires confirmation in an interactive terminal.',
    {
      code: 'CONFIRMATION_REQUIRED',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Re-run the command with --force to skip the prompt.'
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

function canonicalizeDomainName(domainName: string): string {
  const trimmedDomainName = normalizeRequestedDomainName(domainName);
  const withoutTrailingDots = trimmedDomainName.replace(/\.+$/, '');

  return `${withoutTrailingDots.toLowerCase()}.`;
}

function normalizeDomainDetails(result: DnsDetailsResponse): {
  domain_name: string;
  domain_ttl: number | null;
  ip_address: string;
  rrsets: DnsZoneRrsetItem[];
} {
  return {
    domain_name: canonicalizeStoredDomainName(result.domain_name),
    domain_ttl: result.DOMAIN_TTL ?? null,
    ip_address: result.domain_ip,
    rrsets: normalizeRrsets(result.domain.rrsets ?? [])
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
    e2e_nameservers: [...(result.data?.e2e_nameservers ?? [])],
    global_nameservers: [...(result.data?.gl_nameservers ?? [])],
    message: result.message,
    problem: result.data?.problem ?? null,
    status: result.status
  };
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

function normalizeRrsetRecord(record: DnsZoneRecord): DnsZoneRecordItem {
  return {
    content: record.content ?? '',
    disabled: record.disabled ?? false
  };
}

function normalizeRrsets(rrsets: DnsZoneRrset[]): DnsZoneRrsetItem[] {
  return rrsets.map((rrset) => ({
    name: rrset.name ?? '',
    records: (rrset.records ?? []).map((record) =>
      normalizeRrsetRecord(record)
    ),
    ttl: rrset.ttl ?? null,
    type: rrset.type ?? ''
  }));
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

function canonicalizeStoredDomainName(domainName: string): string {
  return `${domainName.trim().replace(/\.+$/, '').toLowerCase()}.`;
}
