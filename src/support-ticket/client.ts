import type { ApiEnvelope, MyAccountTransport } from '../myaccount/index.js';

import type {
  SupportTicketCloseRequest,
  SupportTicketCreateRequest,
  SupportTicketCreateResult,
  SupportTicketDepartment,
  SupportTicketDetail,
  SupportTicketGetQuery,
  SupportTicketReopenRequest,
  SupportTicketReplyRequest,
  SupportTicketReplyResult,
  SupportTicketSummary,
  SupportTicketThread,
  SupportTicketThreadDetail,
  SupportTicketTimelineEvent,
  SupportTicketTimelineQuery
} from './types/index.js';

const TICKETS_PATH = '/ticket_management/tickets/';
const TICKETS_FILTER_PATH = '/ticket_management/tickets/filter/';
const TICKET_DETAIL_PATH = '/ticket_management/ticket/';
const TICKET_REPLY_PATH = '/ticket_management/ticket-reply/';
const TICKET_CLOSE_PATH = '/ticket_management/ticket-comment-close/';
const TICKET_REOPEN_PATH = '/ticket_management/ticket-comment-reopen/';
const TICKET_CONVERSATION_PATH = '/ticket_management/ticket-conservation/';
const TICKET_THREAD_PATH = '/ticket_management/ticket-thread-conservation/';
const TICKET_TIMELINE_PATH = '/ticket_management/ticket-timeline/';
const DEPARTMENTS_PATH = '/ticket_management/departments/';

export interface SupportTicketListPage {
  account_manager: string | null;
  items: SupportTicketSummary[];
  open_count: number | null;
  page_no: number | null;
  per_page: number | null;
  resolved_count: number | null;
  total_pages: number | null;
  total_records: number | null;
  urgent_count: number | null;
}

export interface SupportTicketListQuery {
  abuseTicket?: boolean;
  category?: string;
  contactEmail?: string;
  contactType?: string;
  pageNo?: number;
  perPage?: number;
  priority?: string;
  socTicket?: boolean;
  status?: string;
  year?: number;
}

export interface SupportTicketGetResult {
  account_manager: string | null;
  ticket: SupportTicketDetail;
}

interface SupportTicketListEnvelope extends ApiEnvelope<
  SupportTicketSummary[]
> {
  account_manager?: string | null;
  page_no?: number;
  per_page?: number;
  total_pages?: number;
  total_records?: number;
  'X-Open-Count'?: number;
  'X-Resolved-Count'?: number;
  'X-Urgent-Count'?: number;
}

interface SupportTicketDetailEnvelope extends ApiEnvelope<SupportTicketDetail> {
  account_manager?: string | null;
}

export interface SupportTicketClient {
  closeTicket(
    ticketRowId: number,
    body: SupportTicketCloseRequest
  ): Promise<SupportTicketReplyResult>;
  createTicket(
    body: SupportTicketCreateRequest
  ): Promise<SupportTicketCreateResult>;
  listDepartments(): Promise<SupportTicketDepartment[]>;
  getThread(
    ticketId: number,
    threadId: string
  ): Promise<SupportTicketThreadDetail>;
  getTicket(
    ticketId: number,
    query?: SupportTicketGetQuery
  ): Promise<SupportTicketGetResult>;
  listReplies(
    ticketId: number,
    query?: SupportTicketGetQuery
  ): Promise<SupportTicketThread[]>;
  getTimeline(
    ticketId: number,
    query?: SupportTicketTimelineQuery
  ): Promise<SupportTicketTimelineEvent[]>;
  listTickets(query?: SupportTicketListQuery): Promise<SupportTicketListPage>;
  reopenTicket(
    ticketRowId: number,
    body: SupportTicketReopenRequest
  ): Promise<SupportTicketReplyResult>;
  replyTicket(
    ticketRowId: number,
    body: SupportTicketReplyRequest
  ): Promise<SupportTicketReplyResult>;
}

export class SupportTicketApiClient implements SupportTicketClient {
  constructor(private readonly transport: MyAccountTransport) {}

  async createTicket(
    body: SupportTicketCreateRequest
  ): Promise<SupportTicketCreateResult> {
    const response = await this.transport.post<
      ApiEnvelope<SupportTicketCreateResult>
    >(TICKETS_PATH, {
      body
    });

    return response.data;
  }

