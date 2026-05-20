import { resolveStoredCredentials } from '../config/index.js';
import { CliError, EXIT_CODES } from '../core/errors.js';
import type { SupportTicketClient } from './client.js';
import {
  CATEGORIES_REQUIRING_COMPONENT,
  CATEGORIES_REQUIRING_PRIORITY,
  COMMENT_MAX_LENGTH,
  DEFAULT_CHANNEL,
  DESCRIPTION_MAX_LENGTH,
  SUBJECT_MAX_LENGTH,
  THREAD_EXPANSION_CONCURRENCY,
  VALID_PRIORITIES,
  VALID_TICKET_CATEGORIES
} from './constants.js';
import {
  buildListResult,
  extractThreadText,
  isSummaryTruncated,
  normalizeSupportTicketDetail,
  normalizeSupportTicketThread
} from './mappers.js';
import {
  assertEnum,
  assertNonEmptyTrimmed,
  assertPositiveInteger,
  normalizeCcEmails,
  normalizeOptionalString,
  parseCategoryFilter,
  parseContactContext,
  parsePriorityFilter,
  parseResources,
  parseStatusFilter,
  readAndEncodeAttachments
} from './normalizers.js';
import type {
  SupportTicketCloseCommandResult,
  SupportTicketCloseOptions,
  SupportTicketContextOptions,
  SupportTicketCreateCommandResult,
  SupportTicketCreateOptions,
  SupportTicketGetCommandResult,
  SupportTicketGetOptions,
  SupportTicketListCommandResult,
  SupportTicketListOptions,
  SupportTicketPriority,
  SupportTicketRepliesCommandResult,
  SupportTicketReplyCommandResult,
  SupportTicketReplyOptions,
  SupportTicketResource,
  SupportTicketServiceDependencies
} from './types/index.js';

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
    const { contactEmail, contactType } = parseContactContext(options);
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
    const attachments = await readAndEncodeAttachments(
      options.attachment,
      (path) => this.dependencies.readAttachmentFile(path)
    );

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
    const { contactEmail, contactType } = parseContactContext(options);
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
    const { contactEmail, contactType } = parseContactContext(options);

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
    const { contactEmail, contactType } = parseContactContext(options);
    const attachments = await readAndEncodeAttachments(
      options.attachment,
      (path) => this.dependencies.readAttachmentFile(path)
    );

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
    const { contactEmail, contactType } = parseContactContext(options);
    const client = await this.createClient(options);
    const result = await client.closeTicket(normalizedTicketId, {
      comment,
      ...(contactEmail === undefined
        ? {}
        : { contact_person_email: contactEmail }),
      ...(contactType === undefined ? {} : { contact_person_type: contactType })
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
    const { contactEmail, contactType } = parseContactContext(options);
    const client = await this.createClient(options);
    const threads = await client.listReplies(normalizedTicketId, {
      ...(contactEmail === undefined
        ? {}
        : { contact_person_email: contactEmail }),
      ...(contactType === undefined ? {} : { contact_person_type: contactType })
    });

    const expandedThreads = await mapWithConcurrency(
      threads,
      THREAD_EXPANSION_CONCURRENCY,
      async (thread) => {
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
      }
    );

    return {
      action: 'replies',
      ticket_id: normalizedTicketId,
      threads: expandedThreads.map((thread) =>
        normalizeSupportTicketThread(thread)
      )
    };
  }

  private async createClient(
    options: SupportTicketContextOptions
  ): Promise<SupportTicketClient> {
    return this.dependencies.createSupportTicketClient(
      await resolveStoredCredentials(this.dependencies.store, options)
    );
  }
}

async function mapWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>
): Promise<TOut[]> {
  const results: TOut[] = new Array<TOut>(items.length);
  let nextIndex = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= items.length) {
          return;
        }
        results[current] = await worker(items[current] as TIn, current);
      }
    }
  );

  await Promise.all(runners);
  return results;
}
