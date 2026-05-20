import {
  assertEmail,
  assertEnum,
  assertNonEmptyTrimmed,
  assertPositiveInteger,
  detectMimeType,
  normalizeCcEmails,
  normalizeOptionalInteger,
  normalizeOptionalString,
  parseCategoryFilter,
  parseContactContext,
  parseCsvList,
  parsePriorityFilter,
  parseResourceSpec,
  parseResources,
  parseStatusFilter,
  readAndEncodeAttachments
} from '../../../src/support-ticket/normalizers.js';
import { VALID_PRIORITIES } from '../../../src/support-ticket/constants.js';

describe('assertPositiveInteger', () => {
  it('parses a positive integer string and returns the numeric value', () => {
    expect(assertPositiveInteger('  42 ', '--page-no')).toBe(42);
  });

  it('rejects zero, negatives, decimals, and non-digit input', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '']) {
      expect(() => assertPositiveInteger(value, '--page-no')).toThrowError(
        /must be a positive integer/
      );
    }
  });

  it('phrases the suggestion differently for positional arguments', () => {
    try {
      assertPositiveInteger('abc', '<ticketId>');
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_INTEGER_INPUT',
        suggestion: expect.stringContaining('Pass a positive integer as')
      });
    }
  });
});

describe('assertNonEmptyTrimmed', () => {
  it('trims surrounding whitespace and returns the cleaned value', () => {
    expect(assertNonEmptyTrimmed('  hello  ', '--subject', 10)).toBe('hello');
  });

  it('rejects strings that are empty after trimming', () => {
    expect(() => assertNonEmptyTrimmed('   ', '--subject', 10)).toThrowError(
      /must not be empty/
    );
  });

  it('rejects strings longer than the configured maxLength', () => {
    expect(() => assertNonEmptyTrimmed('abcdef', '--subject', 3)).toThrowError(
      /3 characters or fewer/
    );
  });
});

describe('assertEnum', () => {
  it('matches case-insensitively and returns the canonical value', () => {
    expect(assertEnum('high', VALID_PRIORITIES, '--priority')).toBe('High');
  });

  it('rejects values that are not in the allowed list', () => {
    expect(() =>
      assertEnum('Critical', VALID_PRIORITIES, '--priority')
    ).toThrowError(/Unsupported value/);
  });
});

describe('assertEmail', () => {
  it('accepts valid emails and trims surrounding whitespace', () => {
    expect(assertEmail('  me@example.com  ', '--contact-email')).toBe(
      'me@example.com'
    );
  });

  it('rejects malformed emails', () => {
    expect(() => assertEmail('not-an-email', '--contact-email')).toThrowError(
      /valid email/
    );
  });
});

describe('normalizeCcEmails', () => {
  it('returns undefined when no values are provided', () => {
    expect(normalizeCcEmails(undefined)).toBeUndefined();
    expect(normalizeCcEmails([])).toBeUndefined();
    expect(normalizeCcEmails(['   ', '\t'])).toBeUndefined();
  });

  it('trims and keeps valid email addresses', () => {
    expect(normalizeCcEmails(['a@b.co', '  c@d.io  '])).toEqual([
      'a@b.co',
      'c@d.io'
    ]);
  });

  it('throws when any entry is not a valid email', () => {
    expect(() => normalizeCcEmails(['a@b.co', 'nope'])).toThrowError(
      /valid email/
    );
  });
});

