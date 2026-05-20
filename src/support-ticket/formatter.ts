import Table from 'cli-table3';

import { formatCliCommand } from '../app/metadata.js';
import { stableStringify, type JsonValue } from '../core/json.js';
import type {
  SupportTicketCommandResult,
  SupportTicketDetailItem,
  SupportTicketItem,
  SupportTicketThreadItem
} from './types/index.js';

export function renderSupportTicketResult(
  result: SupportTicketCommandResult,
  json: boolean
): string {
  return json
    ? renderSupportTicketJson(result)
    : renderSupportTicketHuman(result);
}

function renderSupportTicketHuman(result: SupportTicketCommandResult): string {
  switch (result.action) {
    case 'create': {
      const reference = result.ticket.ticket_number ?? String(result.ticket.id);

      return (
        `Created support ticket ${reference}.\n` +
        `ID: ${result.ticket.id}\n` +
        `Ticket Number: ${result.ticket.ticket_number ?? '--'}\n` +
        `Subject: ${result.ticket.subject ?? '--'}\n` +
        `Status: ${result.ticket.status ?? '--'}\n` +
        `Priority: ${result.ticket.priority ?? '--'}\n` +
        `Category: ${result.ticket.ticket_category ?? '--'}\n` +
        '\n' +
        `Next: run ${formatCliCommand('support-ticket get ' + String(result.ticket.id))} to inspect the ticket.\n`
      );
    }
    case 'get':
      return `${formatSupportTicketDetailTable(result.ticket, result.account_manager)}\n`;
    case 'list':
      return result.items.length === 0
        ? 'No support tickets found.\n'
        : `${formatSupportTicketListTable(result.items)}\n${formatListFooter(result)}`;
    case 'reply':
      return (
        `Replied to support ticket ${result.ticket_id}.\n` +
        `Message: ${result.message || '--'}\n`
      );
    case 'close':
      return (
        `Closed support ticket ${result.ticket_id}.\n` +
        `Message: ${result.message || '--'}\n`
      );
    case 'replies':
      return result.threads.length === 0
        ? `No replies on support ticket ${result.ticket_id}.\n`
        : `Replies on support ticket ${result.ticket_id}:\n${formatSupportTicketRepliesTable(result.threads)}\n`;
  }
}

function renderSupportTicketJson(result: SupportTicketCommandResult): string {
  return `${stableStringify(normalizeSupportTicketJson(result))}\n`;
}

function normalizeSupportTicketJson(
  result: SupportTicketCommandResult
): JsonValue {
  switch (result.action) {
    case 'create':
      return {
        action: 'create',
        ticket: normalizeSupportTicketDetailJson(result.ticket)
      };
    case 'get':
      return {
        account_manager: result.account_manager,
        action: 'get',
        ticket: normalizeSupportTicketDetailJson(result.ticket)
      };
    case 'list':
      return {
        account_manager: result.account_manager,
        action: 'list',
        items: sortSupportTicketItems(result.items).map((item) =>
          normalizeSupportTicketItemJson(item)
        ),
        page: {
          open_count: result.page.open_count,
          page_no: result.page.page_no,
          per_page: result.page.per_page,
          resolved_count: result.page.resolved_count,
          total_pages: result.page.total_pages,
          total_records: result.page.total_records,
          urgent_count: result.page.urgent_count
        }
      };
    case 'reply':
      return {
        action: 'reply',
        message: result.message,
        ticket_id: result.ticket_id
      };
    case 'close':
      return {
        action: 'close',
        message: result.message,
        ticket_id: result.ticket_id
      };
    case 'replies':
      return {
        action: 'replies',
        threads: result.threads.map((thread) =>
          normalizeSupportTicketThreadJson(thread)
        ),
        ticket_id: result.ticket_id
      };
  }
}

function formatSupportTicketDetailTable(
  ticket: SupportTicketDetailItem,
  accountManager: string | null
): string {
  const ccList =
    ticket.emails_cc_on_ticket.length === 0
      ? '--'
      : ticket.emails_cc_on_ticket.join(', ');

  const rows: [string, string][] = [
    ['ID', String(ticket.id)],
    ['Number', ticket.ticket_number ?? '--'],
    ['Subject', ticket.subject ?? '--'],
    ['Status', ticket.status ?? '--'],
    ['Priority', ticket.priority ?? '--'],
    ['Category', ticket.ticket_category ?? '--'],
    ['Department', ticket.department ?? '--'],
    ['Created', ticket.created_at ?? '--'],
    ['Updated', ticket.updated_at ?? '--'],
    ['Due Date', ticket.due_date ?? '--'],
    ['Reply Allowed', formatReplyOption(ticket.reply_option)],
    ['Customer Type', ticket.customer_type ?? '--'],
    ['CC', ccList]
  ];

  if (accountManager !== null) {
    rows.push(['Account Manager', accountManager]);
  }

  rows.push(['Description', ticket.description ?? '--']);

  const table = new Table({ head: ['Field', 'Value'] });
  rows.forEach((row) => table.push(row));

  return table.toString();
}

