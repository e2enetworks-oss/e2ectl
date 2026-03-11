import { stableStringify } from '../../../src/core/json.js';

describe('stableStringify', () => {
  it('formats JSON deterministically', () => {
    const json = stableStringify({
      zebra: 2,
      apple: 1
    });

    expect(json).toBe('{\n  "apple": 1,\n  "zebra": 2\n}');
  });
});
