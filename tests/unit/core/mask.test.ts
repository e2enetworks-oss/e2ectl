import { maskSecret } from '../../../src/core/mask.js';

describe('maskSecret', () => {
  it('returns an empty string unchanged', () => {
    expect(maskSecret('')).toBe('');
  });

  it('fully masks secrets with length up to four', () => {
    expect(maskSecret('1234')).toBe('****');
  });

  it('keeps only the final four characters for longer secrets', () => {
    expect(maskSecret('12345')).toBe('****2345');
  });

  it('masks representative longer secrets consistently', () => {
    expect(maskSecret('abcd1234efgh5678')).toBe('****5678');
  });
});