describe('normalizeOptionalString', () => {
  it('returns undefined for null/undefined/empty-after-trim values', () => {
    expect(normalizeOptionalString(null)).toBeUndefined();
    expect(normalizeOptionalString(undefined)).toBeUndefined();
    expect(normalizeOptionalString('   ')).toBeUndefined();
  });

  it('coerces finite numbers to string', () => {
    expect(normalizeOptionalString(7)).toBe('7');
    expect(normalizeOptionalString(0)).toBe('0');
  });

  it('returns undefined for non-finite numbers', () => {
    expect(normalizeOptionalString(Number.NaN)).toBeUndefined();
    expect(normalizeOptionalString(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('trims strings', () => {
    expect(normalizeOptionalString('  hi  ')).toBe('hi');
  });
});

describe('normalizeOptionalInteger', () => {
  it('keeps integer values and rejects everything else', () => {
    expect(normalizeOptionalInteger(7)).toBe(7);
    expect(normalizeOptionalInteger(0)).toBe(0);
    expect(normalizeOptionalInteger(1.5)).toBeNull();
    expect(normalizeOptionalInteger('7')).toBeNull();
    expect(normalizeOptionalInteger(null)).toBeNull();
  });
});

describe('parseCsvList', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(parseCsvList('  a, ,b  ,c', '--category')).toEqual(['a', 'b', 'c']);
  });

  it('throws when no non-empty items remain', () => {
    expect(() => parseCsvList(' , , ', '--category')).toThrowError(
      /must not be empty/
    );
  });
});

describe('parseCategoryFilter', () => {
  it('returns all-undefined when no value is passed', () => {
    expect(parseCategoryFilter(undefined)).toEqual({
      abuseTicket: false,
      category: undefined,
      socTicket: false
    });
  });

  it('splits SOC/Abuse into boolean flags and dedupes standard categories', () => {
    expect(parseCategoryFilter('Cloud,SOC,Abuse,billing,cloud')).toEqual({
      abuseTicket: true,
      category: 'Cloud,Billing',
      socTicket: true
    });
  });

  it('returns category undefined when only SOC/Abuse are passed', () => {
    expect(parseCategoryFilter('SOC,Abuse')).toEqual({
      abuseTicket: true,
      category: undefined,
      socTicket: true
    });
  });

  it('rejects unknown category values', () => {
    expect(() => parseCategoryFilter('NotACategory')).toThrowError(
      /Unsupported value for --category/
    );
  });
});

describe('parseStatusFilter and parsePriorityFilter', () => {
  it('expands the open/resolved/urgent presets', () => {
    expect(parseStatusFilter('  Open ')).toBe(
      'Open,On Hold,Waiting on Customer,Escalated'
    );
    expect(parseStatusFilter('resolved')).toBe('Resolved,Closed');
    expect(parsePriorityFilter('URGENT')).toBe('High,Medium');
  });

  it('accepts raw CSV lists and validates each entry', () => {
    expect(parseStatusFilter('Open,Closed')).toBe('Open,Closed');
    expect(parsePriorityFilter('High,Low')).toBe('High,Low');
  });

  it('returns undefined when no value is passed', () => {
    expect(parseStatusFilter(undefined)).toBeUndefined();
    expect(parsePriorityFilter(undefined)).toBeUndefined();
  });

  it('rejects values not in the enum', () => {
    expect(() => parseStatusFilter('bogus')).toThrowError(/Unsupported value/);
    expect(() => parsePriorityFilter('Critical')).toThrowError(
      /Unsupported value/
    );
  });
});

describe('parseResourceSpec and parseResources', () => {
  it('parses id:name and id:name:ip forms', () => {
    expect(parseResourceSpec('2464:node-a')).toEqual({
      id: '2464',
      name: 'node-a'
    });
    expect(parseResourceSpec('2464:node-a:10.0.0.1')).toEqual({
      id: '2464',
      ip_address: '10.0.0.1',
      name: 'node-a'
    });
  });

  it('rejects empty, short, or long specs', () => {
    expect(() => parseResourceSpec('   ')).toThrowError(/must not be empty/);
    expect(() => parseResourceSpec('just-a-name')).toThrowError(
      /Invalid --resource value/
    );
    expect(() => parseResourceSpec('1:n:ip:extra')).toThrowError(
      /Invalid --resource value/
    );
  });

  it('rejects specs with empty id or name segments via the suggestion', () => {
    for (const value of [':node', '1:']) {
      try {
        parseResourceSpec(value);
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toMatchObject({
          code: 'INVALID_RESOURCE_INPUT',
          suggestion: 'Both id and name segments must be non-empty.'
        });
      }
    }
  });

  it('parseResources returns an empty array when input is undefined', () => {
    expect(parseResources(undefined)).toEqual([]);
  });

  it('parseResources maps each entry', () => {
    expect(parseResources(['1:a', '2:b:9.9.9.9'])).toEqual([
      { id: '1', name: 'a' },
      { id: '2', ip_address: '9.9.9.9', name: 'b' }
    ]);
  });
});

describe('parseContactContext', () => {
  it('returns undefined for both fields when neither is provided', () => {
    expect(parseContactContext({})).toEqual({
      contactEmail: undefined,
      contactType: undefined
    });
  });

  it('trims the email and canonicalises the contact type case-insensitively', () => {
    expect(
      parseContactContext({
        contactEmail: '  me@example.com  ',
        contactType: 'technical lead'
      })
    ).toEqual({
      contactEmail: 'me@example.com',
      contactType: 'Technical Lead'
    });
  });

  it('rejects malformed emails and unknown contact types', () => {
    expect(() =>
      parseContactContext({ contactEmail: 'not-an-email' })
    ).toThrowError(/valid email/);
    expect(() => parseContactContext({ contactType: 'owner' })).toThrowError(
      /Unsupported value/
    );
  });
});

describe('detectMimeType', () => {
  it('maps known extensions and falls back to octet-stream', () => {
    expect(detectMimeType('foo.PDF')).toBe('application/pdf');
    expect(detectMimeType('bar.jpg')).toBe('image/jpeg');
    expect(detectMimeType('baz.JPEG')).toBe('image/jpeg');
    expect(detectMimeType('quux.png')).toBe('application/octet-stream');
    expect(detectMimeType('noext')).toBe('application/octet-stream');
  });
});

describe('readAndEncodeAttachments', () => {
  it('returns undefined when no paths are supplied', async () => {
    await expect(
      readAndEncodeAttachments(undefined, () =>
        Promise.resolve(Buffer.alloc(0))
      )
    ).resolves.toBeUndefined();
    await expect(
      readAndEncodeAttachments([], () => Promise.resolve(Buffer.alloc(0)))
    ).resolves.toBeUndefined();
  });

  it('rejects more than 5 attachments before reading any', async () => {
    const read = vi.fn();
    await expect(
      readAndEncodeAttachments(
        ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf', 'e.pdf', 'f.pdf'],
        read as never
      )
    ).rejects.toMatchObject({ code: 'TOO_MANY_ATTACHMENTS' });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects blank-only paths', async () => {
    await expect(
      readAndEncodeAttachments(['   '], () => Promise.resolve(Buffer.alloc(0)))
    ).rejects.toMatchObject({ code: 'EMPTY_STRING_INPUT' });
  });

  it('rejects unsupported extensions', async () => {
    await expect(
      readAndEncodeAttachments(['/tmp/notes.txt'], () =>
        Promise.resolve(Buffer.alloc(0))
      )
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_ATTACHMENT_TYPE' });
  });

  it('wraps file read failures with the path and original cause', async () => {
    const cause = new Error('boom');
    await expect(
      readAndEncodeAttachments(['/tmp/x.pdf'], () => Promise.reject(cause))
    ).rejects.toMatchObject({
      cause,
      code: 'ATTACHMENT_READ_FAILED'
    });
  });

  it('rejects files exceeding the 5MB per-file limit', async () => {
    await expect(
      readAndEncodeAttachments(['/tmp/big.pdf'], () =>
        Promise.resolve(Buffer.alloc(5 * 1024 * 1024 + 1))
      )
    ).rejects.toMatchObject({ code: 'ATTACHMENT_TOO_LARGE' });
  });

  it('strips parent paths from the file name and base64-encodes the payload', async () => {
    const result = await readAndEncodeAttachments(
      ['/some/nested/dir/report.pdf'],
      () => Promise.resolve(Buffer.from('hello', 'utf8'))
    );

    expect(result?.fileNames).toEqual(['report.pdf']);
    expect(result?.imagedata).toEqual(['data:application/pdf;base64,aGVsbG8=']);
  });

  it('also strips windows-style separators', async () => {
    const result = await readAndEncodeAttachments(
      ['C:\\Users\\me\\photo.jpg'],
      () => Promise.resolve(Buffer.from([0xff, 0xd8, 0xff]))
    );

    expect(result?.fileNames).toEqual(['photo.jpg']);
    expect(result?.imagedata[0]).toBe('data:image/jpeg;base64,/9j/');
  });
});
