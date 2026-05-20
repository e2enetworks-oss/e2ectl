import type {
  ApiEnvelope,
  ApiRequestOptions,
  MyAccountTransport
} from '../../../src/myaccount/index.js';
import { SupportTicketApiClient } from '../../../src/support-ticket/client.js';
import type { SupportTicketDetail } from '../../../src/support-ticket/types.js';

class StubTransport implements MyAccountTransport {
  readonly deleteMock = vi.fn();
  readonly getMock = vi.fn();
  readonly postMock = vi.fn();
  readonly requestMock = vi.fn();

  delete<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.deleteMock(path, options) as Promise<TResponse>;
  }

  get<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.getMock(path, options) as Promise<TResponse>;
  }

  post<TResponse = ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions<TResponse>, 'method' | 'path'>
  ): Promise<TResponse> {
    return this.postMock(path, options) as Promise<TResponse>;
  }

  request<TResponse = ApiEnvelope<unknown>>(
    options: ApiRequestOptions<TResponse>
  ): Promise<TResponse> {
    return this.requestMock(options) as Promise<TResponse>;
  }
}

function sampleTicket(): SupportTicketDetail {
  return {
    created_at: '2026-05-18 14:32:15',
    department: 'Cloud Support',
    department_id: '101',
    description: 'VM is unreachable.',
    id: 42,
    is_priority_ticket: false,
    priority: 'High',
    status: 'Open',
    subject: 'Cannot reach my VM',
    ticket_category: 'Cloud',
    ticket_id: 'ZD-123',
    ticket_number: 'T-100042',
    updated_at: '2026-05-18 14:32:15'
  };
}

