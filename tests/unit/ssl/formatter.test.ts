import { renderSslResult } from '../../../src/ssl/formatter.js';

describe('SSL formatter', () => {
  it('renders certificate IDs in human output', () => {
    const output = renderSslResult(
      {
        action: 'list',
        items: [
          {
            id: 123,
            ssl_cert_name: 'api-cert',
            ssl_certificate_type: 'CUSTOM',
            status: 'ACTIVE',
            common_name: 'api.example.com',
            expiry_date: '2027-01-01'
          }
        ]
      },
      false
    );

    expect(output).toContain('123');
    expect(output).toContain('api-cert');
    expect(output).toContain('api.example.com');
  });

  it('renders deterministic JSON', () => {
    const output = renderSslResult(
      {
        action: 'list',
        items: [
          {
            id: 456,
            certificate_name: 'web-cert',
            status: 'ACTIVE'
          }
        ]
      },
      true
    );

    expect(JSON.parse(output)).toEqual({
      action: 'list',
      items: [
        {
          id: 456,
          name: 'web-cert',
          ssl_certificate_type: null,
          status: 'ACTIVE',
          common_name: null,
          expiry_date: null,
          created_at: null
        }
      ]
    });
  });
});
