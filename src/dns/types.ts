export interface DnsListEntry {
  created_at?: string | null;
  deleted?: boolean;
  domain_ip: string;
  domain_name: string;
  id: number;
  validity?: string | null;
}

export interface DnsCreateRequest {
  domain_name: string;
  ip_addr: string;
}

export interface DnsCreateResponse {
  id: number;
  label_id?: number | null;
  message: string;
  resource_type?: string | null;
  status: boolean;
}

export interface DnsDeleteResponse {
  message: string;
  status: boolean;
}

export interface DnsZoneRecord {
  content?: string;
  disabled?: boolean;
}

export interface DnsZoneRrset {
  name?: string;
  records?: DnsZoneRecord[];
  ttl?: number;
  type?: string;
}

export interface DnsZoneDetails {
  rrsets?: DnsZoneRrset[];
}

export interface DnsDetailsResponse {
  DOMAIN_TTL?: number;
  domain: DnsZoneDetails;
  domain_ip: string;
  domain_name: string;
}

export interface DnsNameserverDiagnosticData {
  authority?: boolean;
  e2e_nameservers?: string[];
  gl_nameservers?: string[];
  problem?: number;
}

export interface DnsNameserverDiagnosticResponse {
  data?: DnsNameserverDiagnosticData;
  message: string;
  status: boolean;
}

export interface DnsValidityDiagnosticData {
  expiry_date?: string;
  problem?: number;
  validity?: boolean;
}

export interface DnsValidityDiagnosticResponse {
  data?: DnsValidityDiagnosticData;
  message: string;
  status: boolean;
}

export interface DnsTtlDiagnosticResponse {
  data?: DnsZoneRrset[];
  message: string;
  status: boolean;
}
