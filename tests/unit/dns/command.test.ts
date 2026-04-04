import { CLI_COMMAND_NAME } from '../../../src/app/metadata.js';
import { createProgram } from '../../../src/app/program.js';
import type { CliRuntime } from '../../../src/app/runtime.js';
import { stableStringify } from '../../../src/core/json.js';
import type { ResolvedCredentials } from '../../../src/config/index.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { DnsClient } from '../../../src/dns/index.js';
import type { NodeClient } from '../../../src/node/index.js';
import type { SshKeyClient } from '../../../src/ssh-key/index.js';
import type { VolumeClient } from '../../../src/volume/index.js';
import type { VpcClient } from '../../../src/vpc/index.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createDnsClientStub() {
  const createDomain = vi.fn(() =>
    Promise.resolve({
      id: 10279,
      message: 'The domain was created successfully!',
      status: true
    })
  );
  const createRecord = vi.fn(() =>
    Promise.resolve({
      message: 'The record was added successfully!',
      status: true
    })
  );
  const deleteDomain = vi.fn(() =>
    Promise.resolve({
      message: 'The domain was deleted successfully',
      status: true
    })
  );
  const deleteRecord = vi.fn(() =>
    Promise.resolve({
      message: 'The record was deleted successfully!',
      status: true
    })
  );
  const getDomain = vi.fn(() =>
    Promise.resolve({
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
                content: '"old text"',
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
    })
  );
  const listDomains = vi.fn(() =>
    Promise.resolve([
      {
        created_at: '2024-11-04T09:01:30.545588Z',
        deleted: false,
        domain_ip: '1.1.1.1',
        domain_name: 'example.com.',
        id: 10279,
        validity: null
      }
    ])
  );
  const updateRecord = vi.fn(() =>
    Promise.resolve({
      message: 'The record was updated successfully!',
      status: true
    })
  );
  const verifyNameservers = vi.fn(() =>
    Promise.resolve({
      data: {
        authority: false,
        e2e_nameservers: [
          'ns50.e2enetworks.net.in.',
          'ns51.e2enetworks.net.in.'
        ],
        gl_nameservers: ['ns1.example.net.', 'ns2.example.net.'],
        problem: 1
      },
      message: 'Your nameservers are not setup correctly',
      status: true
    })
  );
  const verifyTtl = vi.fn(() =>
    Promise.resolve({
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
  const verifyValidity = vi.fn(() =>
    Promise.resolve({
      data: {
        expiry_date: '2026-05-01',
        problem: 0,
        validity: true
      },
      message: 'Valid for 30 days',
      status: true
    })
  );

  const stub: DnsClient = {
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

  return {
    createDomain,
    createRecord,
    deleteDomain,
    deleteRecord,
    getDomain,
    listDomains,
    stub,
    updateRecord,
    verifyNameservers,
    verifyTtl,
    verifyValidity
  };
}

describe('dns commands', () => {
  function createRuntimeFixture(): {
    dnsStub: ReturnType<typeof createDnsClientStub>;
    receivedCredentials: () => ResolvedCredentials | undefined;
    runtime: CliRuntime;
    stdout: MemoryWriter;
  } {
    const configPath = createTestConfigPath('dns-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const dnsStub = createDnsClientStub();
    let credentials: ResolvedCredentials | undefined;

    const runtime: CliRuntime = {
      confirm: vi.fn(() => Promise.resolve(true)),
      createDnsClient: (resolvedCredentials) => {
        credentials = resolvedCredentials;
        return dnsStub.stub;
      },
      createNodeClient: vi.fn(() => {
        throw new Error('Node client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => NodeClient,
      createReservedIpClient: vi.fn(() => {
        throw new Error(
          'Reserved IP client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createReservedIpClient'],
      createSecurityGroupClient: vi.fn(() => {
        throw new Error(
          'Security group client should not be created for this test.'
        );
      }) as unknown as CliRuntime['createSecurityGroupClient'],
      createSshKeyClient: vi.fn(() => {
        throw new Error('SSH key client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => SshKeyClient,
      createVolumeClient: vi.fn(() => {
        throw new Error('Volume client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VolumeClient,
      createVpcClient: vi.fn(() => {
        throw new Error('VPC client should not be created for this test.');
      }) as unknown as (credentials: ResolvedCredentials) => VpcClient,
      credentialValidator: {
        validate: vi.fn()
      },
      isInteractive: true,
      prompt: vi.fn(() => Promise.resolve('')),
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      dnsStub,
      receivedCredentials: () => credentials,
      runtime,
      stdout
    };
  }

  async function seedProfile(runtime: CliRuntime): Promise<void> {
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      default_project_id: '12345',
      default_location: 'Delhi'
    });
  }

  it('lists domains in deterministic json mode using alias defaults', async () => {
    const { receivedCredentials, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dns',
      'list',
      '--alias',
      'prod'
    ]);

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '12345'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'list',
        items: [
          {
            created_at: '2024-11-04T09:01:30.545588Z',
            deleted: false,
            domain_name: 'example.com.',
            id: 10279,
            ip_address: '1.1.1.1',
            validity: null
          }
        ]
      })}\n`
    );
  });

  it('renders get output in deterministic json mode with additive derived fields', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dns',
      'get',
      'EXAMPLE.com',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
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
              value: 'old text'
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
                  content: '"old text"',
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
      })}\n`
    );
  });

  it('renders nameserver aggregation in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dns',
      'nameservers',
      'EXAMPLE.com',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'nameservers',
        authority_match: false,
        configured_nameservers: [
          'ns50.e2enetworks.net.in.',
          'ns51.e2enetworks.net.in.'
        ],
        delegated_nameservers: ['ns1.example.net.', 'ns2.example.net.'],
        domain_name: 'example.com.',
        message: 'Your nameservers are not setup correctly',
        problem: 1,
        status: true
      })}\n`
    );
  });

  it('creates record commands with the reviewed dns record surface', async () => {
    const { dnsStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    dnsStub.getDomain.mockResolvedValueOnce({
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
        ]
      },
      domain_ip: '1.1.1.1',
      domain_name: 'example.com.'
    });

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dns',
      'record',
      'create',
      'Example.com',
      '--type',
      'CNAME',
      '--name',
      'api',
      '--value',
      'App.Example.NET',
      '--alias',
      'prod'
    ]);

    expect(dnsStub.createRecord).toHaveBeenCalledWith('example.com.', {
      content: 'app.example.net.',
      record_name: 'api.example.com.',
      record_type: 'CNAME',
      zone_name: 'example.com.'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'record-create',
        domain_name: 'example.com.',
        message: 'The record was added successfully!',
        record: {
          name: 'api.example.com.',
          ttl: null,
          type: 'CNAME',
          value: 'app.example.net.'
        }
      })}\n`
    );
  });

  it('updates records in deterministic json mode using exact current-value targeting', async () => {
    const { dnsStub, runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      CLI_COMMAND_NAME,
      '--json',
      'dns',
      'record',
      'update',
      'Example.com',
      '--type',
      'TXT',
      '--current-value',
      'old text',
      '--value',
      'new text',
      '--alias',
      'prod'
    ]);

    expect(dnsStub.updateRecord).toHaveBeenCalledWith('example.com.', {
      new_record_content: '"new text"',
      new_record_ttl: 300,
      old_record_content: '"old text"',
      record_name: 'example.com.',
      record_type: 'TXT',
      zone_name: 'example.com.'
    });
    expect(stdout.buffer).toBe(
      `${stableStringify({
        action: 'record-update',
        domain_name: 'example.com.',
        message: 'The record was updated successfully!',
        record: {
          current_value: 'old text',
          name: 'example.com.',
          new_value: 'new text',
          ttl: 300,
          type: 'TXT'
        }
      })}\n`
    );
  });
});
