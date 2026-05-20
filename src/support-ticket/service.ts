import {
  resolveStoredCredentials,
  type ConfigFile,
  type ResolvedCredentials
} from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { SupportTicketClient, SupportTicketListPage } from './client.js';
import type {
  SupportTicketCategory,
  SupportTicketContactPersonType,
  SupportTicketDetail,
  SupportTicketFilterCategory,
  SupportTicketPriority,
  SupportTicketResource,
  SupportTicketStatus,
  SupportTicketSummary,
  SupportTicketThread
} from './types.js';

const VALID_TICKET_CATEGORIES: readonly SupportTicketCategory[] = [
  'Billing',
  'Cloud',
  'Network',
  'Sales'
];

const VALID_FILTER_CATEGORIES: readonly SupportTicketFilterCategory[] = [
  'Abuse',
  'Billing',
  'Cloud',
  'Network',
  'SOC',
  'Sales'
];

const VALID_PRIORITIES: readonly SupportTicketPriority[] = [
  'High',
  'Low',
  'Medium'
];

const VALID_STATUSES: readonly SupportTicketStatus[] = [
  'Closed',
  'Escalated',
  'New',
  'On Hold',
  'Open',
  'Resolved',
  'Waiting on Customer'
];

const STATUS_PRESETS: Record<string, readonly SupportTicketStatus[]> = {
  open: ['Open', 'On Hold', 'Waiting on Customer', 'Escalated'],
  resolved: ['Resolved', 'Closed']
};

const PRIORITY_PRESETS: Record<string, readonly SupportTicketPriority[]> = {
  urgent: ['High', 'Medium']
};

const DEFAULT_CHANNEL = 'Web';
const CATEGORIES_REQUIRING_COMPONENT: ReadonlySet<SupportTicketCategory> =
  new Set(['Billing', 'Cloud']);
const CATEGORIES_REQUIRING_PRIORITY: ReadonlySet<SupportTicketCategory> =
  new Set(['Billing', 'Cloud']);

const VALID_CONTACT_PERSON_TYPES: readonly SupportTicketContactPersonType[] = [
  'Admin',
  'Billing',
  'Manager',
  'Technical Lead'
];

const SUBJECT_MAX_LENGTH = 256;
const DESCRIPTION_MAX_LENGTH = 6000;
const COMMENT_MAX_LENGTH = 6000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ATTACHMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpeg',
  'jpg',
  'pdf'
]);
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;

export interface SupportTicketContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface SupportTicketListOptions extends SupportTicketContextOptions {
  category?: string;
  contactEmail?: string;
  contactType?: string;
  pageNo?: string;
  perPage?: string;
  priority?: string;
  status?: string;
  year?: string;
}

export interface SupportTicketCreateOptions extends SupportTicketContextOptions {
  attachment?: string[];
  cc?: string[];
  channel?: string;
  component?: string;
  contactEmail?: string;
  contactType?: string;
  department: string;
  description: string;
  isPriorityTicket?: boolean;
  priority?: string;
  resource?: string[];
  subject: string;
  ticketCategory: string;
}

export interface SupportTicketGetOptions extends SupportTicketContextOptions {
  contactEmail?: string;
  contactType?: string;
}

export interface SupportTicketReplyOptions extends SupportTicketContextOptions {
  abuseTicket?: boolean;
  attachment?: string[];
  channel?: string;
  comment: string;
  contactEmail?: string;
  contactType?: string;
}

export interface SupportTicketCloseOptions extends SupportTicketContextOptions {
  comment: string;
  contactEmail?: string;
  contactType?: string;
}

export interface SupportTicketItem {
  assignee_id: string | null;
  attachment_count: number | null;
  category: string | null;
  channel: string | null;
  comment_count: number | null;
  contact_id: string | null;
  created_at: string | null;
  creator_email: string | null;
  customer_id: number | null;
  department: string | null;
  department_id: string | null;
  description: string | null;
  due_date: string | null;
  email: string | null;
  emails_cc_on_ticket: string[];
  id: number;
  is_priority_ticket: boolean;
  priority: string | null;
  reply_option: boolean | null;
  status: string | null;
  sub_category: string | null;
  subject: string | null;
  task_count: number | null;
  ticket_category: string | null;
  ticket_id: string | null;
  ticket_number: string | null;
  updated_at: string | null;
}

export interface SupportTicketDetailItem extends SupportTicketItem {
  crn: string | null;
  customer_type: string | null;
}

