import { stableStringify } from '../../../src/core/json.js';
import { renderSupportTicketResult } from '../../../src/support-ticket/formatter.js';
import type {
  SupportTicketDetailItem,
  SupportTicketItem,
  SupportTicketThreadItem
} from '../../../src/support-ticket/types/index.js';

function sampleItem(
  overrides: Partial<SupportTicketItem> = {}
): SupportTicketItem {
  return {
    assignee_id: null,
    attachment_count: 0,
    category: null,
    channel: 'Web',
    comment_count: 0,
    contact_id: null,
    created_at: '2026-05-18 14:32:15',
    creator_email: 'me@example.com',
    customer_id: null,
    department: 'Cloud Support',
    department_id: '101',
    description: 'VM is unreachable.',
    due_date: null,
    email: 'me@example.com',
    emails_cc_on_ticket: [],
    id: 42,
    is_priority_ticket: false,
    priority: 'High',
    reply_option: true,
    status: 'Open',
    sub_category: null,
    subject: 'Cannot reach my VM',
    task_count: 0,
    ticket_category: 'Cloud',
    ticket_id: 'ZD-123',
    ticket_number: 'T-100042',
    updated_at: '2026-05-18 14:32:15',
    ...overrides
  };
}

function sampleDetail(
  overrides: Partial<SupportTicketDetailItem> = {}
): SupportTicketDetailItem {
  return {
    ...sampleItem(),
    crn: 'CRN-1',
    customer_type: 'Standard',
    ...overrides
  };
}

function sampleThread(
  overrides: Partial<SupportTicketThreadItem> = {}
): SupportTicketThreadItem {
  return {
    attachments: [],
    author_email: 'engineer@example.com',
    author_name: 'Engineer',
    author_type: 'AGENT',
    can_reply: true,
    cc: null,
    channel: 'EMAIL',
    content_type: 'text/html',
    created_time: '2026-05-13T16:09:19.307Z',
    direction: 'out',
    id: 'thread-1',
    is_description_thread: false,
    summary: 'Hello',
    to: 'customer@example.com',
    visibility: 'public',
    ...overrides
  };
}

