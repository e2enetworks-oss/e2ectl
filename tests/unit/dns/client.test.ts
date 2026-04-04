import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { DnsApiClient } from '../../../src/dns/client.js';
import type {
  DnsCreateRequest,
  DnsRecordCreateRequest,
  DnsRecordDeleteRequest,
  DnsRecordUpdateRequest
} from '../../../src/dns/index.js';

class StubTransport implements MyAccountTransport {
  readonly deleteMock = vi.fn();
  readonly getMock = vi.fn();
  readonly postMock = vi.fn();
  readonly requestMock = vi.fn();

  delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.deleteMock(path, options) as Promise<TResponse>;
  }

  get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.getMock(path, options) as Promise<TResponse>;
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

describe('DnsApiClient', () => {
  it('creates domains through the forward DNS collection path', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);
    const request: DnsCreateRequest = {
      domain_name: 'example.com.',
      ip_addr: '1.1.1.1'
    };

    transport.postMock.mockResolvedValue(
      envelope({
        id: 10279,
        message: 'The domain was created successfully!',
        status: true
      })
    );

    const result = await client.createDomain(request);

    expect(transport.postMock).toHaveBeenCalledWith('/e2e_dns/forward/', {
      body: request
    });
    expect(result).toEqual({
      id: 10279,
      message: 'The domain was created successfully!',
      status: true
    });
  });

  it('creates forward records through the detail path', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);
    const request: DnsRecordCreateRequest = {
      content: '10 mail.example.net.',
      record_name: 'example.com.',
      record_type: 'MX',
      record_ttl: 600,
      zone_name: 'example.com.'
    };

    transport.postMock.mockResolvedValue(
      envelope({
        message: 'The record was added successfully!',
        status: true
      })
    );

    const result = await client.createRecord('example.com.', request);

    expect(transport.postMock).toHaveBeenCalledWith(
      '/e2e_dns/forward/example.com./',
      {
        body: request
      }
    );
    expect(result).toEqual({
      message: 'The record was added successfully!',
      status: true
    });
  });

  it('lists domains through the forward DNS collection path', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope([
        {
          created_at: '2024-11-04T09:01:30.545588Z',
          deleted: false,
          domain_ip: '1.1.1.1',
          domain_name: 'example.com.',
          id: 10280,
          validity: null
        }
      ])
    );

    const result = await client.listDomains();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/e2e_dns/forward/',
      undefined
    );
    expect(result[0]?.domain_name).toBe('example.com.');
  });

  it('gets domain details through the dedicated detail path', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        DOMAIN_TTL: 86400,
        domain: {
          rrsets: []
        },
        domain_ip: '1.1.1.1',
        domain_name: 'example.com.'
      })
    );

    const result = await client.getDomain('example.com.');

    expect(transport.getMock).toHaveBeenCalledWith(
      '/e2e_dns/forward/example.com./',
      undefined
    );
    expect(result.domain_name).toBe('example.com.');
  });

  it('deletes domains through the collection path using the domain_id query', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);

    transport.deleteMock.mockResolvedValue(
      envelope({
        message: 'The domain was deleted successfully',
        status: true
      })
    );

    const result = await client.deleteDomain(10280);

    expect(transport.deleteMock).toHaveBeenCalledWith('/e2e_dns/forward/', {
      query: {
        domain_id: '10280'
      }
    });
    expect(result).toEqual({
      message: 'The domain was deleted successfully',
      status: true
    });
  });

  it('deletes forward records through the detail path with a request body', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);
    const request: DnsRecordDeleteRequest = {
      content: '1.1.1.1',
      record_name: 'example.com.',
      record_type: 'A',
      zone_name: 'example.com.'
    };

    transport.deleteMock.mockResolvedValue(
      envelope({
        message: 'The record was deleted successfully!',
        status: true
      })
    );

    const result = await client.deleteRecord('example.com.', request);

    expect(transport.deleteMock).toHaveBeenCalledWith(
      '/e2e_dns/forward/example.com./',
      {
        body: request
      }
    );
    expect(result).toEqual({
      message: 'The record was deleted successfully!',
      status: true
    });
  });

  it('updates forward records through the detail path with PUT', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);
    const request: DnsRecordUpdateRequest = {
      new_record_content: '203.0.113.10',
      new_record_ttl: 600,
      old_record_content: '1.1.1.1',
      record_name: 'example.com.',
      record_type: 'A',
      zone_name: 'example.com.'
    };

    transport.requestMock.mockResolvedValue(
      envelope({
        message: 'The record was updated successfully!',
        status: true
      })
    );

    const result = await client.updateRecord('example.com.', request);

    expect(transport.requestMock).toHaveBeenCalledWith({
      body: request,
      method: 'PUT',
      path: '/e2e_dns/forward/example.com./'
    });
    expect(result).toEqual({
      message: 'The record was updated successfully!',
      status: true
    });
  });

  it('reads nameserver diagnostics from the verify_ns endpoint', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        data: {
          authority: false,
          e2e_nameservers: ['ns50.e2enetworks.net.in.'],
          gl_nameservers: ['ns1.example.net.'],
          problem: 1
        },
        message: 'Your nameservers are not setup correctly',
        status: true
      })
    );

    const result = await client.verifyNameservers('example.com.');

    expect(transport.getMock).toHaveBeenCalledWith(
      '/e2e_dns/diagnostics/verify_ns/example.com./',
      undefined
    );
    expect(result.data?.gl_nameservers).toEqual(['ns1.example.net.']);
  });

  it('reads validity diagnostics from the verify_validity endpoint', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        data: {
          expiry_date: '2026-05-01',
          problem: 0,
          validity: true
        },
        message: 'Valid for 30 days',
        status: true
      })
    );

    const result = await client.verifyValidity('example.com.');

    expect(transport.getMock).toHaveBeenCalledWith(
      '/e2e_dns/diagnostics/verify_validity/example.com./',
      undefined
    );
    expect(result.data?.validity).toBe(true);
  });

  it('reads TTL diagnostics as a flat rrset array', async () => {
    const transport = new StubTransport();
    const client = new DnsApiClient(transport);

    transport.getMock.mockResolvedValue(
      envelope({
        data: [
          {
            name: 'www.example.com.',
            records: [
              {
                content: '1.1.1.1',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'A'
          }
        ],
        message: 'Error verifying TTL for your DNS records.',
        status: true
      })
    );

    const result = await client.verifyTtl('example.com.');

    expect(transport.getMock).toHaveBeenCalledWith(
      '/e2e_dns/diagnostics/verify_ttl/example.com./',
      undefined
    );
    expect(result.data?.[0]).toMatchObject({
      name: 'www.example.com.',
      ttl: 300,
      type: 'A'
    });
  });
});

function envelope<TData>(
  data: TData,
  overrides: Partial<ApiEnvelope<TData>> = {}
): ApiEnvelope<TData> {
  return {
    code: overrides.code ?? 200,
    data,
    errors: overrides.errors ?? {},
    message: overrides.message ?? 'Success'
  };
}
