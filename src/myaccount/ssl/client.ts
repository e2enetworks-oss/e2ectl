import type { ApiEnvelope, ApiTransport } from '../../http/index.js';
import type { SslCertificateSummary } from './types/index.js';

const SSL_CERTIFICATES_PATH = '/ssl/import-certificate/';

export interface SslClient {
  listCertificates(): Promise<SslCertificateSummary[]>;
}

export class SslApiClient implements SslClient {
  constructor(private readonly transport: ApiTransport) {}

  async listCertificates(): Promise<SslCertificateSummary[]> {
    const response = await this.transport.get<
      ApiEnvelope<SslCertificateSummary[]>
    >(SSL_CERTIFICATES_PATH);

    return response.data;
  }
}