export interface SupportTicketListCommandResult {
  account_manager: string | null;
  action: 'list';
  items: SupportTicketItem[];
  page: {
    open_count: number | null;
    page_no: number | null;
    per_page: number | null;
    resolved_count: number | null;
    total_pages: number | null;
    total_records: number | null;
    urgent_count: number | null;
  };
}

export interface SupportTicketGetCommandResult {
  account_manager: string | null;
  action: 'get';
  ticket: SupportTicketDetailItem;
}

export interface SupportTicketCreateCommandResult {
  action: 'create';
  ticket: SupportTicketDetailItem;
}

export interface SupportTicketReplyCommandResult {
  action: 'reply';
  message: string;
  ticket_id: number;
}

export interface SupportTicketCloseCommandResult {
  action: 'close';
  message: string;
  ticket_id: number;
}

export interface SupportTicketAttachmentItem {
  download_url: string | null;
  file_name: string;
}

export interface SupportTicketThreadItem {
  attachments: SupportTicketAttachmentItem[];
  author_email: string | null;
  author_name: string | null;
  author_type: string | null;
  can_reply: boolean;
  channel: string | null;
  cc: string | null;
  content_type: string | null;
  created_time: string | null;
  direction: 'in' | 'out' | null;
  id: string;
  is_description_thread: boolean;
  summary: string | null;
  to: string | null;
  visibility: 'private' | 'public' | null;
}

export interface SupportTicketRepliesCommandResult {
  action: 'replies';
  threads: SupportTicketThreadItem[];
  ticket_id: number;
}

export type SupportTicketCommandResult =
  | SupportTicketCloseCommandResult
  | SupportTicketCreateCommandResult
  | SupportTicketGetCommandResult
  | SupportTicketListCommandResult
  | SupportTicketRepliesCommandResult
  | SupportTicketReplyCommandResult;

interface SupportTicketStore {
  readonly configPath: string;
  read(): Promise<ConfigFile>;
}

export interface SupportTicketServiceDependencies {
  createSupportTicketClient(
    credentials: ResolvedCredentials
  ): SupportTicketClient;
  readAttachmentFile(path: string): Promise<Buffer>;
  store: SupportTicketStore;
}

export class SupportTicketService {
  constructor(
    private readonly dependencies: SupportTicketServiceDependencies
  ) {}

  async createTicket(
    options: SupportTicketCreateOptions
  ): Promise<SupportTicketCreateCommandResult> {
    const subject = assertNonEmptyTrimmed(
      options.subject,
      '--subject',
      SUBJECT_MAX_LENGTH
    );
    const description = assertNonEmptyTrimmed(
      options.description,
      '--description',
      DESCRIPTION_MAX_LENGTH
    );
    const department = assertPositiveInteger(
      options.department,
      '--department'
    );
    const ticketCategory = assertEnum(
      options.ticketCategory,
      VALID_TICKET_CATEGORIES,
      '--ticket-category'
    );
    const priority =
      options.priority === undefined
        ? undefined
        : assertEnum(options.priority, VALID_PRIORITIES, '--priority');
    const contactType =
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          );
    const contactEmail =
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email');
    const ccEmails = normalizeCcEmails(options.cc);
    const component = normalizeOptionalString(options.component);
    const channel = normalizeOptionalString(options.channel) ?? DEFAULT_CHANNEL;
    const resources = parseResources(options.resource);

    const isSales = ticketCategory === 'Sales';
    if (CATEGORIES_REQUIRING_COMPONENT.has(ticketCategory) && !component) {
      throw new CliError(
        `--component is required when --ticket-category is ${ticketCategory}.`,
        {
          code: 'MISSING_REQUIRED_INPUT',
          exitCode: EXIT_CODES.usage,
          suggestion: `Pass --component for ${ticketCategory} tickets.`
        }
      );
    }
    if (
      CATEGORIES_REQUIRING_PRIORITY.has(ticketCategory) &&
      priority === undefined
    ) {
      throw new CliError(
        `--priority is required when --ticket-category is ${ticketCategory}.`,
        {
          code: 'MISSING_REQUIRED_INPUT',
          exitCode: EXIT_CODES.usage,
          suggestion: `Pass --priority (High, Medium, or Low) for ${ticketCategory} tickets.`
        }
      );
    }
    if (
      ticketCategory !== 'Cloud' &&
      options.resource !== undefined &&
      options.resource.length > 0
    ) {
      throw new CliError(
        `--resource is only supported for Cloud tickets, not ${ticketCategory}.`,
        {
          code: 'INVALID_INPUT_COMBINATION',
          exitCode: EXIT_CODES.usage,
          suggestion: `Drop --resource when --ticket-category is ${ticketCategory}.`
        }
      );
    }

