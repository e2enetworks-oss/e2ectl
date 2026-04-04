export { buildDnsCommand } from './command.js';
export { DnsApiClient, type DnsClient } from './client.js';
export type {
  DnsCreateRequest,
  DnsCreateResponse,
  DnsDeleteResponse,
  DnsDetailsResponse,
  DnsListEntry,
  DnsNameserverDiagnosticData,
  DnsNameserverDiagnosticResponse,
  DnsRecordCreateRequest,
  DnsRecordDeleteRequest,
  DnsRecordMutationResponse,
  DnsRecordUpdateRequest,
  DnsTtlDiagnosticResponse,
  DnsValidityDiagnosticData,
  DnsValidityDiagnosticResponse,
  DnsZoneDetails,
  DnsZoneRecord,
  DnsZoneRrset
} from './types.js';
