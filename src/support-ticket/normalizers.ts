import { CliError, EXIT_CODES } from '../core/errors.js';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  EMAIL_PATTERN,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MIME_TYPES,
  PRIORITY_PRESETS,
  STATUS_PRESETS,
  VALID_CONTACT_PERSON_TYPES,
  VALID_FILTER_CATEGORIES,
  VALID_PRIORITIES,
  VALID_STATUSES
} from './constants.js';
import type {
  SupportTicketCategory,
  SupportTicketContactPersonType,
  SupportTicketResource
} from './types/index.js';

export interface SupportTicketContactContext {
  contactEmail: string | undefined;
  contactType: SupportTicketContactPersonType | undefined;
}

export function parseContactContext(options: {
  contactEmail?: string;
  contactType?: string;
}): SupportTicketContactContext {
  return {
    contactEmail:
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email'),
    contactType:
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          )
  };
}

export function assertPositiveInteger(value: string, flagName: string): number {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed) || trimmed === '0') {
    throw new CliError(`${flagName} must be a positive integer.`, {
      code: 'INVALID_INTEGER_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: flagName.startsWith('--')
        ? `Pass a positive integer with ${flagName}.`
        : `Pass a positive integer as ${flagName}.`
    });
  }

  return Number(trimmed);
}

export function assertNonEmptyTrimmed(
  value: string,
  flagName: string,
  maxLength: number
): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new CliError(`${flagName} must not be empty.`, {
      code: 'EMPTY_STRING_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a non-empty value with ${flagName}.`
    });
  }

  if (trimmed.length > maxLength) {
    throw new CliError(
      `${flagName} must be ${maxLength} characters or fewer.`,
      {
        code: 'STRING_INPUT_TOO_LONG',
        details: [`Received length: ${trimmed.length}`],
        exitCode: EXIT_CODES.usage,
        suggestion: `Shorten the value passed with ${flagName}.`
      }
    );
  }

  return trimmed;
}

export function assertEnum<TValue extends string>(
  value: string,
  allowed: readonly TValue[],
  flagName: string
): TValue {
  const trimmed = value.trim();
  const match = allowed.find(
    (candidate) => candidate.toLowerCase() === trimmed.toLowerCase()
  );

  if (match === undefined) {
    throw new CliError(`Unsupported value for ${flagName}: "${value}".`, {
      code: 'INVALID_ENUM_INPUT',
      details: [`Expected one of: ${allowed.join(', ')}`],
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a supported value with ${flagName}.`
    });
  }

  return match;
}

export function assertEmail(value: string, flagName: string): string {
  const trimmed = value.trim();

  if (!EMAIL_PATTERN.test(trimmed)) {
    throw new CliError(`${flagName} must be a valid email address.`, {
      code: 'INVALID_EMAIL_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a valid email address with ${flagName}.`
    });
  }

  return trimmed;
}

export function normalizeCcEmails(
  values: string[] | undefined
): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  const trimmed = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (trimmed.length === 0) {
    return undefined;
  }

  for (const email of trimmed) {
    if (!EMAIL_PATTERN.test(email)) {
      throw new CliError(`--cc must be a valid email address: "${email}".`, {
        code: 'INVALID_EMAIL_INPUT',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass valid email addresses with --cc.'
      });
    }
  }

  return trimmed;
}

export function normalizeOptionalString(
  value: string | number | null | undefined
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function normalizeOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

export function parseCsvList(value: string, flagName: string): string[] {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    throw new CliError(`${flagName} must not be empty.`, {
      code: 'EMPTY_STRING_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass a non-empty comma-separated value with ${flagName}.`
    });
  }

  return items;
}

export function parseCategoryFilter(value: string | undefined): {
  abuseTicket: boolean;
  category: string | undefined;
  socTicket: boolean;
} {
  if (value === undefined) {
    return { abuseTicket: false, category: undefined, socTicket: false };
  }

  const raw = parseCsvList(value, '--category');
  const standard: SupportTicketCategory[] = [];
  let abuse = false;
  let soc = false;

  for (const item of raw) {
    const match = VALID_FILTER_CATEGORIES.find(
      (candidate) => candidate.toLowerCase() === item.toLowerCase()
    );

    if (match === undefined) {
      throw new CliError(`Unsupported value for --category: "${item}".`, {
        code: 'INVALID_ENUM_INPUT',
        details: [`Expected one of: ${VALID_FILTER_CATEGORIES.join(', ')}`],
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass a supported value with --category.'
      });
    }

    if (match === 'Abuse') {
      abuse = true;
    } else if (match === 'SOC') {
      soc = true;
    } else if (!standard.includes(match)) {
      standard.push(match);
    }
  }

  return {
    abuseTicket: abuse,
    category: standard.length === 0 ? undefined : standard.join(','),
    socTicket: soc
  };
}

