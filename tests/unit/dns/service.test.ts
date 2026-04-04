import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import { DnsService } from '../../../src/dns/service.js';
import type { DnsClient } from '../../../src/dns/index.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '46429'
      }
    }
  };
}

function createServiceFixture(options?: {
  confirmResult?: boolean;
  isInteractive?: boolean;
}): {
  confirm: ReturnType<typeof vi.fn>;
  createDnsClient: ReturnType<typeof vi.fn>;
  createDomain: ReturnType<typeof vi.fn>;
  createRecord: ReturnType<typeof vi.fn>;
  deleteDomain: ReturnType<typeof vi.fn>;
  deleteRecord: ReturnType<typeof vi.fn>;
  getDomain: ReturnType<typeof vi.fn>;
  listDomains: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: DnsService;
  updateRecord: ReturnType<typeof vi.fn>;
  verifyNameservers: ReturnType<typeof vi.fn>;
  verifyTtl: ReturnType<typeof vi.fn>;
  verifyValidity: ReturnType<typeof vi.fn>;
} {
  const createDomain = vi.fn();
  const createRecord = vi.fn();
  const deleteDomain = vi.fn();
  const deleteRecord = vi.fn();
  const getDomain = vi.fn();
  const listDomains = vi.fn();
  const updateRecord = vi.fn();
  const verifyNameservers = vi.fn();
  const verifyTtl = vi.fn();
  const verifyValidity = vi.fn();
  let credentials: ResolvedCredentials | undefined;

  const client: DnsClient = {
    createDomain,
    createRecord,
    deleteDomain,
    deleteRecord,
    getDomain,
    listDomains,
    updateRecord,
    verifyNameservers,
    verifyTtl,
    verifyValidity
  };
  const createDnsClient = vi.fn((resolvedCredentials: ResolvedCredentials) => {
    credentials = resolvedCredentials;
    return client;
  });
  const confirm = vi.fn(() => Promise.resolve(options?.confirmResult ?? true));
  const service = new DnsService({
    confirm,
    createDnsClient,
    isInteractive: options?.isInteractive ?? true,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    confirm,
    createDnsClient,
    createDomain,
    createRecord,
    deleteDomain,
    deleteRecord,
    getDomain,
    listDomains,
    receivedCredentials: () => credentials,
    service,
    updateRecord,
    verifyNameservers,
    verifyTtl,
    verifyValidity
  };
}

function buildDomainDetailsResponse(
  rrsets: Array<{
    name: string;
    records: Array<{
      content: string;
      disabled: boolean;
    }>;
    ttl: number;
    type: string;
  }>
) {
  return {
    DOMAIN_TTL: 86400,
    domain: {
      rrsets
    },
    domain_ip: '1.1.1.1',
    domain_name: 'example.com.'
  };
}

describe('DnsService', () => {
  it('lists domains and resolves saved defaults', async () => {
    const { listDomains, receivedCredentials, service } =
      createServiceFixture();

    listDomains.mockResolvedValue([
      {
        created_at: '2024-11-04T09:01:30.545588Z',
        deleted: false,
        domain_ip: '1.1.1.1',
        domain_name: 'Example.com.',
        id: 10280,
        validity: null
      }
    ]);

    const result = await service.listDomains({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(result).toEqual({
      action: 'list',
      items: [
        {
          created_at: '2024-11-04T09:01:30.545588Z',
          deleted: false,
          domain_name: 'example.com.',
          id: 10280,
          ip_address: '1.1.1.1',
          validity: null
        }
      ]
    });
  });

  it('gets one domain through the detail path and adds derived nameservers, soa, and records', async () => {
    const { getDomain, listDomains, service } = createServiceFixture();

    getDomain.mockResolvedValue({
      DOMAIN_TTL: 86400,
      domain: {
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content:
                  'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in. 2024110404 10800 3600 604800 86400',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'SOA'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in.',
                disabled: false
              },
              {
                content: 'ns51.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'NS'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: '1.1.1.1',
                disabled: false
              }
            ],
            ttl: 600,
            type: 'A'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: '"v=spf1 include:mail.example.net"',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'TXT'
          }
        ]
      },
      domain_ip: '1.1.1.1',
      domain_name: 'example.com.'
    });

    const result = await service.getDomain('EXAMPLE.com', { alias: 'prod' });

    expect(getDomain).toHaveBeenCalledWith('example.com.');
    expect(listDomains).not.toHaveBeenCalled();
    expect(result).toEqual({
      action: 'get',
      domain: {
        domain_name: 'example.com.',
        domain_ttl: 86400,
        ip_address: '1.1.1.1',
        nameservers: ['ns50.e2enetworks.net.in.', 'ns51.e2enetworks.net.in.'],
        records: [
          {
            disabled: false,
            name: 'example.com.',
            ttl: 600,
            type: 'A',
            value: '1.1.1.1'
          },
          {
            disabled: false,
            name: 'example.com.',
            ttl: 300,
            type: 'TXT',
            value: 'v=spf1 include:mail.example.net'
          }
        ],
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content:
                  'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in. 2024110404 10800 3600 604800 86400',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'SOA'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in.',
                disabled: false
              },
              {
                content: 'ns51.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'NS'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: '1.1.1.1',
                disabled: false
              }
            ],
            ttl: 600,
            type: 'A'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: '"v=spf1 include:mail.example.net"',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'TXT'
          }
        ],
        soa: {
          name: 'example.com.',
          ttl: 86400,
          values: [
            'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in. 2024110404 10800 3600 604800 86400'
          ]
        }
      }
    });
  });

  it('rejects invalid IPv4 input locally before any network request', async () => {
    const { createDnsClient, createDomain, service } = createServiceFixture();

    await expect(
      service.createDomain('example.com', {
        alias: 'prod',
        ip: 'not-an-ip'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IP_ADDRESS',
      message: 'IP address must be a valid IPv4 address.'
    });
    expect(createDnsClient).not.toHaveBeenCalled();
    expect(createDomain).not.toHaveBeenCalled();
  });

  it('preserves the requested domain and IP in create output while sending canonical form to the backend', async () => {
    const { createDomain, service } = createServiceFixture();

    createDomain.mockResolvedValue({
      id: 10279,
      message: 'The domain was created successfully!',
      status: true
    });

    const result = await service.createDomain('Example.COM', {
      alias: 'prod',
      ip: '1.1.1.1'
    });

    expect(createDomain).toHaveBeenCalledWith({
      domain_name: 'example.com.',
      ip_addr: '1.1.1.1'
    });
    expect(result).toEqual({
      action: 'create',
      domain: {
        id: 10279
      },
      message: 'The domain was created successfully!',
      requested: {
        domain_name: 'Example.COM',
        ip_address: '1.1.1.1'
      }
    });
  });

  it('resolves domain_id internally from the list before deleting', async () => {
    const { deleteDomain, listDomains, service } = createServiceFixture();

    listDomains.mockResolvedValue([
      {
        created_at: '2024-11-04T09:01:30.545588Z',
        deleted: false,
        domain_ip: '1.1.1.1',
        domain_name: 'example.com.',
        id: 10280,
        validity: null
      }
    ]);
    deleteDomain.mockResolvedValue({
      message: 'The domain was deleted successfully',
      status: true
    });

    const result = await service.deleteDomain('EXAMPLE.com', {
      alias: 'prod',
      force: true
    });

    expect(listDomains).toHaveBeenCalledTimes(1);
    expect(deleteDomain).toHaveBeenCalledWith(10280);
    expect(result).toEqual({
      action: 'delete',
      cancelled: false,
      domain_name: 'example.com.',
      message: 'The domain was deleted successfully'
    });
  });

  it('fails before network when delete is non-interactive and --force is omitted', async () => {
    const { createDnsClient, listDomains, service } = createServiceFixture({
      isInteractive: false
    });

    await expect(
      service.deleteDomain('example.com', {
        alias: 'prod'
      })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a DNS domain requires confirmation in an interactive terminal.'
    });
    expect(createDnsClient).not.toHaveBeenCalled();
    expect(listDomains).not.toHaveBeenCalled();
  });

  it('fails before network when record delete is non-interactive and --force is omitted', async () => {
    const { createDnsClient, deleteRecord, getDomain, service } =
      createServiceFixture({
        isInteractive: false
      });

    await expect(
      service.deleteRecord('example.com', {
        alias: 'prod',
        type: 'A',
        value: '1.1.1.1'
      })
    ).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      message:
        'Deleting a DNS record requires confirmation in an interactive terminal.'
    });
    expect(createDnsClient).not.toHaveBeenCalled();
    expect(getDomain).not.toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it('combines configured NS rrsets with delegated nameserver diagnostics', async () => {
    const { getDomain, service, verifyNameservers } = createServiceFixture();

    getDomain.mockResolvedValue({
      DOMAIN_TTL: 86400,
      domain: {
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in.',
                disabled: false
              },
              {
                content: 'ns51.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'NS'
          }
        ]
      },
      domain_ip: '1.1.1.1',
      domain_name: 'example.com.'
    });
    verifyNameservers.mockResolvedValue({
      data: {
        authority: true,
        e2e_nameservers: ['ns50.e2enetworks.net.in.'],
        gl_nameservers: [
          'ns51.e2enetworks.net.in.',
          'ns50.e2enetworks.net.in.'
        ],
        problem: 0
      },
      message: 'Your nameservers are setup correctly',
      status: true
    });

    const result = await service.getNameservers('Example.com', {
      alias: 'prod'
    });

    expect(getDomain).toHaveBeenCalledWith('example.com.');
    expect(verifyNameservers).toHaveBeenCalledWith('example.com.');
    expect(result).toEqual({
      action: 'nameservers',
      authority_match: true,
      configured_nameservers: [
        'ns50.e2enetworks.net.in.',
        'ns51.e2enetworks.net.in.'
      ],
      delegated_nameservers: [
        'ns50.e2enetworks.net.in.',
        'ns51.e2enetworks.net.in.'
      ],
      domain_name: 'example.com.',
      message: 'Your nameservers are setup correctly',
      problem: 0,
      status: true
    });
  });

  it('prefers backend authority semantics for authority_match when provided', async () => {
    const { getDomain, service, verifyNameservers } = createServiceFixture();

    getDomain.mockResolvedValue({
      DOMAIN_TTL: 86400,
      domain: {
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in.',
                disabled: false
              },
              {
                content: 'ns51.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'NS'
          }
        ]
      },
      domain_ip: '1.1.1.1',
      domain_name: 'example.com.'
    });
    verifyNameservers.mockResolvedValue({
      data: {
        authority: true,
        e2e_nameservers: ['ns50.e2enetworks.net.in.'],
        gl_nameservers: ['ns50.e2enetworks.net.in.'],
        problem: 0
      },
      message: 'Your nameservers are setup correctly',
      status: true
    });

    const result = await service.getNameservers('Example.com', {
      alias: 'prod'
    });

    expect(result.authority_match).toBe(true);
    expect(result.configured_nameservers).toEqual([
      'ns50.e2enetworks.net.in.',
      'ns51.e2enetworks.net.in.'
    ]);
    expect(result.delegated_nameservers).toEqual(['ns50.e2enetworks.net.in.']);
  });

  it('lists forward records by flattening rrsets and excluding SOA and NS', async () => {
    const { getDomain, service } = createServiceFixture();

    getDomain.mockResolvedValue({
      DOMAIN_TTL: 86400,
      domain: {
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'NS'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: 'ignored',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'SOA'
          },
          {
            name: 'www.example.com.',
            records: [
              {
                content: '1.1.1.1',
                disabled: false
              },
              {
                content: '1.1.1.2',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'A'
          },
          {
            name: 'example.com.',
            records: [
              {
                content: '"hello world"',
                disabled: false
              }
            ],
            ttl: 600,
            type: 'TXT'
          }
        ]
      },
      domain_ip: '1.1.1.1',
      domain_name: 'example.com.'
    });

    const result = await service.listRecords('example.com', {
      alias: 'prod'
    });

    expect(result).toEqual({
      action: 'record-list',
      domain_name: 'example.com.',
      items: [
        {
          disabled: false,
          name: 'www.example.com.',
          ttl: 300,
          type: 'A',
          value: '1.1.1.1'
        },
        {
          disabled: false,
          name: 'www.example.com.',
          ttl: 300,
          type: 'A',
          value: '1.1.1.2'
        },
        {
          disabled: false,
          name: 'example.com.',
          ttl: 600,
          type: 'TXT',
          value: 'hello world'
        }
      ]
    });
  });

  it('maps --name @ to the apex and validates A records locally', async () => {
    const { createRecord, getDomain, service } = createServiceFixture();

    createRecord.mockResolvedValue({
      message: 'The record was added successfully!',
      status: true
    });
    getDomain.mockResolvedValue(
      buildDomainDetailsResponse([
        {
          name: 'example.com.',
          records: [
            {
              content: '203.0.113.10',
              disabled: false
            }
          ],
          ttl: 300,
          type: 'A'
        }
      ])
    );

    const result = await service.createRecord('Example.com', {
      alias: 'prod',
      name: '@',
      type: 'A',
      value: '203.0.113.10'
    });

    expect(createRecord).toHaveBeenCalledWith('example.com.', {
      content: '203.0.113.10',
      record_name: 'example.com.',
      record_type: 'A',
      zone_name: 'example.com.'
    });
    expect(result.record).toEqual({
      name: 'example.com.',
      ttl: null,
      type: 'A',
      value: '203.0.113.10'
    });
  });

  it('rejects invalid A record IPv4 values before any network request', async () => {
    const { createDnsClient, createRecord, service } = createServiceFixture();

    await expect(
      service.createRecord('example.com', {
        alias: 'prod',
        type: 'A',
        value: 'bad-ip'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IP_ADDRESS',
      message: 'IP address must be a valid IPv4 address.'
    });
    expect(createDnsClient).not.toHaveBeenCalled();
    expect(createRecord).not.toHaveBeenCalled();
  });

  it('rejects invalid AAAA values before any network request', async () => {
    const { createDnsClient, createRecord, service } = createServiceFixture();

    await expect(
      service.createRecord('example.com', {
        alias: 'prod',
        type: 'AAAA',
        value: 'bad-ipv6'
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IP_ADDRESS',
      message: 'IP address must be a valid IPv6 address.'
    });
    expect(createDnsClient).not.toHaveBeenCalled();
    expect(createRecord).not.toHaveBeenCalled();
  });

  it('canonicalizes relative record names and trailing-dot targets for CNAME', async () => {
    const { createRecord, getDomain, service } = createServiceFixture();

    createRecord.mockResolvedValue({
      message: 'The record was added successfully!',
      status: true
    });
    getDomain.mockResolvedValue(
      buildDomainDetailsResponse([
        {
          name: 'api.example.com.',
          records: [
            {
              content: 'app.example.net.',
              disabled: false
            }
          ],
          ttl: 300,
          type: 'CNAME'
        }
      ])
    );

    await service.createRecord('example.com', {
      alias: 'prod',
      name: 'api',
      type: 'CNAME',
      value: 'App.Example.NET'
    });

    expect(createRecord).toHaveBeenCalledWith('example.com.', {
      content: 'app.example.net.',
      record_name: 'api.example.com.',
      record_type: 'CNAME',
      zone_name: 'example.com.'
    });
  });

  it('quotes TXT values internally while keeping display values unquoted', async () => {
    const { createRecord, getDomain, service } = createServiceFixture();

    createRecord.mockResolvedValue({
      message: 'The record was added successfully!',
      status: true
    });
    getDomain.mockResolvedValue(
      buildDomainDetailsResponse([
        {
          name: 'example.com.',
          records: [
            {
              content: '"hello world"',
              disabled: false
            }
          ],
          ttl: 300,
          type: 'TXT'
        }
      ])
    );

    const result = await service.createRecord('example.com', {
      alias: 'prod',
      type: 'TXT',
      value: 'hello world'
    });

    expect(createRecord).toHaveBeenCalledWith('example.com.', {
      content: '"hello world"',
      record_name: 'example.com.',
      record_type: 'TXT',
      zone_name: 'example.com.'
    });
    expect(result.record.value).toBe('hello world');
  });

  it('normalizes MX and SRV targets with trailing dots', async () => {
    const { createRecord, getDomain, service } = createServiceFixture();

    createRecord.mockResolvedValue({
      message: 'The record was added successfully!',
      status: true
    });
    getDomain
      .mockResolvedValueOnce(
        buildDomainDetailsResponse([
          {
            name: 'example.com.',
            records: [
              {
                content: '10 mail.example.net.',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'MX'
          }
        ])
      )
      .mockResolvedValueOnce(
        buildDomainDetailsResponse([
          {
            name: '_sip._tcp.example.com.',
            records: [
              {
                content: '10 5 443 service.example.net.',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'SRV'
          }
        ])
      );

    await service.createRecord('example.com', {
      alias: 'prod',
      exchange: 'Mail.EXAMPLE.NET',
      priority: '10',
      type: 'MX'
    });
    await service.createRecord('example.com', {
      alias: 'prod',
      name: '_sip._tcp',
      port: '443',
      priority: '10',
      target: 'Service.EXAMPLE.NET',
      type: 'SRV',
      weight: '5'
    });

    expect(createRecord).toHaveBeenNthCalledWith(1, 'example.com.', {
      content: '10 mail.example.net.',
      record_name: 'example.com.',
      record_type: 'MX',
      zone_name: 'example.com.'
    });
    expect(createRecord).toHaveBeenNthCalledWith(2, 'example.com.', {
      content: '10 5 443 service.example.net.',
      record_name: '_sip._tcp.example.com.',
      record_type: 'SRV',
      zone_name: 'example.com.'
    });
  });

  it('waits for created records to become visible before returning', async () => {
    vi.useFakeTimers();

    try {
      const { createRecord, getDomain, service } = createServiceFixture();

      createRecord.mockResolvedValue({
        message: 'The record was added successfully!',
        status: true
      });
      getDomain
        .mockResolvedValueOnce(buildDomainDetailsResponse([]))
        .mockResolvedValueOnce(
          buildDomainDetailsResponse([
            {
              name: 'example.com.',
              records: [
                {
                  content: '203.0.113.10',
                  disabled: false
                }
              ],
              ttl: 300,
              type: 'A'
            }
          ])
        );

      const resultPromise = service.createRecord('example.com', {
        alias: 'prod',
        type: 'A',
        value: '203.0.113.10'
      });

      await vi.runAllTimersAsync();

      await expect(resultPromise).resolves.toMatchObject({
        action: 'record-create',
        record: {
          name: 'example.com.',
          type: 'A',
          value: '203.0.113.10'
        }
      });
      expect(getDomain).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('verifies the exact current record value exists before deleting', async () => {
    const { deleteRecord, getDomain, service } = createServiceFixture();

    getDomain
      .mockResolvedValueOnce(
        buildDomainDetailsResponse([
          {
            name: 'example.com.',
            records: [
              {
                content: '1.1.1.1',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'A'
          }
        ])
      )
      .mockResolvedValueOnce(buildDomainDetailsResponse([]));
    deleteRecord.mockResolvedValue({
      message: 'The record was deleted successfully!',
      status: true
    });

    const result = await service.deleteRecord('example.com', {
      alias: 'prod',
      force: true,
      type: 'A',
      value: '1.1.1.1'
    });

    expect(getDomain).toHaveBeenCalledTimes(2);
    expect(getDomain).toHaveBeenNthCalledWith(1, 'example.com.');
    expect(getDomain).toHaveBeenNthCalledWith(2, 'example.com.');
    expect(deleteRecord).toHaveBeenCalledWith('example.com.', {
      content: '1.1.1.1',
      record_name: 'example.com.',
      record_type: 'A',
      zone_name: 'example.com.'
    });
    expect(result).toEqual({
      action: 'record-delete',
      cancelled: false,
      domain_name: 'example.com.',
      message: 'The record was deleted successfully!',
      record: {
        name: 'example.com.',
        type: 'A',
        value: '1.1.1.1'
      }
    });
  });

  it('normalizes the known bad reverse-dns delete copy from the backend', async () => {
    const { deleteRecord, getDomain, service } = createServiceFixture();

    getDomain
      .mockResolvedValueOnce(
        buildDomainDetailsResponse([
          {
            name: 'example.com.',
            records: [
              {
                content: '1.1.1.1',
                disabled: false
              }
            ],
            ttl: 300,
            type: 'A'
          }
        ])
      )
      .mockResolvedValueOnce(buildDomainDetailsResponse([]));
    deleteRecord.mockResolvedValue({
      message: 'The custom Reverse DNS record was deleted successfully!',
      status: true
    });

    const result = await service.deleteRecord('example.com', {
      alias: 'prod',
      force: true,
      type: 'A',
      value: '1.1.1.1'
    });

    expect(result).toEqual({
      action: 'record-delete',
      cancelled: false,
      domain_name: 'example.com.',
      message: 'The record was deleted successfully!',
      record: {
        name: 'example.com.',
        type: 'A',
        value: '1.1.1.1'
      }
    });
  });

  it('retries the exact-match delete lookup before failing', async () => {
    vi.useFakeTimers();

    try {
      const { deleteRecord, getDomain, service } = createServiceFixture();

      getDomain
        .mockResolvedValueOnce(buildDomainDetailsResponse([]))
        .mockResolvedValueOnce(
          buildDomainDetailsResponse([
            {
              name: 'example.com.',
              records: [
                {
                  content: '1.1.1.1',
                  disabled: false
                }
              ],
              ttl: 300,
              type: 'A'
            }
          ])
        )
        .mockResolvedValueOnce(buildDomainDetailsResponse([]));
      deleteRecord.mockResolvedValue({
        message: 'The record was deleted successfully!',
        status: true
      });

      const resultPromise = service.deleteRecord('example.com', {
        alias: 'prod',
        force: true,
        type: 'A',
        value: '1.1.1.1'
      });

      await vi.runAllTimersAsync();

      await expect(resultPromise).resolves.toMatchObject({
        action: 'record-delete',
        record: {
          name: 'example.com.',
          type: 'A',
          value: '1.1.1.1'
        }
      });
      expect(getDomain).toHaveBeenCalledTimes(3);
      expect(deleteRecord).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps current-value and new typed flags correctly when updating records', async () => {
    const { getDomain, service, updateRecord } = createServiceFixture();

    getDomain.mockResolvedValue({
      DOMAIN_TTL: 86400,
      domain: {
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content: '"v=spf1 include:old.example.net"',
                disabled: false
              }
            ],
            ttl: 600,
            type: 'TXT'
          }
        ]
      },
      domain_ip: '1.1.1.1',
      domain_name: 'example.com.'
    });
    updateRecord.mockResolvedValue({
      message: 'The record was updated successfully!',
      status: true
    });

    const result = await service.updateRecord('example.com', {
      alias: 'prod',
      currentValue: 'v=spf1 include:old.example.net',
      type: 'TXT',
      value: 'v=spf1 include:new.example.net'
    });

    expect(getDomain).toHaveBeenCalledWith('example.com.');
    expect(updateRecord).toHaveBeenCalledWith('example.com.', {
      new_record_content: '"v=spf1 include:new.example.net"',
      new_record_ttl: 600,
      old_record_content: '"v=spf1 include:old.example.net"',
      record_name: 'example.com.',
      record_type: 'TXT',
      zone_name: 'example.com.'
    });
    expect(result).toEqual({
      action: 'record-update',
      domain_name: 'example.com.',
      message: 'The record was updated successfully!',
      record: {
        current_value: 'v=spf1 include:old.example.net',
        name: 'example.com.',
        new_value: 'v=spf1 include:new.example.net',
        ttl: 600,
        type: 'TXT'
      }
    });
  });
});
