import {
  buildListResult,
  extractThreadText,
  isSummaryTruncated,
  normalizeSupportTicketDetail,
  normalizeSupportTicketItem,
  normalizeSupportTicketThread
} from '../../../src/support-ticket/mappers.js';

describe('normalizeSupportTicketItem', () => {
  it('coerces optional strings/integers/booleans to nullable values', () => {
    expect(
      normalizeSupportTicketItem({
        emails_cc_on_ticket: ['cc@example.com', '', 'cc2@example.com'],
        id: 42
      })
    ).toEqual({
      assignee_id: null,
      attachment_count: null,
      category: null,
      channel: null,
      comment_count: null,
      contact_id: null,
      created_at: null,
      creator_email: null,
      customer_id: null,
      department: null,
      department_id: null,
      description: null,
      due_date: null,
      email: null,
      emails_cc_on_ticket: ['cc@example.com', 'cc2@example.com'],
      id: 42,
      is_priority_ticket: false,
      priority: null,
      reply_option: null,
      status: null,
      sub_category: null,
      subject: null,
      task_count: null,
      ticket_category: null,
      ticket_id: null,
      ticket_number: null,
      updated_at: null
    });
  });

  it('strips HTML tags and entities from descriptions', () => {
    expect(
      normalizeSupportTicketItem({
        description: '<div>Hello&nbsp;<br>World&amp;more</div>',
        id: 1
      }).description
    ).toBe('Hello \nWorld&more');
  });

  it('returns description=null for blank or non-string values', () => {
    expect(
      normalizeSupportTicketItem({ description: null, id: 1 }).description
    ).toBeNull();
    expect(
      normalizeSupportTicketItem({ description: '   ', id: 1 }).description
    ).toBeNull();
    expect(
      normalizeSupportTicketItem({
        description: 42 as unknown as string,
        id: 1
      }).description
    ).toBeNull();
  });

  it('keeps reply_option booleans (true and false) but nulls non-booleans', () => {
    expect(
      normalizeSupportTicketItem({ id: 1, reply_option: true }).reply_option
    ).toBe(true);
    expect(
      normalizeSupportTicketItem({ id: 1, reply_option: false }).reply_option
    ).toBe(false);
    expect(
      normalizeSupportTicketItem({
        id: 1,
        reply_option: 'yes' as unknown as boolean
      }).reply_option
    ).toBeNull();
  });

  it('drops non-array emails_cc_on_ticket gracefully', () => {
    expect(
      normalizeSupportTicketItem({ id: 1 }).emails_cc_on_ticket
    ).toEqual([]);
    expect(
      normalizeSupportTicketItem({
        emails_cc_on_ticket: 'a@b.co' as unknown as string[],
        id: 1
      }).emails_cc_on_ticket
    ).toEqual([]);
  });
});

describe('normalizeSupportTicketDetail', () => {
  it('adds crn and customer_type to the item shape', () => {
    const detail = normalizeSupportTicketDetail({
      crn: 'CRN-1',
      customer_type: 'Standard',
      id: 42
    });

    expect(detail.crn).toBe('CRN-1');
    expect(detail.customer_type).toBe('Standard');
    expect(detail.id).toBe(42);
  });

  it('nulls out missing crn/customer_type values', () => {
    const detail = normalizeSupportTicketDetail({ id: 42 });

    expect(detail.crn).toBeNull();
    expect(detail.customer_type).toBeNull();
  });

  it('coerces numeric crn to a string', () => {
    const detail = normalizeSupportTicketDetail({
      crn: 12345,
      id: 1
    });

    expect(detail.crn).toBe('12345');
  });
});

describe('buildListResult', () => {
  it('maps a list page into a list command result', () => {
    expect(
      buildListResult({
        account_manager: 'Asha Iyer',
        items: [{ id: 1 }, { id: 2 }],
        open_count: 1,
        page_no: 1,
        per_page: 25,
        resolved_count: 0,
        total_pages: 1,
        total_records: 2,
        urgent_count: 0
      })
    ).toMatchObject({
      account_manager: 'Asha Iyer',
      action: 'list',
      page: {
        open_count: 1,
        page_no: 1,
        per_page: 25,
        resolved_count: 0,
        total_pages: 1,
        total_records: 2,
        urgent_count: 0
      }
    });
  });
});