describe('support-ticket formatter', () => {
  it('renders an empty list with a friendly message', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'list',
        items: [],
        page: {
          open_count: null,
          page_no: null,
          per_page: null,
          resolved_count: null,
          total_pages: null,
          total_records: null,
          urgent_count: null
        }
      },
      false
    );

    expect(output).toBe('No support tickets found.\n');
  });

  it('sorts list items by id descending and emits page + counts footer', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: 'Asha Iyer',
        action: 'list',
        items: [
          sampleItem({ id: 41, ticket_number: 'T-100041' }),
          sampleItem({ id: 42, ticket_number: 'T-100042' })
        ],
        page: {
          open_count: 7,
          page_no: 1,
          per_page: 25,
          resolved_count: 50,
          total_pages: 3,
          total_records: 57,
          urgent_count: 2
        }
      },
      false
    );

    expect(output.indexOf('T-100042')).toBeLessThan(output.indexOf('T-100041'));
    expect(output).toContain('Page 1 of 3');
    expect(output).toContain('57 total');
    expect(output).toContain('Open: 7');
    expect(output).toContain('Urgent: 2');
    expect(output).toContain('Resolved: 50');
    expect(output).toContain('Account Manager: Asha Iyer');
  });

  it('renders a create result with a next-step hint', () => {
    const output = renderSupportTicketResult(
      {
        action: 'create',
        ticket: sampleDetail()
      },
      false
    );

    expect(output).toContain('Created support ticket T-100042.');
    expect(output).toContain('ID: 42');
    expect(output).toContain('support-ticket get 42');
  });

  it('renders a get result including account manager and reply allowed flag', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: 'Asha Iyer',
        action: 'get',
        ticket: sampleDetail()
      },
      false
    );

    expect(output).toContain('Number');
    expect(output).toContain('T-100042');
    expect(output).toContain('Reply Allowed');
    expect(output).toContain('Account Manager');
    expect(output).toContain('Asha Iyer');
    expect(output).toContain('Description');
    expect(output).toContain('VM is unreachable.');
  });

  it('emits deterministic JSON for list output', () => {
    const result = {
      account_manager: null,
      action: 'list' as const,
      items: [
        sampleItem({ id: 41, ticket_number: 'T-100041' }),
        sampleItem({ id: 42, ticket_number: 'T-100042' })
      ],
      page: {
        open_count: null,
        page_no: null,
        per_page: null,
        resolved_count: null,
        total_pages: null,
        total_records: null,
        urgent_count: null
      }
    };

    const json = renderSupportTicketResult(result, true);
    const parsed = JSON.parse(json) as {
      action: string;
      items: Array<{ id: number }>;
    };

    expect(parsed.action).toBe('list');
    expect(parsed.items.map((item) => item.id)).toEqual([42, 41]);
    expect(json).toBe(renderSupportTicketResult(result, true));
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.parse(json) as unknown).toEqual(
      JSON.parse(stableStringify(parsed as never))
    );
  });

  it('emits deterministic JSON for reply output', () => {
    const json = renderSupportTicketResult(
      {
        action: 'reply',
        message: 'Reply posted.',
        ticket_id: 42
      },
      true
    );

    expect(JSON.parse(json)).toEqual({
      action: 'reply',
      message: 'Reply posted.',
      ticket_id: 42
    });
  });

  it('renders human-readable reply and close confirmations with -- when message is empty', () => {
    expect(
      renderSupportTicketResult(
        { action: 'reply', message: '', ticket_id: 42 },
        false
      )
    ).toBe('Replied to support ticket 42.\nMessage: --\n');

    expect(
      renderSupportTicketResult(
        { action: 'close', message: 'Ticket closed.', ticket_id: 99 },
        false
      )
    ).toBe('Closed support ticket 99.\nMessage: Ticket closed.\n');
  });

  it('emits deterministic JSON for close output', () => {
    const json = renderSupportTicketResult(
      { action: 'close', message: 'Ticket closed.', ticket_id: 99 },
      true
    );

    expect(JSON.parse(json)).toEqual({
      action: 'close',
      message: 'Ticket closed.',
      ticket_id: 99
    });
  });

  it('renders a human-readable replies table with attachment names', () => {
    const output = renderSupportTicketResult(
      {
        action: 'replies',
        threads: [
          sampleThread({
            attachments: [
              { download_url: 'https://x/y', file_name: 'log.txt' },
              { download_url: null, file_name: '' }
            ]
          })
        ],
        ticket_id: 466
      },
      false
    );

    expect(output).toContain('Replies on support ticket 466:');
    expect(output).toContain('Engineer <engineer@example.com>');
    expect(output).toContain('Hello');
    expect(output).toContain('log.txt');
    expect(output).toContain('--');
  });

  it('renders empty-replies message in human mode', () => {
    expect(
      renderSupportTicketResult(
        { action: 'replies', threads: [], ticket_id: 466 },
        false
      )
    ).toBe('No replies on support ticket 466.\n');
  });

  it('falls back to author_name only when email is missing, and to -- when author_name is missing', () => {
    const output = renderSupportTicketResult(
      {
        action: 'replies',
        threads: [
          sampleThread({ author_email: null, id: 't1' }),
          sampleThread({ author_email: null, author_name: null, id: 't2' })
        ],
        ticket_id: 1
      },
      false
    );

    expect(output).toContain('Engineer ');
    expect(output).toMatch(/--/);
  });

  it('emits deterministic JSON for replies output', () => {
    const json = renderSupportTicketResult(
      {
        action: 'replies',
        threads: [
          sampleThread({
            attachments: [
              { download_url: 'https://x/y', file_name: 'log.txt' }
            ]
          })
        ],
        ticket_id: 466
      },
      true
    );

    const parsed = JSON.parse(json) as {
      action: string;
      threads: Array<{
        attachments: Array<{ file_name: string }>;
        id: string;
      }>;
      ticket_id: number;
    };
    expect(parsed.action).toBe('replies');
    expect(parsed.ticket_id).toBe(466);
    expect(parsed.threads[0]?.id).toBe('thread-1');
    expect(parsed.threads[0]?.attachments[0]?.file_name).toBe('log.txt');
  });

  it('renders a get result without an account manager row when none is provided', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'get',
        ticket: sampleDetail()
      },
      false
    );

    expect(output).not.toContain('Account Manager');
  });

  it('renders -- placeholders for missing optional ticket fields', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'get',
        ticket: sampleDetail({
          customer_type: null,
          department: null,
          due_date: null,
          priority: null,
          reply_option: null,
          status: null,
          subject: null,
          ticket_category: null,
          ticket_number: null,
          updated_at: null
        })
      },
      false
    );

    expect(output).toMatch(/Reply Allowed.*--/);
    expect(output).toMatch(/Customer Type.*--/);
  });

  it('renders -- placeholders for missing create result fields', () => {
    const output = renderSupportTicketResult(
      {
        action: 'create',
        ticket: sampleDetail({
          priority: null,
          status: null,
          subject: null,
          ticket_category: null,
          ticket_number: null
        })
      },
      false
    );

    expect(output).toContain('Created support ticket 42.');
    expect(output).toContain('Ticket Number: --');
    expect(output).toContain('Subject: --');
    expect(output).toContain('Status: --');
    expect(output).toContain('Priority: --');
    expect(output).toContain('Category: --');
  });

  it('joins CC emails with a comma in the get table', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'get',
        ticket: sampleDetail({
          emails_cc_on_ticket: ['a@x.io', 'b@x.io']
        })
      },
      false
    );

    expect(output).toContain('a@x.io, b@x.io');
  });

  it('truncates long subjects in the list table to 48 chars with an ellipsis', () => {
    const longSubject = 'a'.repeat(60);
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'list',
        items: [sampleItem({ subject: longSubject })],
        page: {
          open_count: null,
          page_no: null,
          per_page: null,
          resolved_count: null,
          total_pages: null,
          total_records: null,
          urgent_count: null
        }
      },
      false
    );

    expect(output).toContain('…');
    expect(output).not.toContain(longSubject);
  });

  it('omits the footer entirely when no page/count fields are present', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'list',
        items: [sampleItem({ id: 42 })],
        page: {
          open_count: null,
          page_no: null,
          per_page: null,
          resolved_count: null,
          total_pages: null,
          total_records: null,
          urgent_count: null
        }
      },
      false
    );

    expect(output).not.toContain('Page ');
    expect(output).not.toContain('total');
    expect(output).not.toContain('Open:');
  });

  it('renders the page line without counts when only total_records is set', () => {
    const output = renderSupportTicketResult(
      {
        account_manager: null,
        action: 'list',
        items: [sampleItem()],
        page: {
          open_count: null,
          page_no: null,
          per_page: null,
          resolved_count: null,
          total_pages: null,
          total_records: 100,
          urgent_count: null
        }
      },
      false
    );

    expect(output).toContain('100 total');
    expect(output).not.toContain('Open:');
  });

  it('uses stableStringify for stable key ordering in list JSON', () => {
    const result = {
      account_manager: null,
      action: 'list' as const,
      items: [sampleItem({ id: 42 })],
      page: {
        open_count: null,
        page_no: null,
        per_page: null,
        resolved_count: null,
        total_pages: null,
        total_records: null,
        urgent_count: null
      }
    };
    const json = renderSupportTicketResult(result, true);

    expect(json).toBe(
      `${stableStringify({
        account_manager: null,
        action: 'list',
        items: [
          {
            assignee_id: null,
            attachment_count: 0,
            category: null,
            channel: 'Web',
            comment_count: 0,
            contact_id: null,
            created_at: '2026-05-18 14:32:15',
            creator_email: 'me@example.com',
            customer_id: null,
            department: 'Cloud Support',
            department_id: '101',
            description: 'VM is unreachable.',
            due_date: null,
            email: 'me@example.com',
            emails_cc_on_ticket: [],
            id: 42,
            is_priority_ticket: false,
            priority: 'High',
            reply_option: true,
            status: 'Open',
            sub_category: null,
            subject: 'Cannot reach my VM',
            task_count: 0,
            ticket_category: 'Cloud',
            ticket_id: 'ZD-123',
            ticket_number: 'T-100042',
            updated_at: '2026-05-18 14:32:15'
          }
        ],
        page: {
          open_count: null,
          page_no: null,
          per_page: null,
          resolved_count: null,
          total_pages: null,
          total_records: null,
          urgent_count: null
        }
      })}\n`
    );
  });

  it('emits deterministic JSON for create and get outputs (includes crn/customer_type)', () => {
    const createJson = renderSupportTicketResult(
      { action: 'create', ticket: sampleDetail() },
      true
    );
    expect(JSON.parse(createJson)).toMatchObject({
      action: 'create',
      ticket: { crn: 'CRN-1', customer_type: 'Standard', id: 42 }
    });

    const getJson = renderSupportTicketResult(
      {
        account_manager: 'Asha Iyer',
        action: 'get',
        ticket: sampleDetail()
      },
      true
    );
    expect(JSON.parse(getJson)).toMatchObject({
      account_manager: 'Asha Iyer',
      action: 'get',
      ticket: { crn: 'CRN-1', customer_type: 'Standard', id: 42 }
    });
  });
});
