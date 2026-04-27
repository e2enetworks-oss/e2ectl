import { renderSslResult } from '../../../src/ssl/formatter.js';

describe('SSL formatter', () => {
  it('renders "No SSL certificates found." when list is empty', () => {
    const output = renderSslResult({ action: 'list', items: [] }, false);
    expect(output).toBe('No SSL certificates found.\n');
  });

  it('renders certificate IDs in human output', () => {
    const output = renderSslResult(
      {
        action: 'list',
        items: [
          {
            id: 123,
            ssl_cert_name: 'api-cert',
            ssl_certificate_type: 'Imported',
            ssl_certificate_state: 'NA',
            ssl_domain_name: 'api.example.com',
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
            ssl_certificate_state: 'NA'
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
          ssl_certificate_state: 'NA',
          ssl_domain_name: null,
          expiry_date: null,
          imported_date: null
        }
      ]
    });
  });
});