export function parseStatusFilter(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const preset = STATUS_PRESETS[value.trim().toLowerCase()];
  if (preset !== undefined) {
    return preset.join(',');
  }

  const items = parseCsvList(value, '--status');
  return items
    .map((item) => assertEnum(item, VALID_STATUSES, '--status'))
    .join(',');
}

export function parsePriorityFilter(
  value: string | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const preset = PRIORITY_PRESETS[value.trim().toLowerCase()];
  if (preset !== undefined) {
    return preset.join(',');
  }

  const items = parseCsvList(value, '--priority');
  return items
    .map((item) => assertEnum(item, VALID_PRIORITIES, '--priority'))
    .join(',');
}

export function parseResources(
  values: string[] | undefined
): SupportTicketResource[] {
  if (values === undefined) {
    return [];
  }

  return values.map((raw) => parseResourceSpec(raw));
}

export function parseResourceSpec(value: string): SupportTicketResource {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new CliError('--resource must not be empty.', {
      code: 'EMPTY_STRING_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass --resource <id:name[:ip]>.'
    });
  }

  const parts = trimmed.split(':').map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    throw new CliError(`Invalid --resource value: "${value}".`, {
      code: 'INVALID_RESOURCE_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Format is id:name or id:name:ip_address.'
    });
  }

  const [id, name, ip] = parts;
  if (
    id === undefined ||
    id.length === 0 ||
    name === undefined ||
    name.length === 0
  ) {
    throw new CliError(`Invalid --resource value: "${value}".`, {
      code: 'INVALID_RESOURCE_INPUT',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Both id and name segments must be non-empty.'
    });
  }

  return {
    id,
    ...(ip === undefined || ip.length === 0 ? {} : { ip_address: ip }),
    name
  };
}

export interface AttachmentPayload {
  fileNames: string[];
  imagedata: string[];
}

export async function readAndEncodeAttachments(
  paths: string[] | undefined,
  readFile: (path: string) => Promise<Buffer>
): Promise<AttachmentPayload | undefined> {
  if (paths === undefined || paths.length === 0) {
    return undefined;
  }

  if (paths.length > MAX_ATTACHMENT_COUNT) {
    throw new CliError(
      `--attachment accepts at most ${MAX_ATTACHMENT_COUNT} files.`,
      {
        code: 'TOO_MANY_ATTACHMENTS',
        details: [`Received: ${paths.length}`],
        exitCode: EXIT_CODES.usage,
        suggestion: `Pass no more than ${MAX_ATTACHMENT_COUNT} --attachment flags.`
      }
    );
  }

  const fileNames: string[] = [];
  const imagedata: string[] = [];

  for (const rawPath of paths) {
    const trimmed = rawPath.trim();
    if (trimmed.length === 0) {
      throw new CliError('--attachment path must not be empty.', {
        code: 'EMPTY_STRING_INPUT',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Pass --attachment <path-to-file>.'
      });
    }

    const baseName = trimmed.split(/[\\/]/).pop() ?? trimmed;
    const extension = baseName.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      throw new CliError(
        `--attachment "${trimmed}" must be a .jpg, .jpeg, or .pdf file.`,
        {
          code: 'UNSUPPORTED_ATTACHMENT_TYPE',
          exitCode: EXIT_CODES.usage,
          suggestion: 'Convert the file or pick a supported format.'
        }
      );
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(trimmed);
    } catch (cause) {
      throw new CliError(`Unable to read attachment: "${trimmed}".`, {
        cause,
        code: 'ATTACHMENT_READ_FAILED',
        exitCode: EXIT_CODES.usage,
        suggestion: 'Check the path and read permissions.'
      });
    }

    if (buffer.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new CliError(
        `--attachment "${trimmed}" exceeds the 5 MB per-file limit.`,
        {
          code: 'ATTACHMENT_TOO_LARGE',
          details: [`File size: ${buffer.byteLength} bytes`],
          exitCode: EXIT_CODES.usage,
          suggestion: 'Compress the file or attach a smaller one.'
        }
      );
    }

    const mimeType = detectMimeType(baseName);
    fileNames.push(baseName);
    imagedata.push(`data:${mimeType};base64,${buffer.toString('base64')}`);
  }

  return { fileNames, imagedata };
}

export function detectMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}
