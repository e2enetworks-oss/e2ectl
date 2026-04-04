import { formatCliCommand } from '../../../src/app/metadata.js';
import {
  formatDnsListTable,
  formatDnsRecordTable,
  formatDnsRrsetsTable,
  renderDnsResult
} from '../../../src/dns/formatter.js';

describe('dns formatter', () => {
  it('renders stable DNS list tables', () => {
    const table = formatDnsListTable([
      {
        created_at: '2024-11-04T09:01:30.545588Z',
        deleted: false,
        domain_name: 'example.com.',
        id: 10280,
        ip_address: '1.1.1.1',
        validity: null
      }
    ]);

    expect(table).toContain('example.com.');
    expect(table).toContain('1.1.1.1');
  });

  it('renders flattened record tables for record list and get output', () => {
    const table = formatDnsRecordTable([
      {
        disabled: false,
        name: 'www.example.com.',
        ttl: 300,
        type: 'A',
        value: '1.1.1.1'
      }
    ]);

    expect(table).toContain('www.example.com.');
    expect(table).toContain('300');
    expect(table).toContain('1.1.1.1');
  });

  it('renders rrset tables for raw zone and TTL views', () => {
    const table = formatDnsRrsetsTable([
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
    ]);

    expect(table).toContain('www.example.com.');
    expect(table).toContain('300');
    expect(table).toContain('1.1.1.1');
  });

  it('renders create output with the requested domain and IP preserved', () => {
    const output = renderDnsResult(
      {
        action: 'create',
        domain: {
          id: 10279
        },
        message: 'The domain was created successfully!',
        requested: {
          domain_name: 'Example.COM',
          ip_address: '1.1.1.1'
        }
      },
      false
    );

    expect(output).toContain('Created DNS domain request: Example.COM');
    expect(output).toContain('Requested IP: 1.1.1.1');
    expect(output).toContain(formatCliCommand('dns get Example.COM'));
  });

  it('renders get json with raw rrsets plus derived nameservers, soa, and records', () => {
    const output = renderDnsResult(
      {
        action: 'get',
        domain: {
          domain_name: 'example.com.',
          domain_ttl: 86400,
          ip_address: '1.1.1.1',
          nameservers: ['ns50.e2enetworks.net.in.', 'ns51.e2enetworks.net.in.'],
          records: [
            {
              disabled: false,
              name: 'www.example.com.',
              ttl: 300,
              type: 'A',
              value: '1.1.1.1'
            }
          ],
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
            }
          ],
          soa: {
            name: 'example.com.',
            ttl: 86400,
            values: ['ns50.e2enetworks.net.in. abuse.example.com. 1 2 3 4 5']
          }
        }
      },
      true
    );
    const parsed = JSON.parse(output) as {
      action: string;
      domain: {
        nameservers: string[];
        records: Array<{ value: string }>;
        rrsets: Array<{ name: string }>;
        soa: { values: string[] };
      };
    };

    expect(parsed.action).toBe('get');
    expect(parsed.domain.rrsets[0]?.name).toBe('example.com.');
    expect(parsed.domain.nameservers).toEqual([
      'ns50.e2enetworks.net.in.',
      'ns51.e2enetworks.net.in.'
    ]);
    expect(parsed.domain.soa.values).toEqual([
      'ns50.e2enetworks.net.in. abuse.example.com. 1 2 3 4 5'
    ]);
    expect(parsed.domain.records[0]?.value).toBe('1.1.1.1');
  });

  it('renders nameserver aggregation output for humans', () => {
    const output = renderDnsResult(
      {
        action: 'nameservers',
        authority_match: false,
        configured_nameservers: ['ns50.e2enetworks.net.in.'],
        delegated_nameservers: ['ns1.example.net.'],
        domain_name: 'example.com.',
        message: 'Your nameservers are not setup correctly',
        problem: 1,
        status: true
      },
      false
    );

    expect(output).toContain('Authority Match: no');
    expect(output).toContain(
      'Configured Nameservers: ns50.e2enetworks.net.in.'
    );
    expect(output).toContain('Delegated Nameservers: ns1.example.net.');
  });
});
