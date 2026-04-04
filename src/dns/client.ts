import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  DnsCreateRequest,
  DnsCreateResponse,
  DnsDeleteResponse,
  DnsDetailsResponse,
  DnsListEntry,
  DnsNameserverDiagnosticResponse,
  DnsRecordCreateRequest,
  DnsRecordDeleteRequest,
  DnsRecordMutationResponse,
  DnsRecordUpdateRequest,
  DnsTtlDiagnosticResponse,
  DnsValidityDiagnosticResponse
} from './types.js';

const FORWARD_DNS_PATH = '/e2e_dns/forward/';
const DNS_DIAGNOSTICS_PATH = '/e2e_dns/diagnostics/';

export interface DnsClient {
  createDomain(body: DnsCreateRequest): Promise<DnsCreateResponse>;
  createRecord(
    domainName: string,
    body: DnsRecordCreateRequest
  ): Promise<DnsRecordMutationResponse>;
  deleteDomain(domainId: number): Promise<DnsDeleteResponse>;
  deleteRecord(
    domainName: string,
    body: DnsRecordDeleteRequest
  ): Promise<DnsRecordMutationResponse>;
  getDomain(domainName: string): Promise<DnsDetailsResponse>;
  listDomains(): Promise<DnsListEntry[]>;
  updateRecord(
    domainName: string,
    body: DnsRecordUpdateRequest
  ): Promise<DnsRecordMutationResponse>;
  verifyNameservers(
    domainName: string
  ): Promise<DnsNameserverDiagnosticResponse>;
  verifyTtl(domainName: string): Promise<DnsTtlDiagnosticResponse>;
  verifyValidity(domainName: string): Promise<DnsValidityDiagnosticResponse>;
}

export class DnsApiClient implements DnsClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createDomain(body: DnsCreateRequest): Promise<DnsCreateResponse> {
    const response = await this.transport.post<ApiEnvelope<DnsCreateResponse>>(
      FORWARD_DNS_PATH,
      {
        body
      }
    );

    return response.data;
  }

  async createRecord(
    domainName: string,
    body: DnsRecordCreateRequest
  ): Promise<DnsRecordMutationResponse> {
    const response = await this.transport.post<
      ApiEnvelope<DnsRecordMutationResponse>
    >(buildDomainPath(domainName), {
      body
    });

    return response.data;
  }

  async deleteDomain(domainId: number): Promise<DnsDeleteResponse> {
    const response = await this.transport.delete<
      ApiEnvelope<DnsDeleteResponse>
    >(FORWARD_DNS_PATH, {
      query: {
        domain_id: String(domainId)
      }
    });

    return response.data;
  }

  async deleteRecord(
    domainName: string,
    body: DnsRecordDeleteRequest
  ): Promise<DnsRecordMutationResponse> {
    const response = await this.transport.delete<
      ApiEnvelope<DnsRecordMutationResponse>
    >(buildDomainPath(domainName), {
      body
    });

    return response.data;
  }

  async getDomain(domainName: string): Promise<DnsDetailsResponse> {
    const response = await this.transport.get<ApiEnvelope<DnsDetailsResponse>>(
      buildDomainPath(domainName)
    );

    return response.data;
  }

  async listDomains(): Promise<DnsListEntry[]> {
    const response =
      await this.transport.get<ApiEnvelope<DnsListEntry[]>>(FORWARD_DNS_PATH);

    return response.data;
  }

  async updateRecord(
    domainName: string,
    body: DnsRecordUpdateRequest
  ): Promise<DnsRecordMutationResponse> {
    const response = await this.transport.request<
      ApiEnvelope<DnsRecordMutationResponse>
    >({
      body,
      method: 'PUT',
      path: buildDomainPath(domainName)
    });

    return response.data;
  }

  async verifyNameservers(
    domainName: string
  ): Promise<DnsNameserverDiagnosticResponse> {
    const response = await this.transport.get<
      ApiEnvelope<DnsNameserverDiagnosticResponse>
    >(buildVerifyNsPath(domainName));

    return response.data;
  }

  async verifyTtl(domainName: string): Promise<DnsTtlDiagnosticResponse> {
    const response = await this.transport.get<
      ApiEnvelope<DnsTtlDiagnosticResponse>
    >(buildVerifyTtlPath(domainName));

    return response.data;
  }

  async verifyValidity(
    domainName: string
  ): Promise<DnsValidityDiagnosticResponse> {
    const response = await this.transport.get<
      ApiEnvelope<DnsValidityDiagnosticResponse>
    >(buildVerifyValidityPath(domainName));

    return response.data;
  }
}

function buildDomainPath(domainName: string): string {
  return `${FORWARD_DNS_PATH}${encodeURIComponent(domainName)}/`;
}

function buildVerifyNsPath(domainName: string): string {
  return `${DNS_DIAGNOSTICS_PATH}verify_ns/${encodeURIComponent(domainName)}/`;
}

function buildVerifyTtlPath(domainName: string): string {
  return `${DNS_DIAGNOSTICS_PATH}verify_ttl/${encodeURIComponent(domainName)}/`;
}

function buildVerifyValidityPath(domainName: string): string {
  return `${DNS_DIAGNOSTICS_PATH}verify_validity/${encodeURIComponent(domainName)}/`;
}
