import type {
  SupportTicketCategory,
  SupportTicketContactPersonType,
  SupportTicketFilterCategory,
  SupportTicketPriority,
  SupportTicketStatus
} from './types/index.js';

export const VALID_TICKET_CATEGORIES: readonly SupportTicketCategory[] = [
  'Billing',
  'Cloud',
  'Network',
  'Sales'
];

export const VALID_FILTER_CATEGORIES: readonly SupportTicketFilterCategory[] = [
  'Abuse',
  'Billing',
  'Cloud',
  'Network',
  'SOC',
  'Sales'
];

export const VALID_PRIORITIES: readonly SupportTicketPriority[] = [
  'High',
  'Low',
  'Medium'
];

export const VALID_STATUSES: readonly SupportTicketStatus[] = [
  'Closed',
  'Escalated',
  'New',
  'On Hold',
  'Open',
  'Resolved',
  'Waiting on Customer'
];

export const STATUS_PRESETS: Record<string, readonly SupportTicketStatus[]> = {
  open: ['Open', 'On Hold', 'Waiting on Customer', 'Escalated'],
  resolved: ['Resolved', 'Closed']
};

export const PRIORITY_PRESETS: Record<
  string,
  readonly SupportTicketPriority[]
> = {
  urgent: ['High', 'Medium']
};

export const VALID_CONTACT_PERSON_TYPES: readonly SupportTicketContactPersonType[] =
  ['Admin', 'Billing', 'Manager', 'Technical Lead'];

export const DEFAULT_CHANNEL = 'Web';

export const CATEGORIES_REQUIRING_COMPONENT: ReadonlySet<SupportTicketCategory> =
  new Set(['Billing', 'Cloud']);

export const CATEGORIES_REQUIRING_PRIORITY: ReadonlySet<SupportTicketCategory> =
  new Set(['Billing', 'Cloud']);

export const SUBJECT_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 6000;
export const COMMENT_MAX_LENGTH = 250;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Subjects must be printable ASCII only (matches the frontend's
// `^[\x20-\x7E]+$` rule). Unicode-only or non-printable characters that the
// CLI would otherwise accept are rejected server-side, so we reject them here.
export const ASCII_PRINTABLE_PATTERN = /^[\x20-\x7E]+$/;

export const ALLOWED_ATTACHMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpeg',
  'jpg',
  'png',
  'pdf'
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 5;

export const THREAD_EXPANSION_CONCURRENCY = 5;

export const MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png'
};

// Calendar month bounds for the timeline `--month` filter.
export const MIN_MONTH = 1;
export const MAX_MONTH = 12;
