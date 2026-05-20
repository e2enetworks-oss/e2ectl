import type {
  ConfigFile,
  ResolvedCredentials
} from '../../../src/config/index.js';
import type { SupportTicketClient } from '../../../src/support-ticket/index.js';
import { SupportTicketService } from '../../../src/support-ticket/service.js';

function createConfig(): ConfigFile {
  return {
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'api-key',
        auth_token: 'auth-token',
        default_location: 'Delhi',
        default_project_id: '46429'
      }
    }
  };
}

function sampleTicketDetail() {
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

function createServiceFixture(): {
  closeTicket: ReturnType<typeof vi.fn>;
  createTicket: ReturnType<typeof vi.fn>;
  createSupportTicketClient: ReturnType<typeof vi.fn>;
  getThread: ReturnType<typeof vi.fn>;
  getTicket: ReturnType<typeof vi.fn>;
  listReplies: ReturnType<typeof vi.fn>;
  listTickets: ReturnType<typeof vi.fn>;
  readAttachmentFile: ReturnType<typeof vi.fn>;
  receivedCredentials: () => ResolvedCredentials | undefined;
  replyTicket: ReturnType<typeof vi.fn>;
  service: SupportTicketService;
} {
  const closeTicket = vi.fn();
  const createTicket = vi.fn();
  const getThread = vi.fn();
  const getTicket = vi.fn();
  const listReplies = vi.fn();
  const listTickets = vi.fn();
  const replyTicket = vi.fn();
  const readAttachmentFile = vi.fn(() =>
    Promise.resolve(Buffer.from('stub', 'utf8'))
  );
  let credentials: ResolvedCredentials | undefined;

  const supportTicketClient: SupportTicketClient = {
    closeTicket,
    createTicket,
    getThread,
    getTicket,
    listReplies,
    listTickets,
    replyTicket
  };
  const createSupportTicketClient = vi.fn(
    (resolvedCredentials: ResolvedCredentials) => {
      credentials = resolvedCredentials;
      return supportTicketClient;
    }
  );
  const service = new SupportTicketService({
    createSupportTicketClient,
    readAttachmentFile,
    store: {
      configPath: '/tmp/e2ectl-config.json',
      read: () => Promise.resolve(createConfig())
    }
  });

  return {
    closeTicket,
    createTicket,
    createSupportTicketClient,
    getThread,
    getTicket,
    listReplies,
    listTickets,
    readAttachmentFile,
    receivedCredentials: () => credentials,
    replyTicket,
    service
  };
}

describe('SupportTicketService', () => {
  it('lists tickets using resolved saved defaults and normalizes fields', async () => {
    const { listTickets, receivedCredentials, service } =
      createServiceFixture();

    listTickets.mockResolvedValue({
      account_manager: 'Asha Iyer',
      items: [sampleTicketDetail()],
      open_count: 7,
      page_no: 1,
      per_page: 25,
      resolved_count: 50,
      total_pages: 3,
      total_records: 57,
      urgent_count: 2
    });

    const result = await service.listTickets({ alias: 'prod' });

    expect(receivedCredentials()).toMatchObject({
      alias: 'prod',
      location: 'Delhi',
      project_id: '46429'
    });
    expect(result.action).toBe('list');
    expect(result.account_manager).toBe('Asha Iyer');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 42,
      priority: 'High',
      status: 'Open',
      subject: 'Cannot reach my VM',
      ticket_number: 'T-100042'
    });
    expect(result.page).toEqual({
      open_count: 7,
      page_no: 1,
      per_page: 25,
      resolved_count: 50,
      total_pages: 3,
      total_records: 57,
      urgent_count: 2
    });
  });

  it('splits SOC/Abuse out of --category and forwards remaining categories as ticket_category', async () => {
    const { listTickets, service } = createServiceFixture();

    listTickets.mockResolvedValue({
      account_manager: null,
      items: [],
      open_count: null,
      page_no: null,
      per_page: null,
      resolved_count: null,
      total_pages: null,
      total_records: null,
      urgent_count: null
    });

    await service.listTickets({
      alias: 'prod',
      category: 'cloud,SOC,Abuse,billing'
    });

    expect(listTickets).toHaveBeenCalledWith({
      abuseTicket: true,
      category: 'Cloud,Billing',
      socTicket: true
    });
  });

  it('expands --status open/resolved and --priority urgent presets', async () => {
    const { listTickets, service } = createServiceFixture();

    listTickets.mockResolvedValue({
      account_manager: null,
      items: [],
      open_count: null,
      page_no: null,
      per_page: null,
      resolved_count: null,
      total_pages: null,
      total_records: null,
      urgent_count: null
    });

    await service.listTickets({
      alias: 'prod',
      priority: 'urgent',
      status: 'open',
      year: '2026'
    });

    expect(listTickets).toHaveBeenCalledWith({
      priority: 'High,Medium',
      status: 'Open,On Hold,Waiting on Customer,Escalated',
      year: 2026
    });

    await service.listTickets({ alias: 'prod', status: 'resolved' });
    expect(listTickets).toHaveBeenLastCalledWith({
      status: 'Resolved,Closed'
    });
  });

  it('passes raw CSV status/priority through with enum validation', async () => {
    const { listTickets, service } = createServiceFixture();

    listTickets.mockResolvedValue({
      account_manager: null,
      items: [],
      open_count: null,
      page_no: null,
      per_page: null,
      resolved_count: null,
      total_pages: null,
      total_records: null,
      urgent_count: null
    });

    await service.listTickets({
      alias: 'prod',
      priority: 'High,Low',
      status: 'Open,Closed'
    });

    expect(listTickets).toHaveBeenLastCalledWith({
      priority: 'High,Low',
      status: 'Open,Closed'
    });

    await expect(
      service.listTickets({ alias: 'prod', status: 'bogus' })
    ).rejects.toMatchObject({ code: 'INVALID_ENUM_INPUT' });

    await expect(
      service.listTickets({ alias: 'prod', category: 'NotACategory' })
    ).rejects.toMatchObject({ code: 'INVALID_ENUM_INPUT' });
  });

  it('forwards pageNo/perPage to the client as numbers and rejects non-positive values', async () => {
    const { listTickets, service } = createServiceFixture();

    listTickets.mockResolvedValue({
      account_manager: null,
      items: [],
      open_count: null,
      page_no: null,
      per_page: null,
      resolved_count: null,
      total_pages: null,
      total_records: null,
      urgent_count: null
    });

    await service.listTickets({ alias: 'prod', pageNo: '2', perPage: '10' });
    expect(listTickets).toHaveBeenCalledWith({ pageNo: 2, perPage: 10 });

    await expect(
      service.listTickets({ alias: 'prod', pageNo: '0' })
    ).rejects.toMatchObject({
      code: 'INVALID_INTEGER_INPUT'
    });
  });

  it('gets a ticket by numeric id and surfaces account_manager', async () => {
    const { getTicket, service } = createServiceFixture();

    getTicket.mockResolvedValue({
      account_manager: 'Asha Iyer',
      ticket: sampleTicketDetail()
    });

    const result = await service.getTicket('42', { alias: 'prod' });

    expect(getTicket).toHaveBeenCalledWith(42, {});
    expect(result.action).toBe('get');
    expect(result.account_manager).toBe('Asha Iyer');
    expect(result.ticket).toMatchObject({
      crn: null,
      customer_type: null,
      id: 42,
      subject: 'Cannot reach my VM'
    });
  });

  it('fails locally when get receives a non-numeric ticket id', async () => {
    const { getTicket, service } = createServiceFixture();

    await expect(
      service.getTicket('not-an-id', { alias: 'prod' })
    ).rejects.toMatchObject({
      code: 'INVALID_INTEGER_INPUT'
    });
    expect(getTicket).not.toHaveBeenCalled();
  });

  it('creates a Cloud ticket with required flags, trims values, and defaults channel to Web', async () => {
    const { createTicket, service } = createServiceFixture();

    createTicket.mockResolvedValue(sampleTicketDetail());

    const result = await service.createTicket({
      alias: 'prod',
      component: 'Auto Scaling',
      department: '101',
      description: '   VM is unreachable.   ',
      priority: 'High',
      resource: ['2464:node-a:10.0.0.1'],
      subject: '  Cannot reach my VM ',
      ticketCategory: 'cloud'
    });

    expect(createTicket).toHaveBeenCalledWith({
      cc_email_list: [],
      channel: 'Web',
      component: 'Auto Scaling',
      contact_person_email: '',
      contact_person_type: '',
      department: 101,
      description: 'VM is unreachable.',
      file_name: [],
      imagedata: [],
      priority: 'High',
      resource: [{ id: '2464', ip_address: '10.0.0.1', name: 'node-a' }],
      subject: 'Cannot reach my VM',
      ticket_category: 'Cloud'
    });
    expect(result.action).toBe('create');
    expect(result.ticket.id).toBe(42);
  });

  it('allows Cloud tickets without --resource (defaults to resource: null)', async () => {
    const { createTicket, service } = createServiceFixture();

    createTicket.mockResolvedValue(sampleTicketDetail());

    await service.createTicket({
      alias: 'prod',
      component: 'Auto Scaling',
      department: '1',
      description: 'desc',
      priority: 'High',
      subject: 'subj',
      ticketCategory: 'Cloud'
    });

    expect(createTicket).toHaveBeenCalledWith({
      cc_email_list: [],
      channel: 'Web',
      component: 'Auto Scaling',
      contact_person_email: '',
      contact_person_type: '',
      department: 1,
      description: 'desc',
      file_name: [],
      imagedata: [],
      priority: 'High',
      resource: null,
      subject: 'subj',
      ticket_category: 'Cloud'
    });
  });

  it('requires --priority for Cloud and Billing', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        component: 'Auto Scaling',
        department: '1',
        description: 'd',
        subject: 's',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_INPUT' });

    await expect(
      service.createTicket({
        alias: 'prod',
        component: 'Account Statement',
        department: '2',
        description: 'd',
        subject: 's',
        ticketCategory: 'Billing'
      })
    ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_INPUT' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('reads --attachment files, base64-encodes them, and sends imagedata + file_name', async () => {
    const { createTicket, readAttachmentFile, service } =
      createServiceFixture();

    createTicket.mockResolvedValue(sampleTicketDetail());
    readAttachmentFile.mockResolvedValueOnce(Buffer.from('hello', 'utf8'));

    await service.createTicket({
      alias: 'prod',
      attachment: ['/tmp/logs/report.pdf'],
      component: 'Account Statement',
      department: '2',
      description: 'd',
      priority: 'Medium',
      subject: 's',
      ticketCategory: 'Billing'
    });

    expect(readAttachmentFile).toHaveBeenCalledWith('/tmp/logs/report.pdf');
    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: ['report.pdf'],
        imagedata: ['data:application/pdf;base64,aGVsbG8=']
      })
    );
  });

  it('rejects attachments whose extension is not jpg/jpeg/pdf', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        attachment: ['/tmp/logs/error.txt'],
        component: 'Account Statement',
        department: '2',
        description: 'd',
        priority: 'Medium',
        subject: 's',
        ticketCategory: 'Billing'
      })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_ATTACHMENT_TYPE' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects attachments above 5 MB', async () => {
    const { createTicket, readAttachmentFile, service } =
      createServiceFixture();

    readAttachmentFile.mockResolvedValueOnce(Buffer.alloc(5 * 1024 * 1024 + 1));

    await expect(
      service.createTicket({
        alias: 'prod',
        attachment: ['/tmp/big.pdf'],
        component: 'Account Statement',
        department: '2',
        description: 'd',
        priority: 'Medium',
        subject: 's',
        ticketCategory: 'Billing'
      })
    ).rejects.toMatchObject({ code: 'ATTACHMENT_TOO_LARGE' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects more than 5 attachments', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        attachment: [
          '/tmp/a.pdf',
          '/tmp/b.pdf',
          '/tmp/c.pdf',
          '/tmp/d.pdf',
          '/tmp/e.pdf',
          '/tmp/f.pdf'
        ],
        component: 'Account Statement',
        department: '2',
        description: 'd',
        priority: 'Medium',
        subject: 's',
        ticketCategory: 'Billing'
      })
    ).rejects.toMatchObject({ code: 'TOO_MANY_ATTACHMENTS' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('forwards all optional create flags after validation', async () => {
    const { createTicket, service } = createServiceFixture();

    createTicket.mockResolvedValue(sampleTicketDetail());

    await service.createTicket({
      alias: 'prod',
      cc: ['cc1@example.com', '  cc2@example.com  '],
      channel: 'Web',
      component: 'Compute',
      contactEmail: 'me@example.com',
      contactType: 'technical lead',
      department: '101',
      description: 'VM is unreachable.',
      isPriorityTicket: true,
      priority: 'high',
      resource: ['2464:node-a', '2465:node-b'],
      subject: 'Cannot reach my VM',
      ticketCategory: 'Cloud'
    });

    expect(createTicket).toHaveBeenCalledWith({
      cc_email_list: ['cc1@example.com', 'cc2@example.com'],
      channel: 'Web',
      component: 'Compute',
      contact_person_email: 'me@example.com',
      contact_person_type: 'Technical Lead',
      department: 101,
      description: 'VM is unreachable.',
      file_name: [],
      imagedata: [],
      is_priority_ticket: true,
      priority: 'High',
      resource: [
        { id: '2464', name: 'node-a' },
        { id: '2465', name: 'node-b' }
      ],
      subject: 'Cannot reach my VM',
      ticket_category: 'Cloud'
    });
  });

  it('sends resource: null for Billing tickets and requires a component', async () => {
    const { createTicket, service } = createServiceFixture();

    createTicket.mockResolvedValue(sampleTicketDetail());

    await service.createTicket({
      alias: 'prod',
      component: 'Account Statement',
      department: '2',
      description: 'Need invoice for March.',
      priority: 'Medium',
      subject: 'Invoice request',
      ticketCategory: 'Billing'
    });

    expect(createTicket).toHaveBeenCalledWith({
      cc_email_list: [],
      channel: 'Web',
      component: 'Account Statement',
      contact_person_email: '',
      contact_person_type: '',
      department: 2,
      description: 'Need invoice for March.',
      file_name: [],
      imagedata: [],
      priority: 'Medium',
      resource: null,
      subject: 'Invoice request',
      ticket_category: 'Billing'
    });

    await expect(
      service.createTicket({
        alias: 'prod',
        department: '2',
        description: 'd',
        subject: 's',
        ticketCategory: 'Billing'
      })
    ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_INPUT' });
  });

  it('forces component "" / resource null / priority null for Sales tickets', async () => {
    const { createTicket, service } = createServiceFixture();

    createTicket.mockResolvedValue(sampleTicketDetail());

    await service.createTicket({
      alias: 'prod',
      cc: ['lead@example.com'],
      department: '6',
      description: 'Pricing question.',
      priority: 'High',
      subject: 'Volume pricing',
      ticketCategory: 'Sales'
    });

    expect(createTicket).toHaveBeenCalledWith({
      cc_email_list: ['lead@example.com'],
      channel: 'Web',
      component: '',
      contact_person_email: '',
      contact_person_type: '',
      department: 6,
      description: 'Pricing question.',
      file_name: [],
      imagedata: [],
      priority: null,
      resource: null,
      subject: 'Volume pricing',
      ticket_category: 'Sales'
    });
  });

  it('rejects Cloud tickets that omit --component', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        department: '1',
        description: 'd',
        priority: 'High',
        resource: ['2464:node-a'],
        subject: 's',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'MISSING_REQUIRED_INPUT' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects malformed --resource specs', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        component: 'Auto Scaling',
        department: '1',
        description: 'd',
        resource: ['just-a-name'],
        subject: 's',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESOURCE_INPUT' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects --resource when category is Sales', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        department: '6',
        description: 'd',
        resource: ['1:foo'],
        subject: 's',
        ticketCategory: 'Sales'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT_COMBINATION' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects invalid ticket-category, priority, and contact-type values locally', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        department: '101',
        description: 'desc',
        subject: 'subj',
        ticketCategory: 'cloudy'
      })
    ).rejects.toMatchObject({ code: 'INVALID_ENUM_INPUT' });

    await expect(
      service.createTicket({
        alias: 'prod',
        department: '101',
        description: 'desc',
        priority: 'critical',
        subject: 'subj',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'INVALID_ENUM_INPUT' });

    await expect(
      service.createTicket({
        alias: 'prod',
        contactType: 'owner',
        department: '101',
        description: 'desc',
        subject: 'subj',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'INVALID_ENUM_INPUT' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects empty subject/description and malformed emails locally', async () => {
    const { createTicket, service } = createServiceFixture();

    await expect(
      service.createTicket({
        alias: 'prod',
        department: '101',
        description: 'desc',
        subject: '   ',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'EMPTY_STRING_INPUT' });

    await expect(
      service.createTicket({
        alias: 'prod',
        contactEmail: 'not-an-email',
        department: '101',
        description: 'desc',
        subject: 'subj',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_INPUT' });

    await expect(
      service.createTicket({
        alias: 'prod',
        cc: ['ok@example.com', 'nope'],
        department: '101',
        description: 'desc',
        subject: 'subj',
        ticketCategory: 'Cloud'
      })
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_INPUT' });

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('posts a reply with the trimmed comment and returns the action result', async () => {
    const { replyTicket, service } = createServiceFixture();

    replyTicket.mockResolvedValue({ message: 'Reply posted.' });

    const result = await service.replyTicket('42', {
      alias: 'prod',
      comment: '  Any update?  '
    });

    expect(replyTicket).toHaveBeenCalledWith(42, {
      abuse_ticket: false,
      comment: 'Any update?',
      contact_person_email: '',
      contact_person_type: ''
    });
    expect(result).toEqual({
      action: 'reply',
      message: 'Reply posted.',
      ticket_id: 42
    });
  });

  it('rejects empty replies locally and never calls the client', async () => {
    const { replyTicket, service } = createServiceFixture();

    await expect(
      service.replyTicket('42', { alias: 'prod', comment: '   ' })
    ).rejects.toMatchObject({ code: 'EMPTY_STRING_INPUT' });

    expect(replyTicket).not.toHaveBeenCalled();
  });

  it('reply forwards contact filters, abuse_ticket, and base64-encoded attachments', async () => {
    const { readAttachmentFile, replyTicket, service } = createServiceFixture();

    replyTicket.mockResolvedValue({ message: 'Reply posted.' });
    readAttachmentFile.mockResolvedValueOnce(Buffer.from([0xff, 0xd8, 0xff]));

    await service.replyTicket('466', {
      abuseTicket: true,
      alias: 'prod',
      attachment: ['/tmp/photo.jpg'],
      comment: 'hi',
      contactEmail: 'me@example.com',
      contactType: 'Admin'
    });

    expect(replyTicket).toHaveBeenCalledWith(466, {
      abuse_ticket: true,
      comment: 'hi',
      contact_person_email: 'me@example.com',
      contact_person_type: 'Admin',
      file: 'C:\\fakepath\\photo.jpg',
      file_name: ['photo.jpg'],
      imagedata: ['data:image/jpeg;base64,/9j/']
    });
  });

  it('closes a ticket with a trimmed comment and optional contact filters', async () => {
    const { closeTicket, service } = createServiceFixture();

    closeTicket.mockResolvedValue({ message: 'Ticket closed.' });

    const result = await service.closeTicket('466', {
      alias: 'prod',
      comment: '  thanks  ',
      contactEmail: 'me@example.com',
      contactType: 'Admin'
    });

    expect(closeTicket).toHaveBeenCalledWith(466, {
      comment: 'thanks',
      contact_person_email: 'me@example.com',
      contact_person_type: 'Admin'
    });
    expect(result).toEqual({
      action: 'close',
      message: 'Ticket closed.',
      ticket_id: 466
    });
  });

  it('lists replies and normalizes the Zoho-style thread envelope', async () => {
    const { listReplies, service } = createServiceFixture();

    listReplies.mockResolvedValue([
      {
        attachment_list: {
          data: [
            {
              attachment_index: 0,
              download_url: 'https://example.com/foo.png',
              file_name: 'foo.png'
            }
          ]
        },
        author: {
          email: 'engineer@example.com',
          name: 'Engineer'
        },
        canReply: true,
        channel: 'EMAIL',
        contentType: 'text/html',
        createdTime: '2026-05-13T16:09:19.307Z',
        direction: 'out',
        id: 'thread-1',
        isDescriptionThread: false,
        summary: 'Hello',
        to: 'customer@example.com',
        visibility: 'public'
      }
    ]);

    const result = await service.getReplies('466', { alias: 'prod' });

    expect(listReplies).toHaveBeenCalledWith(466, {});
    expect(result).toMatchObject({
      action: 'replies',
      ticket_id: 466
    });
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]).toMatchObject({
      attachments: [
        { download_url: 'https://example.com/foo.png', file_name: 'foo.png' }
      ],
      author_email: 'engineer@example.com',
      author_name: 'Engineer',
      can_reply: true,
      channel: 'EMAIL',
      direction: 'out',
      id: 'thread-1',
      is_description_thread: false,
      summary: 'Hello',
      visibility: 'public'
    });
  });

  it('expands truncated thread summaries by fetching the full thread content', async () => {
    const { getThread, listReplies, service } = createServiceFixture();

    listReplies.mockResolvedValue([
      {
        author: { email: 'a@example.com', name: 'A' },
        createdTime: '2026-05-20T06:19:00.236Z',
        id: 'thread-trunc',
        isDescriptionThread: false,
        summary: 'curl https://example.com/api/v1/...'
      },
      {
        author: { email: 'b@example.com', name: 'B' },
        createdTime: '2026-05-20T06:20:00.000Z',
        id: 'thread-ok',
        isDescriptionThread: false,
        summary: 'Short and complete reply.'
      }
    ]);
    getThread.mockResolvedValue({
      content:
        '<div>curl https://example.com/api/v1/long-url<br>line2&amp;more</div>',
      id: 'thread-trunc'
    });

    const result = await service.getReplies('466', { alias: 'prod' });

    expect(getThread).toHaveBeenCalledTimes(1);
    expect(getThread).toHaveBeenCalledWith(466, 'thread-trunc');
    expect(result.threads[0]?.summary).toBe(
      'curl https://example.com/api/v1/long-url\nline2&more'
    );
    expect(result.threads[1]?.summary).toBe('Short and complete reply.');
  });

  it('falls back to the original summary if the thread detail fetch fails', async () => {
    const { getThread, listReplies, service } = createServiceFixture();

    listReplies.mockResolvedValue([
      {
        author: { email: 'a@example.com', name: 'A' },
        createdTime: '2026-05-20T06:19:00.236Z',
        id: 'thread-trunc',
        isDescriptionThread: false,
        summary: 'truncated...'
      }
    ]);
    getThread.mockRejectedValue(new Error('boom'));

    const result = await service.getReplies('466', { alias: 'prod' });

    expect(result.threads[0]?.summary).toBe('truncated...');
  });
});