    const componentField = isSales ? '' : component;
    const resourceField: SupportTicketResource[] | null =
      ticketCategory === 'Cloud' && resources.length > 0 ? resources : null;
    const priorityField: SupportTicketPriority | null | undefined = isSales
      ? null
      : priority;
    const attachments = await this.readAttachments(options.attachment);

    const client = await this.createClient(options);
    const ticket = await client.createTicket({
      cc_email_list: ccEmails ?? [],
      channel,
      ...(componentField === undefined ? {} : { component: componentField }),
      contact_person_email: contactEmail ?? '',
      contact_person_type: contactType ?? '',
      department,
      description,
      file_name: attachments?.fileNames ?? [],
      imagedata: attachments?.imagedata ?? [],
      ...(options.isPriorityTicket === undefined
        ? {}
        : { is_priority_ticket: options.isPriorityTicket }),
      ...(priorityField === undefined ? {} : { priority: priorityField }),
      resource: resourceField,
      subject,
      ticket_category: ticketCategory
    });

    return {
      action: 'create',
      ticket: normalizeSupportTicketDetail(ticket)
    };
  }

  async getTicket(
    ticketId: string,
    options: SupportTicketGetOptions
  ): Promise<SupportTicketGetCommandResult> {
    const normalizedTicketId = assertPositiveInteger(ticketId, '<ticketId>');
    const contactEmail =
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email');
    const contactType =
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          );
    const client = await this.createClient(options);
    const { account_manager, ticket } = await client.getTicket(
      normalizedTicketId,
      {
        ...(contactEmail === undefined
          ? {}
          : { contact_person_email: contactEmail }),
        ...(contactType === undefined
          ? {}
          : { contact_person_type: contactType })
      }
    );

    return {
      account_manager,
      action: 'get',
      ticket: normalizeSupportTicketDetail(ticket)
    };
  }

  async listTickets(
    options: SupportTicketListOptions
  ): Promise<SupportTicketListCommandResult> {
    const pageNo =
      options.pageNo === undefined
        ? undefined
        : assertPositiveInteger(options.pageNo, '--page-no');
    const perPage =
      options.perPage === undefined
        ? undefined
        : assertPositiveInteger(options.perPage, '--per-page');
    const year =
      options.year === undefined
        ? undefined
        : assertPositiveInteger(options.year, '--year');
    const { category, abuseTicket, socTicket } = parseCategoryFilter(
      options.category
    );
    const status = parseStatusFilter(options.status);
    const priority = parsePriorityFilter(options.priority);
    const contactEmail =
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email');
    const contactType =
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          );

    const client = await this.createClient(options);
    const page = await client.listTickets({
      ...(abuseTicket ? { abuseTicket: true } : {}),
      ...(category === undefined ? {} : { category }),
      ...(contactEmail === undefined ? {} : { contactEmail }),
      ...(contactType === undefined ? {} : { contactType }),
      ...(pageNo === undefined ? {} : { pageNo }),
      ...(perPage === undefined ? {} : { perPage }),
      ...(priority === undefined ? {} : { priority }),
      ...(socTicket ? { socTicket: true } : {}),
      ...(status === undefined ? {} : { status }),
      ...(year === undefined ? {} : { year })
    });

    return buildListResult(page);
  }

  async replyTicket(
    ticketId: string,
    options: SupportTicketReplyOptions
  ): Promise<SupportTicketReplyCommandResult> {
    const normalizedTicketId = assertPositiveInteger(ticketId, '<ticketId>');
    const comment = assertNonEmptyTrimmed(
      options.comment,
      '--comment',
      COMMENT_MAX_LENGTH
    );
    const channel = normalizeOptionalString(options.channel);
    const contactEmail =
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email');
    const contactType =
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          );
    const attachments = await this.readAttachments(options.attachment);

    const client = await this.createClient(options);
    const result = await client.replyTicket(normalizedTicketId, {
      abuse_ticket: options.abuseTicket ?? false,
      ...(channel === undefined ? {} : { channel }),
      comment,
      contact_person_email: contactEmail ?? '',
      contact_person_type: contactType ?? '',
      ...(attachments === undefined
        ? {}
        : {
            file: `C:\\fakepath\\${attachments.fileNames[0]}`,
            file_name: attachments.fileNames,
            imagedata: attachments.imagedata
          })
    });

    return {
      action: 'reply',
      message: result.message,
      ticket_id: normalizedTicketId
    };
  }

  async closeTicket(
    ticketId: string,
    options: SupportTicketCloseOptions
  ): Promise<SupportTicketCloseCommandResult> {
    const normalizedTicketId = assertPositiveInteger(ticketId, '<ticketId>');
    const comment = assertNonEmptyTrimmed(
      options.comment,
      '--comment',
      COMMENT_MAX_LENGTH
    );
    const contactEmail =
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email');
    const contactType =
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          );
    const client = await this.createClient(options);
    const result = await client.closeTicket(normalizedTicketId, {
      comment,
      ...(contactEmail === undefined
        ? {}
        : { contact_person_email: contactEmail }),
      ...(contactType === undefined
        ? {}
        : { contact_person_type: contactType })
    });

    return {
      action: 'close',
      message: result.message,
      ticket_id: normalizedTicketId
    };
  }

  async getReplies(
    ticketId: string,
    options: SupportTicketGetOptions
  ): Promise<SupportTicketRepliesCommandResult> {
    const normalizedTicketId = assertPositiveInteger(ticketId, '<ticketId>');
    const contactEmail =
      options.contactEmail === undefined
        ? undefined
        : assertEmail(options.contactEmail, '--contact-email');
    const contactType =
      options.contactType === undefined
        ? undefined
        : assertEnum(
            options.contactType,
            VALID_CONTACT_PERSON_TYPES,
            '--contact-type'
          );
    const client = await this.createClient(options);
    const threads = await client.listReplies(normalizedTicketId, {
      ...(contactEmail === undefined
        ? {}
        : { contact_person_email: contactEmail }),
      ...(contactType === undefined
        ? {}
        : { contact_person_type: contactType })
    });

    const expandedThreads = await Promise.all(
      threads.map(async (thread) => {
        if (!isSummaryTruncated(thread.summary)) {
          return thread;
        }

        try {
          const detail = await client.getThread(normalizedTicketId, thread.id);
          const fullText = extractThreadText(detail);
          return fullText === undefined
            ? thread
            : { ...thread, summary: fullText };
        } catch {
          return thread;
        }
      })
    );

    return {
      action: 'replies',
      ticket_id: normalizedTicketId,
      threads: expandedThreads.map((thread) =>
        normalizeSupportTicketThread(thread)
      )
    };
  }

  private async readAttachments(
    paths: string[] | undefined
  ): Promise<
    { fileNames: string[]; imagedata: string[] } | undefined
  > {
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
        buffer = await this.dependencies.readAttachmentFile(trimmed);
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

  private async createClient(
    options: SupportTicketContextOptions
  ): Promise<SupportTicketClient> {
    return this.dependencies.createSupportTicketClient(
      await resolveStoredCredentials(this.dependencies.store, options)
    );
  }
}

