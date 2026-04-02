import { CliError, EXIT_CODES } from '../../../src/core/errors.js';
import {
  normalizeBillingType,
  normalizeOptionalNumericId,
  normalizeOptionalString,
  normalizeRequiredNumericId,
  normalizeRequiredString
} from '../../../src/node/normalizers.js';

// ---------------------------------------------------------------------------
// normalizeRequiredString
// ---------------------------------------------------------------------------

describe('normalizeRequiredString', () => {
  it('returns the value unchanged when it has no surrounding whitespace', () => {
    expect(normalizeRequiredString('hello', 'Label', '--flag')).toBe('hello');
  });

  it('trims leading whitespace', () => {
    expect(normalizeRequiredString('  hello', 'Label', '--flag')).toBe('hello');
  });

  it('trims trailing whitespace', () => {
    expect(normalizeRequiredString('hello  ', 'Label', '--flag')).toBe('hello');
  });

  it('trims both leading and trailing whitespace', () => {
    expect(normalizeRequiredString('  hello world  ', 'Label', '--flag')).toBe(
      'hello world'
    );
  });

  it('throws EMPTY_REQUIRED_VALUE for an empty string', () => {
    let thrown: unknown;
    try {
      normalizeRequiredString('', 'Name', '--name');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    const err = thrown as CliError;
    expect(err.code).toBe('EMPTY_REQUIRED_VALUE');
    expect(err.exitCode).toBe(EXIT_CODES.usage);
    expect(err.message).toContain('Name cannot be empty');
    expect(err.suggestion).toContain('--name');
  });

  it('throws EMPTY_REQUIRED_VALUE for a whitespace-only string', () => {
    let thrown: unknown;
    try {
      normalizeRequiredString('   ', 'Name', '--name');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    expect((thrown as CliError).code).toBe('EMPTY_REQUIRED_VALUE');
  });

  it('throws EMPTY_REQUIRED_VALUE for a tab-only string', () => {
    expect(() => normalizeRequiredString('\t', 'Label', '--flag')).toThrow(
      CliError
    );
  });

  it('preserves internal whitespace within the value', () => {
    expect(normalizeRequiredString('foo bar', 'Label', '--flag')).toBe(
      'foo bar'
    );
  });

  it('includes the label name in the error message', () => {
    let thrown: unknown;
    try {
      normalizeRequiredString('', 'Project ID', '--project-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).message).toContain('Project ID');
  });
});

// ---------------------------------------------------------------------------
// normalizeOptionalString
// ---------------------------------------------------------------------------

describe('normalizeOptionalString', () => {
  it('returns null when value is undefined', () => {
    expect(normalizeOptionalString(undefined, 'Label', '--flag')).toBeNull();
  });

  it('delegates to normalizeRequiredString for a valid value', () => {
    expect(normalizeOptionalString('  trimmed  ', 'Label', '--flag')).toBe(
      'trimmed'
    );
  });

  it('propagates errors from normalizeRequiredString for empty input', () => {
    expect(() => normalizeOptionalString('', 'Label', '--flag')).toThrow(
      CliError
    );
  });

  it('propagates errors from normalizeRequiredString for whitespace-only input', () => {
    let thrown: unknown;
    try {
      normalizeOptionalString('   ', 'Name', '--name');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('EMPTY_REQUIRED_VALUE');
  });
});

// ---------------------------------------------------------------------------
// normalizeRequiredNumericId
// ---------------------------------------------------------------------------

describe('normalizeRequiredNumericId', () => {
  it('parses a simple digit string', () => {
    expect(normalizeRequiredNumericId('42', 'Node ID', '--node-id')).toBe(42);
  });

  it('parses "1" as number 1', () => {
    expect(normalizeRequiredNumericId('1', 'Node ID', '--node-id')).toBe(1);
  });

  it('parses "0" as number 0', () => {
    expect(normalizeRequiredNumericId('0', 'Node ID', '--node-id')).toBe(0);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(normalizeRequiredNumericId('  99  ', 'Node ID', '--node-id')).toBe(
      99
    );
  });

  it('accepts Number.MAX_SAFE_INTEGER (9007199254740991)', () => {
    expect(
      normalizeRequiredNumericId(
        String(Number.MAX_SAFE_INTEGER),
        'Node ID',
        '--node-id'
      )
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('throws INVALID_NUMERIC_ID for one above MAX_SAFE_INTEGER (9007199254740992)', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('9007199254740992', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    const err = thrown as CliError;
    expect(err.code).toBe('INVALID_NUMERIC_ID');
    expect(err.exitCode).toBe(EXIT_CODES.usage);
    expect(err.message).toContain('too large');
  });

  it('throws INVALID_NUMERIC_ID for a very large digit string (99999999999999999)', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('99999999999999999', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    expect((thrown as CliError).code).toBe('INVALID_NUMERIC_ID');
  });

  it('throws INVALID_NUMERIC_ID for a non-numeric string', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('node-abc', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    const err = thrown as CliError;
    expect(err.code).toBe('INVALID_NUMERIC_ID');
    expect(err.message).toContain('must be numeric');
  });

  it('throws INVALID_NUMERIC_ID for a float string', () => {
    expect(() =>
      normalizeRequiredNumericId('3.14', 'Node ID', '--node-id')
    ).toThrow(CliError);
  });

  it('throws INVALID_NUMERIC_ID for a negative string', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('-1', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('INVALID_NUMERIC_ID');
  });

  it('throws EMPTY_REQUIRED_VALUE for an empty string', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    expect((thrown as CliError).code).toBe('EMPTY_REQUIRED_VALUE');
  });

  it('throws EMPTY_REQUIRED_VALUE for a whitespace-only string', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('   ', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('EMPTY_REQUIRED_VALUE');
  });

  it('throws INVALID_NUMERIC_ID for alphanumeric string', () => {
    expect(() =>
      normalizeRequiredNumericId('12abc', 'Node ID', '--node-id')
    ).toThrow(CliError);
  });

  it('includes the label in the non-numeric error message', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('bad', 'Volume ID', '--volume-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).message).toContain('Volume ID');
  });

  it('includes the flag in the suggestion for non-numeric errors', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('bad', 'Volume ID', '--volume-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).suggestion).toContain('--volume-id');
  });

  it('includes the flag in the suggestion for overflow errors', () => {
    let thrown: unknown;
    try {
      normalizeRequiredNumericId('9007199254740992', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).suggestion).toContain('--node-id');
  });
});

// ---------------------------------------------------------------------------
// normalizeOptionalNumericId
// ---------------------------------------------------------------------------

describe('normalizeOptionalNumericId', () => {
  it('returns null when value is undefined', () => {
    expect(
      normalizeOptionalNumericId(undefined, 'Node ID', '--node-id')
    ).toBeNull();
  });

  it('delegates to normalizeRequiredNumericId for a valid digit string', () => {
    expect(normalizeOptionalNumericId('101', 'Node ID', '--node-id')).toBe(101);
  });

  it('propagates trimming from the delegate', () => {
    expect(normalizeOptionalNumericId('  55  ', 'Node ID', '--node-id')).toBe(
      55
    );
  });

  it('propagates INVALID_NUMERIC_ID for a non-numeric value', () => {
    let thrown: unknown;
    try {
      normalizeOptionalNumericId('abc', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('INVALID_NUMERIC_ID');
  });

  it('propagates INVALID_NUMERIC_ID for an overflowing value', () => {
    let thrown: unknown;
    try {
      normalizeOptionalNumericId('9007199254740992', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('INVALID_NUMERIC_ID');
  });

  it('propagates EMPTY_REQUIRED_VALUE for an empty string', () => {
    let thrown: unknown;
    try {
      normalizeOptionalNumericId('', 'Node ID', '--node-id');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('EMPTY_REQUIRED_VALUE');
  });
});

// ---------------------------------------------------------------------------
// normalizeBillingType
// ---------------------------------------------------------------------------

describe('normalizeBillingType', () => {
  const allowed = ['hourly', 'committed'] as const;
  type BillingType = (typeof allowed)[number];

  it('returns the value when it exactly matches an allowed value', () => {
    expect(normalizeBillingType<BillingType>('hourly', allowed, 'hourly')).toBe(
      'hourly'
    );
  });

  it('returns the value when it exactly matches another allowed value', () => {
    expect(
      normalizeBillingType<BillingType>('committed', allowed, 'hourly')
    ).toBe('committed');
  });

  it('is case-insensitive (uppercase input)', () => {
    expect(normalizeBillingType<BillingType>('HOURLY', allowed, 'hourly')).toBe(
      'hourly'
    );
  });

  it('is case-insensitive (mixed case input)', () => {
    expect(
      normalizeBillingType<BillingType>('Committed', allowed, 'hourly')
    ).toBe('committed');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(
      normalizeBillingType<BillingType>('  hourly  ', allowed, 'hourly')
    ).toBe('hourly');
  });

  it('trims and normalises case together', () => {
    expect(
      normalizeBillingType<BillingType>('  COMMITTED  ', allowed, 'hourly')
    ).toBe('committed');
  });

  it('returns the default value when value is undefined', () => {
    expect(
      normalizeBillingType<BillingType>(undefined, allowed, 'hourly')
    ).toBe('hourly');
  });

  it('returns the alternate default value when value is undefined', () => {
    expect(
      normalizeBillingType<BillingType>(undefined, allowed, 'committed')
    ).toBe('committed');
  });

  it('throws INVALID_BILLING_TYPE for an unknown value', () => {
    let thrown: unknown;
    try {
      normalizeBillingType<BillingType>('spot', allowed, 'hourly');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(CliError);
    const err = thrown as CliError;
    expect(err.code).toBe('INVALID_BILLING_TYPE');
    expect(err.exitCode).toBe(EXIT_CODES.usage);
    expect(err.message).toContain('hourly');
    expect(err.message).toContain('committed');
  });

  it('throws INVALID_BILLING_TYPE for an empty string', () => {
    let thrown: unknown;
    try {
      normalizeBillingType<BillingType>('', allowed, 'hourly');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('INVALID_BILLING_TYPE');
  });

  it('throws INVALID_BILLING_TYPE for a whitespace-only string', () => {
    let thrown: unknown;
    try {
      normalizeBillingType<BillingType>('   ', allowed, 'hourly');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).code).toBe('INVALID_BILLING_TYPE');
  });

  it('includes --billing-type flag references in the suggestion', () => {
    let thrown: unknown;
    try {
      normalizeBillingType<BillingType>('reserved', allowed, 'hourly');
    } catch (err) {
      thrown = err;
    }
    expect((thrown as CliError).suggestion).toContain('--billing-type');
  });

  it('works correctly with a single-element allowed list', () => {
    const singleAllowed = ['hourly'] as const;
    expect(
      normalizeBillingType<'hourly'>('hourly', singleAllowed, 'hourly')
    ).toBe('hourly');
  });

  it('throws for a value not in a single-element allowed list', () => {
    const singleAllowed = ['hourly'] as const;
    expect(() =>
      normalizeBillingType<'hourly'>('committed', singleAllowed, 'hourly')
    ).toThrow(CliError);
  });
});

// ---------------------------------------------------------------------------
// Concurrent execution — functions are stateless, safe to call in parallel
// ---------------------------------------------------------------------------

describe('concurrent invocation safety', () => {
  it('resolves all valid normalizeRequiredNumericId calls concurrently', async () => {
    const inputs = ['1', '42', '100', '9007199254740991'];
    const results = await Promise.all(
      inputs.map((v) =>
        Promise.resolve(normalizeRequiredNumericId(v, 'Node ID', '--node-id'))
      )
    );
    expect(results).toEqual([1, 42, 100, Number.MAX_SAFE_INTEGER]);
  });

  it('resolves all valid normalizeRequiredString calls concurrently', async () => {
    const inputs = ['  a  ', '  b  ', '  c  '];
    const results = await Promise.all(
      inputs.map((v) =>
        Promise.resolve(normalizeRequiredString(v, 'Label', '--flag'))
      )
    );
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('resolves mixed optional/required numeric calls without interference', async () => {
    const [r1, r2, r3] = await Promise.all([
      Promise.resolve(
        normalizeOptionalNumericId(undefined, 'Node ID', '--node-id')
      ),
      Promise.resolve(normalizeOptionalNumericId('7', 'Node ID', '--node-id')),
      Promise.resolve(normalizeRequiredNumericId('13', 'Node ID', '--node-id'))
    ]);
    expect(r1).toBeNull();
    expect(r2).toBe(7);
    expect(r3).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// Regression safety — boundary and documented edge values
// ---------------------------------------------------------------------------

describe('regression safety', () => {
  it('MAX_SAFE_INTEGER (9007199254740991) is accepted, not rejected', () => {
    expect(
      normalizeRequiredNumericId('9007199254740991', 'Node ID', '--node-id')
    ).toBe(9007199254740991);
  });

  it('9007199254740992 is always rejected with INVALID_NUMERIC_ID', () => {
    for (let i = 0; i < 3; i++) {
      let thrown: unknown;
      try {
        normalizeRequiredNumericId('9007199254740992', 'Node ID', '--node-id');
      } catch (err) {
        thrown = err;
      }
      expect((thrown as CliError).code).toBe('INVALID_NUMERIC_ID');
    }
  });

  it('normalizeRequiredString preserves a string of exactly one character', () => {
    expect(normalizeRequiredString('x', 'Label', '--flag')).toBe('x');
  });

  it('normalizeBillingType is deterministic across repeated calls', () => {
    const allowed = ['hourly', 'committed'] as const;
    for (let i = 0; i < 5; i++) {
      expect(normalizeBillingType('HOURLY', allowed, 'hourly')).toBe('hourly');
    }
  });

  it('normalizeOptionalNumericId returning null does not affect subsequent calls', () => {
    const first = normalizeOptionalNumericId(undefined, 'Node ID', '--node-id');
    const second = normalizeOptionalNumericId('5', 'Node ID', '--node-id');
    expect(first).toBeNull();
    expect(second).toBe(5);
  });
});
