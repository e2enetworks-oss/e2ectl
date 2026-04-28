import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { SslApiClient } from '../../../src/ssl/client.js';
import type { SslCertificateSummary } from '../../../src/ssl/types.js';

class StubTransport implements MyAccountTransport {
  readonly getMock = vi.fn();
  readonly deleteMock = vi.fn();
  readonly postMock = vi.fn();
  readonly requestMock = vi.fn();

  get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.getMock(path, options) as Promise<TResponse>;
  }

  delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.deleteMock(path, options) as Promise<TResponse>;
  }

  post<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.postMock(path, options) as Promise<TResponse>;
  }

  request<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse>
  ): Promise<TResponse> {
    return this.requestMock(options) as Promise<TResponse>;
  }
}

function envelope<T>(data: T): ApiEnvelope<T> {
  return { code: 200, data, errors: {}, message: 'OK' };
}

describe('SslApiClient', () => {
  it('lists SSL certificates via GET /ssl/import-certificate/', async () => {
    const transport = new StubTransport();
    const client = new SslApiClient(transport);
    const certs: SslCertificateSummary[] = [
      {
        id: 1772,
        ssl_cert_name: 'hiteshsadhwani.xyz domain certificate',
        ssl_domain_name: 'hiteshsadhwani.xyz',
        ssl_certificate_type: 'Imported',
        ssl_certificate_state: 'NA',
        expiry_date: '30/Mar/2026 12:03 PM',
        imported_date: '30/Dec/2025 01:07 PM',
        issuer_name: "Let's Encrypt"
      }
    ];

    transport.getMock.mockResolvedValue(envelope(certs));

    const result = await client.listCertificates();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ssl/import-certificate/',
      undefined
    );
    expect(result).toEqual(certs);
  });

  it('returns an empty array when no certificates exist', async () => {
    const transport = new StubTransport();
    const client = new SslApiClient(transport);

    transport.getMock.mockResolvedValue(envelope([]));

    const result = await client.listCertificates();

    expect(result).toEqual([]);
  });
});