describe('SupportTicketApiClient', () => {
  it('lists tickets and surfaces pagination + counts from the envelope', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      account_manager: 'Asha Iyer',
      code: 200,
      data: [sampleTicket()],
      errors: {},
      message: 'Success',
      page_no: 1,
      per_page: 25,
      total_pages: 3,
      total_records: 57,
      'X-Open-Count': 7,
      'X-Resolved-Count': 50,
      'X-Urgent-Count': 2
    });

    const result = await client.listTickets({ pageNo: 1, perPage: 25 });

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ticket_management/tickets/filter/',
      {
        query: {
          abuse_ticket: undefined,
          contact_person_email: undefined,
          contact_person_type: undefined,
          page_no: '1',
          per_page: '25',
          priority: undefined,
          soc_ticket: undefined,
          status: undefined,
          ticket_category: undefined,
          year: undefined
        }
      }
    );
    expect(result).toEqual({
      account_manager: 'Asha Iyer',
      items: [sampleTicket()],
      open_count: 7,
      page_no: 1,
      per_page: 25,
      resolved_count: 50,
      total_pages: 3,
      total_records: 57,
      urgent_count: 2
    });
  });

  it('omits pagination query params when not provided', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      code: 200,
      data: [],
      errors: {},
      message: 'Success'
    });

    await client.listTickets();

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ticket_management/tickets/filter/',
      {
        query: {
          abuse_ticket: undefined,
          contact_person_email: undefined,
          contact_person_type: undefined,
          page_no: undefined,
          per_page: undefined,
          priority: undefined,
          soc_ticket: undefined,
          status: undefined,
          ticket_category: undefined,
          year: undefined
        }
      }
    );
  });

  it('forwards SOC/Abuse as boolean query params and filters via ticket_category', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      code: 200,
      data: [],
      errors: {},
      message: 'Success'
    });

    await client.listTickets({
      abuseTicket: true,
      category: 'Cloud,Billing',
      contactEmail: 'me@example.com',
      contactType: 'Technical Lead',
      priority: 'High,Medium',
      socTicket: true,
      status: 'Open,On Hold',
      year: 2026
    });

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ticket_management/tickets/filter/',
      {
        query: {
          abuse_ticket: 'true',
          contact_person_email: 'me@example.com',
          contact_person_type: 'Technical Lead',
          page_no: undefined,
          per_page: undefined,
          priority: 'High,Medium',
          soc_ticket: 'true',
          status: 'Open,On Hold',
          ticket_category: 'Cloud,Billing',
          year: '2026'
        }
      }
    );
  });

  it('gets a ticket through the ticket detail path and forwards account_manager', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      account_manager: 'Asha Iyer',
      code: 200,
      data: sampleTicket(),
      errors: {},
      message: 'Success'
    });

    const result = await client.getTicket(42);

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ticket_management/ticket/42/',
      {
        query: {
          contact_person_email: undefined,
          contact_person_type: undefined
        }
      }
    );
    expect(result).toEqual({
      account_manager: 'Asha Iyer',
      ticket: sampleTicket()
    });
  });

  it('creates tickets through the tickets collection path', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.postMock.mockResolvedValue({
      code: 201,
      data: sampleTicket(),
      errors: {},
      message: 'Created'
    });

    const result = await client.createTicket({
      cc_email_list: [],
      contact_person_email: '',
      contact_person_type: '',
      department: 101,
      description: 'VM is unreachable.',
      file_name: [],
      imagedata: [],
      subject: 'Cannot reach my VM',
      ticket_category: 'Cloud'
    });

    expect(transport.postMock).toHaveBeenCalledWith(
      '/ticket_management/tickets/',
      {
        body: {
          cc_email_list: [],
          contact_person_email: '',
          contact_person_type: '',
          department: 101,
          description: 'VM is unreachable.',
          file_name: [],
          imagedata: [],
          subject: 'Cannot reach my VM',
          ticket_category: 'Cloud'
        }
      }
    );
    expect(result).toEqual(sampleTicket());
  });

  it('posts replies to the ticket-reply path and falls back to envelope message', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.postMock.mockResolvedValue({
      code: 200,
      data: null,
      errors: {},
      message: 'Reply posted.'
    });

    const result = await client.replyTicket(42, {
      abuse_ticket: false,
      comment: 'Any update?',
      contact_person_email: '',
      contact_person_type: ''
    });

    expect(transport.postMock).toHaveBeenCalledWith(
      '/ticket_management/ticket-reply/42/',
      {
        body: {
          abuse_ticket: false,
          comment: 'Any update?',
          contact_person_email: '',
          contact_person_type: ''
        },
        query: { abuse_ticket: undefined }
      }
    );
    expect(result).toEqual({ message: 'Reply posted.' });
  });

  it('routes abuse_ticket=true through the query string and keeps body abuse_ticket=false', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.postMock.mockResolvedValue({
      code: 200,
      data: null,
      errors: {},
      message: 'Reply posted.'
    });

    await client.replyTicket(42, {
      abuse_ticket: true,
      comment: 'flag this',
      contact_person_email: '',
      contact_person_type: ''
    });

    expect(transport.postMock).toHaveBeenCalledWith(
      '/ticket_management/ticket-reply/42/',
      {
        body: {
          abuse_ticket: false,
          comment: 'flag this',
          contact_person_email: '',
          contact_person_type: ''
        },
        query: { abuse_ticket: 'true' }
      }
    );
  });

  it('prefers data.message over envelope.message on reply when present', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.postMock.mockResolvedValue({
      code: 200,
      data: { message: 'Comment created.' },
      errors: {},
      message: 'Success'
    });

    const result = await client.replyTicket(42, {
      abuse_ticket: false,
      comment: 'Any update?',
      contact_person_email: '',
      contact_person_type: ''
    });

    expect(result).toEqual({ message: 'Comment created.' });
  });

  it('closes a ticket through the ticket-comment-close path', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.postMock.mockResolvedValue({
      code: 200,
      data: null,
      errors: {},
      message: 'Ticket closed.'
    });

    const result = await client.closeTicket(466, {
      comment: 'thanks',
      contact_person_email: '',
      contact_person_type: 'Admin'
    });

    expect(transport.postMock).toHaveBeenCalledWith(
      '/ticket_management/ticket-comment-close/466/',
      {
        body: {
          comment: 'thanks',
          contact_person_email: '',
          contact_person_type: 'Admin'
        }
      }
    );
    expect(result).toEqual({ message: 'Ticket closed.' });
  });

  it('lists replies through the ticket-conservation path and returns the data array', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      code: 200,
      data: [{ id: 'thread-1', summary: 'hi' }],
      errors: {},
      message: 'Success'
    });

    const result = await client.listReplies(466);

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ticket_management/ticket-conservation/466/',
      {
        query: {
          contact_person_email: undefined,
          contact_person_type: undefined
        }
      }
    );
    expect(result).toEqual([{ id: 'thread-1', summary: 'hi' }]);
  });

  it('returns an empty array when listReplies receives a non-array data field', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      code: 200,
      data: null,
      errors: {},
      message: 'Success'
    });

    const result = await client.listReplies(466);
    expect(result).toEqual([]);
  });

  it('fetches a single thread via the ticket-thread-conservation path', async () => {
    const transport = new StubTransport();
    const client = new SupportTicketApiClient(transport);

    transport.getMock.mockResolvedValue({
      code: 200,
      data: {
        content: '<div>full body</div>',
        id: 'thread-9'
      },
      errors: {},
      message: 'Success'
    });

    const result = await client.getThread(466, 'thread-9');

    expect(transport.getMock).toHaveBeenCalledWith(
      '/ticket_management/ticket-thread-conservation/466/thread-9/',
      undefined
    );
    expect(result).toEqual({
      content: '<div>full body</div>',
      id: 'thread-9'
    });
  });
});