describe('normalizeSupportTicketThread', () => {
  it('returns canonical direction/visibility and null author fields when missing', () => {
    expect(
      normalizeSupportTicketThread({
        author: null,
        direction: 'sideways',
        id: 't1',
        visibility: 'maybe'
      })
    ).toMatchObject({
      attachments: [],
      author_email: null,
      author_name: null,
      author_type: null,
      can_reply: false,
      direction: null,
      id: 't1',
      is_description_thread: false,
      visibility: null
    });
  });

  it('keeps known direction/visibility and propagates the author + cc + to fields', () => {
    expect(
      normalizeSupportTicketThread({
        attachment_list: {
          data: [
            { download_url: 'https://x/y', file_name: 'log.txt' },
            { download_url: null }
          ]
        },
        author: {
          email: 'engineer@example.com',
          name: 'Engineer',
          type: 'AGENT'
        },
        canReply: true,
        cc: 'cc@example.com',
        channel: 'EMAIL',
        contentType: 'text/html',
        createdTime: '2026-05-13T16:09:19.307Z',
        direction: 'out',
        id: 't2',
        isDescriptionThread: true,
        summary: 'hi',
        to: 'customer@example.com',
        visibility: 'private'
      })
    ).toEqual({
      attachments: [
        { download_url: 'https://x/y', file_name: 'log.txt' },
        { download_url: null, file_name: '' }
      ],
      author_email: 'engineer@example.com',
      author_name: 'Engineer',
      author_type: 'AGENT',
      can_reply: true,
      cc: 'cc@example.com',
      channel: 'EMAIL',
      content_type: 'text/html',
      created_time: '2026-05-13T16:09:19.307Z',
      direction: 'out',
      id: 't2',
      is_description_thread: true,
      summary: 'hi',
      to: 'customer@example.com',
      visibility: 'private'
    });
  });

  it('falls back to empty attachments when attachment_list is missing or has no data array', () => {
    expect(
      normalizeSupportTicketThread({ attachment_list: null, id: 't1' })
        .attachments
    ).toEqual([]);
    expect(normalizeSupportTicketThread({ id: 't1' }).attachments).toEqual([]);
    expect(
      normalizeSupportTicketThread({ attachment_list: { data: [] }, id: 't1' })
        .attachments
    ).toEqual([]);
  });
});

describe('isSummaryTruncated', () => {
  it('detects ASCII and Unicode ellipsis suffixes', () => {
    expect(isSummaryTruncated('hello...')).toBe(true);
    expect(isSummaryTruncated('hello…')).toBe(true);
    expect(isSummaryTruncated('hello...   ')).toBe(true);
  });

  it('returns false for non-truncated and non-string values', () => {
    expect(isSummaryTruncated('hello')).toBe(false);
    expect(isSummaryTruncated(null)).toBe(false);
    expect(isSummaryTruncated(undefined)).toBe(false);
  });
});

describe('extractThreadText', () => {
  it('prefers the HTML content stripped of tags + entities', () => {
    expect(
      extractThreadText({
        content: '<p>Hello&nbsp;<br>World&amp;more</p>',
        plainText: 'ignored'
      })
    ).toBe('Hello \nWorld&more');
  });

  it('falls back to plainText when HTML is empty', () => {
    expect(
      extractThreadText({ content: '   ', plainText: '  fallback  ' })
    ).toBe('fallback');
  });

  it('falls back to plainText when content is null', () => {
    expect(
      extractThreadText({ content: null, plainText: 'plain only' })
    ).toBe('plain only');
  });

  it('returns undefined when neither content nor plainText has text', () => {
    expect(
      extractThreadText({ content: null, plainText: null })
    ).toBeUndefined();
    expect(extractThreadText({ content: '<br>', plainText: '' })).toBeUndefined();
  });

  it('collapses runs of blank lines and strips carriage returns', () => {
    expect(
      extractThreadText({
        content: '<p>line1</p>\r\n\r\n\r\n<p>line2</p>',
        plainText: null
      })
    ).toBe('line1\n\nline2');
  });

  it('decodes &quot;, &#39;, and &#x27; HTML entities', () => {
    expect(
      extractThreadText({
        content: '<p>&quot;hi&#39;there&#x27;ok&quot;</p>',
        plainText: null
      })
    ).toBe(`"hi'there'ok"`);
  });
});