function buildListResult(
  page: SupportTicketListPage
): SupportTicketListCommandResult {
  return {
    account_manager: page.account_manager,
    action: 'list',
    items: page.items.map((item) => normalizeSupportTicketItem(item)),
    page: {
      open_count: page.open_count,
      page_no: page.page_no,
      per_page: page.per_page,
      resolved_count: page.resolved_count,
      total_pages: page.total_pages,
      total_records: page.total_records,
      urgent_count: page.urgent_count
    }
  };
}

function normalizeSupportTicketItem(
  item: SupportTicketSummary
): SupportTicketItem {
  return {
    assignee_id: normalizeOptionalString(item.assignee_id) ?? null,
    attachment_count: normalizeOptionalInteger(item.attachment_count),
    category: normalizeOptionalString(item.category) ?? null,
    channel: normalizeOptionalString(item.channel) ?? null,
    comment_count: normalizeOptionalInteger(item.comment_count),
    contact_id: normalizeOptionalString(item.contact_id) ?? null,
    created_at: normalizeOptionalString(item.created_at) ?? null,
    creator_email: normalizeOptionalString(item.creator_email) ?? null,
    customer_id: normalizeOptionalInteger(item.customer_id),
    department: normalizeOptionalString(item.department) ?? null,
    department_id: normalizeOptionalString(item.department_id) ?? null,
    description: normalizeDescription(item.description),
    due_date: normalizeOptionalString(item.due_date) ?? null,
    email: normalizeOptionalString(item.email) ?? null,
    emails_cc_on_ticket: Array.isArray(item.emails_cc_on_ticket)
      ? item.emails_cc_on_ticket.filter(
          (email): email is string =>
            typeof email === 'string' && email.length > 0
        )
      : [],
    id: item.id,
    is_priority_ticket: item.is_priority_ticket === true,
    priority: normalizeOptionalString(item.priority) ?? null,
    reply_option:
      typeof item.reply_option === 'boolean' ? item.reply_option : null,
    status: normalizeOptionalString(item.status) ?? null,
    sub_category: normalizeOptionalString(item.sub_category) ?? null,
    subject: normalizeOptionalString(item.subject) ?? null,
    task_count: normalizeOptionalInteger(item.task_count),
    ticket_category: normalizeOptionalString(item.ticket_category) ?? null,
    ticket_id: normalizeOptionalString(item.ticket_id) ?? null,
    ticket_number: normalizeOptionalString(item.ticket_number) ?? null,
    updated_at: normalizeOptionalString(item.updated_at) ?? null
  };
}

