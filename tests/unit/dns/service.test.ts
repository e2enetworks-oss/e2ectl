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
  deleteDomain: ReturnType<typeof vi.fn>;
  getDomain: ReturnType<typeof vi.fn>;
  listDomains: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  service: DnsService;
  verifyNameservers: ReturnType<typeof vi.fn>;
  verifyTtl: ReturnType<typeof vi.fn>;
  verifyValidity: ReturnType<typeof vi.fn>;
} {
  const createDomain = vi.fn();
  const deleteDomain = vi.fn();
  const getDomain = vi.fn();
  const listDomains = vi.fn();
  const verifyNameservers = vi.fn();
  const verifyTtl = vi.fn();
  const verifyValidity = vi.fn();
  let credentials: ResolvedCredentials | undefined;

  const client: DnsClient = {
    createDomain,
    deleteDomain,
    getDomain,
    listDomains,
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
    deleteDomain,
    getDomain,
    listDomains,
    receivedCredentials: () => credentials,
    service,
    verifyNameservers,
    verifyTtl,
    verifyValidity
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

  it('gets one domain through the dedicated detail path and canonicalizes the input', async () => {
    const { getDomain, listDomains, service } = createServiceFixture();

    getDomain.mockResolvedValue({
      DOMAIN_TTL: 86400,
      domain: {
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'SOA'
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
        rrsets: [
          {
            name: 'example.com.',
            records: [
              {
                content: 'ns50.e2enetworks.net.in. abuse.e2enetworks.net.in.',
                disabled: false
              }
            ],
            ttl: 86400,
            type: 'SOA'
          }
        ]
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

  it('fails clearly when delete cannot resolve a canonical domain match', async () => {
    const { deleteDomain, listDomains, service } = createServiceFixture();

    listDomains.mockResolvedValue([
      {
        created_at: '2024-11-04T09:01:30.545588Z',
        deleted: false,
        domain_ip: '1.1.1.1',
        domain_name: 'other.com.',
        id: 10281,
        validity: null
      }
    ]);

    await expect(
      service.deleteDomain('example.com', {
        alias: 'prod',
        force: true
      })
    ).rejects.toMatchObject({
      code: 'DNS_DOMAIN_NOT_FOUND',
      message: 'DNS domain example.com. was not found.'
    });
    expect(deleteDomain).not.toHaveBeenCalled();
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

  it('canonicalizes nameserver verification input and normalizes backend field names', async () => {
    const { service, verifyNameservers } = createServiceFixture();

    verifyNameservers.mockResolvedValue({
      data: {
        authority: false,
        e2e_nameservers: ['ns50.e2enetworks.net.in.'],
        gl_nameservers: ['ns1.example.net.'],
        problem: 1
      },
      message: 'Your nameservers are not setup correctly',
      status: true
    });

    const result = await service.verifyNameservers('Example.com', {
      alias: 'prod'
    });

    expect(verifyNameservers).toHaveBeenCalledWith('example.com.');
    expect(result).toEqual({
      action: 'verify-ns',
      authority: false,
      domain_name: 'example.com.',
      e2e_nameservers: ['ns50.e2enetworks.net.in.'],
      global_nameservers: ['ns1.example.net.'],
      message: 'Your nameservers are not setup correctly',
      problem: 1,
      status: true
    });
  });

  it('normalizes TTL verification from the backend low-rrset array shape', async () => {
    const { service, verifyTtl } = createServiceFixture();

    verifyTtl.mockResolvedValue({
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
    });

    const result = await service.verifyTtl('EXAMPLE.com.', {
      alias: 'prod'
    });

    expect(verifyTtl).toHaveBeenCalledWith('example.com.');
    expect(result).toEqual({
      action: 'verify-ttl',
      domain_name: 'example.com.',
      low_ttl_count: 1,
      low_ttl_records: [
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
    });
  });
});
