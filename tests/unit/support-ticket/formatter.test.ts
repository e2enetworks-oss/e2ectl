import { stableStringify } from '../../../src/core/json.js';
import { renderSupportTicketResult } from '../../../src/support-ticket/formatter.js';
import type {
  SupportTicketDetailItem,
  SupportTicketItem
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

function sampleDetail(): SupportTicketDetailItem {
  return {
    ...sampleItem(),
    crn: 'CRN-1',
    customer_type: 'Standard'
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
});
