import { formatCliCommand } from '../../../src/app/metadata.js';
import {
  formatDnsListTable,
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

  it('renders rrset tables for zone and TTL views', () => {
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

  it('renders TTL verification output from the backend rrset array shape', () => {
    const output = renderDnsResult(
      {
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
      },
      false
    );

    expect(output).toContain('Low TTL RRsets: 1');
    expect(output).toContain('www.example.com.');
    expect(output).toContain('1.1.1.1');
  });
});
