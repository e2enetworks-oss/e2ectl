import { sanitizeUrl } from '../../../src/core/url.js';

describe('sanitizeUrl', () => {
  it('redacts the apikey query parameter in a valid URL', () => {
    const result = sanitizeUrl(
      'https://api.e2enetworks.com/myaccount/v1/nodes/?apikey=secret123'
    );

    expect(result).toContain('apikey=%5BREDACTED%5D');
    expect(result).not.toContain('secret123');
  });

  it('leaves URLs without an apikey parameter unchanged', () => {
    const result = sanitizeUrl(
      'https://api.e2enetworks.com/myaccount/v1/nodes/'
    );

    expect(result).toBe('https://api.e2enetworks.com/myaccount/v1/nodes/');
  });

  it('redacts apikey in an invalid URL using regex fallback', () => {
    const result = sanitizeUrl('/nodes/?apikey=secret123&page=1');

    expect(result).toContain('apikey=[REDACTED]');
    expect(result).not.toContain('secret123');
    expect(result).toContain('page=1');
  });

  it('returns an invalid URL unchanged when there is no apikey parameter', () => {
    const result = sanitizeUrl('/nodes/?page=1');

    expect(result).toBe('/nodes/?page=1');
  });
});