function formatSupportTicketRepliesTable(
  threads: SupportTicketThreadItem[]
): string {
  const table = new Table({
    head: ['Time', 'Author', 'Summary', 'Attachments']
  });

  threads.forEach((thread) => {
    const author =
      thread.author_name === null
        ? '--'
        : thread.author_email === null
          ? thread.author_name
          : `${thread.author_name} <${thread.author_email}>`;
    const attachments =
      thread.attachments.length === 0
        ? '--'
        : thread.attachments.map((att) => att.file_name || '--').join(', ');

    table.push([
      thread.created_time ?? '--',
      author,
      thread.summary ?? '--',
      attachments
    ]);
  });

  return table.toString();
}

function normalizeSupportTicketThreadJson(
  thread: SupportTicketThreadItem
): JsonValue {
  return {
    attachments: thread.attachments.map((att) => ({
      download_url: att.download_url,
      file_name: att.file_name
    })),
    author_email: thread.author_email,
    author_name: thread.author_name,
    author_type: thread.author_type,
    can_reply: thread.can_reply,
    cc: thread.cc,
    channel: thread.channel,
    content_type: thread.content_type,
    created_time: thread.created_time,
    direction: thread.direction,
    id: thread.id,
    is_description_thread: thread.is_description_thread,
    summary: thread.summary,
    to: thread.to,
    visibility: thread.visibility
  };
}

function formatSupportTicketListTable(items: SupportTicketItem[]): string {
  const table = new Table({
    head: ['ID', 'Number', 'Subject', 'Status', 'Priority', 'Category']
  });

  sortSupportTicketItems(items).forEach((item) => {
    table.push([
      String(item.id),
      item.ticket_number ?? '--',
      truncate(item.subject ?? '--', 48),
      item.status ?? '--',
      item.priority ?? '--',
      item.ticket_category ?? '--'
    ]);
  });

  return table.toString();
}

function formatListFooter(result: {
  account_manager: string | null;
  page: {
    open_count: number | null;
    page_no: number | null;
    per_page: number | null;
    resolved_count: number | null;
    total_pages: number | null;
    total_records: number | null;
    urgent_count: number | null;
  };
}): string {
  const lines: string[] = [];
  const pageParts: string[] = [];

  if (result.page.page_no !== null && result.page.total_pages !== null) {
    pageParts.push(`Page ${result.page.page_no} of ${result.page.total_pages}`);
  }

  if (result.page.total_records !== null) {
    pageParts.push(`${result.page.total_records} total`);
  }

  if (pageParts.length > 0) {
    lines.push(pageParts.join(' • '));
  }

  const countParts: string[] = [];

  if (result.page.open_count !== null) {
    countParts.push(`Open: ${result.page.open_count}`);
  }

  if (result.page.urgent_count !== null) {
    countParts.push(`Urgent: ${result.page.urgent_count}`);
  }

  if (result.page.resolved_count !== null) {
    countParts.push(`Resolved: ${result.page.resolved_count}`);
  }

  if (countParts.length > 0) {
    lines.push(countParts.join(' • '));
  }

  if (result.account_manager !== null) {
    lines.push(`Account Manager: ${result.account_manager}`);
  }

  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

function normalizeSupportTicketItemJson(item: SupportTicketItem): JsonValue {
  return {
    assignee_id: item.assignee_id,
    attachment_count: item.attachment_count,
    category: item.category,
    channel: item.channel,
    comment_count: item.comment_count,
    contact_id: item.contact_id,
    created_at: item.created_at,
    creator_email: item.creator_email,
    customer_id: item.customer_id,
    department: item.department,
    department_id: item.department_id,
    description: item.description,
    due_date: item.due_date,
    email: item.email,
    emails_cc_on_ticket: [...item.emails_cc_on_ticket].sort(),
    id: item.id,
    is_priority_ticket: item.is_priority_ticket,
    priority: item.priority,
    reply_option: item.reply_option,
    status: item.status,
    sub_category: item.sub_category,
    subject: item.subject,
    task_count: item.task_count,
    ticket_category: item.ticket_category,
    ticket_id: item.ticket_id,
    ticket_number: item.ticket_number,
    updated_at: item.updated_at
  };
}

function normalizeSupportTicketDetailJson(
  item: SupportTicketDetailItem
): JsonValue {
  return {
    ...(normalizeSupportTicketItemJson(item) as Record<string, JsonValue>),
    crn: item.crn,
    customer_type: item.customer_type
  };
}

function sortSupportTicketItems(
  items: SupportTicketItem[]
): SupportTicketItem[] {
  return [...items].sort((left, right) => right.id - left.id);
}

function formatReplyOption(value: boolean | null): string {
  if (value === null) {
    return '--';
  }

  return value ? 'yes' : 'no';
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