  async listDepartments(): Promise<SupportTicketDepartment[]> {
    const response = await this.transport.get<
      ApiEnvelope<SupportTicketDepartment[]>
    >(DEPARTMENTS_PATH, {
      // The departments catalogue is account-global; it is not scoped to a
      // project, so do not require/append project context for this call.
      includeProjectContext: false
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async getTicket(
    ticketId: number,
    query: SupportTicketGetQuery = {}
  ): Promise<SupportTicketGetResult> {
    const response = await this.transport.get<SupportTicketDetailEnvelope>(
      `${TICKET_DETAIL_PATH}${ticketId}/`,
      {
        query: buildGetQuery(query)
      }
    );

    return {
      account_manager: normalizeNullableString(response.account_manager),
      ticket: response.data
    };
  }

  async listReplies(
    ticketId: number,
    query: SupportTicketGetQuery = {}
  ): Promise<SupportTicketThread[]> {
    const response = await this.transport.get<
      ApiEnvelope<SupportTicketThread[]>
    >(`${TICKET_CONVERSATION_PATH}${ticketId}/`, {
      query: buildGetQuery(query)
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async getThread(
    ticketId: number,
    threadId: string
  ): Promise<SupportTicketThreadDetail> {
    const response = await this.transport.get<
      ApiEnvelope<SupportTicketThreadDetail>
    >(`${TICKET_THREAD_PATH}${ticketId}/${threadId}/`);

    return response.data;
  }

  async closeTicket(
    ticketRowId: number,
    body: SupportTicketCloseRequest
  ): Promise<SupportTicketReplyResult> {
    const response = await this.transport.post<
      ApiEnvelope<{ message?: string } | null>
    >(`${TICKET_CLOSE_PATH}${ticketRowId}/`, {
      body
    });

    const dataMessage =
      typeof response.data === 'object' &&
      response.data !== null &&
      typeof response.data.message === 'string'
        ? response.data.message
        : undefined;

    return {
      message: dataMessage ?? response.message
    };
  }

  async reopenTicket(
    ticketRowId: number,
    body: SupportTicketReopenRequest
  ): Promise<SupportTicketReplyResult> {
    const response = await this.transport.post<
      ApiEnvelope<{ message?: string } | null>
    >(`${TICKET_REOPEN_PATH}${ticketRowId}/`, {
      body
    });

    const dataMessage =
      typeof response.data === 'object' &&
      response.data !== null &&
      typeof response.data.message === 'string'
        ? response.data.message
        : undefined;

    return {
      message: dataMessage ?? response.message
    };
  }

  async getTimeline(
    ticketId: number,
    query: SupportTicketTimelineQuery = {}
  ): Promise<SupportTicketTimelineEvent[]> {
    const response = await this.transport.get<
      ApiEnvelope<SupportTicketTimelineEvent[]>
    >(`${TICKET_TIMELINE_PATH}${ticketId}/`, {
      query: buildTimelineQuery(query)
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async listTickets(
    query: SupportTicketListQuery = {}
  ): Promise<SupportTicketListPage> {
    const response = await this.transport.get<SupportTicketListEnvelope>(
      TICKETS_FILTER_PATH,
      {
        query: buildListQuery(query)
      }
    );

    return {
      account_manager: normalizeNullableString(response.account_manager),
      items: response.data,
      open_count: normalizeOptionalInteger(response['X-Open-Count']),
      page_no: normalizeOptionalInteger(response.page_no),
      per_page: normalizeOptionalInteger(response.per_page),
      resolved_count: normalizeOptionalInteger(response['X-Resolved-Count']),
      total_pages: normalizeOptionalInteger(response.total_pages),
      total_records: normalizeOptionalInteger(response.total_records),
      urgent_count: normalizeOptionalInteger(response['X-Urgent-Count'])
    };
  }

  async replyTicket(
    ticketRowId: number,
    body: SupportTicketReplyRequest
  ): Promise<SupportTicketReplyResult> {
    // The reply endpoint routes SOC/Abuse tickets to their own tables based on
    // the `soc_ticket` / `abuse_ticket` flags read from the request BODY (not
    // the query string), so they must travel in the body.
    const response = await this.transport.post<
      ApiEnvelope<{ message?: string } | null>
    >(`${TICKET_REPLY_PATH}${ticketRowId}/`, {
      body: {
        ...body,
        abuse_ticket: body.abuse_ticket === true,
        soc_ticket: body.soc_ticket === true
      }
    });

    const dataMessage =
      typeof response.data === 'object' &&
      response.data !== null &&
      typeof response.data.message === 'string'
        ? response.data.message
        : undefined;

    return {
      message: dataMessage ?? response.message
    };
  }
}

function buildTimelineQuery(
  query: SupportTicketTimelineQuery
): Record<string, string | undefined> {
  return {
    month: query.month === undefined ? undefined : String(query.month),
    year: query.year === undefined ? undefined : String(query.year)
  };
}

function buildGetQuery(
  query: SupportTicketGetQuery
): Record<string, string | undefined> {
  return {
    abuse_ticket: query.abuse_ticket === true ? 'true' : undefined,
    contact_person_email: query.contact_person_email,
    contact_person_type: query.contact_person_type,
    soc_ticket: query.soc_ticket === true ? 'true' : undefined
  };
}

function buildListQuery(
  query: SupportTicketListQuery
): Record<string, string | undefined> {
  return {
    abuse_ticket: query.abuseTicket === true ? 'true' : undefined,
    contact_person_email: query.contactEmail,
    contact_person_type: query.contactType,
    page_no: query.pageNo === undefined ? undefined : String(query.pageNo),
    per_page: query.perPage === undefined ? undefined : String(query.perPage),
    priority: query.priority,
    soc_ticket: query.socTicket === true ? 'true' : undefined,
    status: query.status,
    ticket_category: query.category,
    year: query.year === undefined ? undefined : String(query.year)
  };
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