function normalizeSupportTicketDetail(
  item: SupportTicketDetail
): SupportTicketDetailItem {
  return {
    ...normalizeSupportTicketItem(item),
    crn: normalizeOptionalString(item.crn) ?? null,
    customer_type: normalizeOptionalString(item.customer_type) ?? null
  };
}

function assertPositiveInteger(value: string, flagName: string): number {
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

function assertNonEmptyTrimmed(
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

function assertEnum<TValue extends string>(
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

function assertEmail(value: string, flagName: string): string {
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

function normalizeCcEmails(values: string[] | undefined): string[] | undefined {
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

function normalizeOptionalString(
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

function normalizeOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function parseCsvList(value: string, flagName: string): string[] {
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

function parseCategoryFilter(value: string | undefined): {
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

function parseStatusFilter(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const preset = STATUS_PRESETS[value.trim().toLowerCase()];
  if (preset !== undefined) {
    return preset.join(',');
  }

  const items = parseCsvList(value, '--status');
  return items.map((item) => assertEnum(item, VALID_STATUSES, '--status')).join(',');
}

function parsePriorityFilter(value: string | undefined): string | undefined {
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

const MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf'
};

function detectMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = htmlToText(value);
  return cleaned.length === 0 ? null : cleaned;
}

function isSummaryTruncated(summary: string | null | undefined): boolean {
  if (typeof summary !== 'string') {
    return false;
  }

  const trimmed = summary.trimEnd();
  return trimmed.endsWith('...') || trimmed.endsWith('…');
}

function extractThreadText(
  detail: { content?: string | null; plainText?: string | null }
): string | undefined {
  const fromHtml = detail.content == null ? '' : htmlToText(detail.content);
  if (fromHtml.length > 0) {
    return fromHtml;
  }

  const fromPlain =
    typeof detail.plainText === 'string' ? detail.plainText.trim() : '';
  return fromPlain.length > 0 ? fromPlain : undefined;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSupportTicketThread(
  thread: SupportTicketThread
): SupportTicketThreadItem {
  const direction = thread.direction === 'in' || thread.direction === 'out'
    ? thread.direction
    : null;
  const visibility =
    thread.visibility === 'public' || thread.visibility === 'private'
      ? thread.visibility
      : null;
  const attachments = (thread.attachment_list?.data ?? []).map((att) => ({
    download_url: normalizeOptionalString(att.download_url) ?? null,
    file_name: normalizeOptionalString(att.file_name) ?? ''
  }));

  return {
    attachments,
    author_email: normalizeOptionalString(thread.author?.email) ?? null,
    author_name: normalizeOptionalString(thread.author?.name) ?? null,
    author_type: normalizeOptionalString(thread.author?.type) ?? null,
    can_reply: thread.canReply === true,
    cc: normalizeOptionalString(thread.cc) ?? null,
    channel: normalizeOptionalString(thread.channel) ?? null,
    content_type: normalizeOptionalString(thread.contentType) ?? null,
    created_time: normalizeOptionalString(thread.createdTime) ?? null,
    direction,
    id: thread.id,
    is_description_thread: thread.isDescriptionThread === true,
    summary: normalizeOptionalString(thread.summary) ?? null,
    to: normalizeOptionalString(thread.to) ?? null,
    visibility
  };
}

function parseResources(values: string[] | undefined): SupportTicketResource[] {
  if (values === undefined) {
    return [];
  }

  return values.map((raw) => parseResourceSpec(raw));
}

function parseResourceSpec(value: string): SupportTicketResource {
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
  if (id === undefined || id.length === 0 || name === undefined || name.length === 0) {
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
