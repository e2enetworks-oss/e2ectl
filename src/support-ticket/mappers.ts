import { parse as parseHtml } from 'node-html-parser';

import type { SupportTicketListPage } from './client.js';
import {
  normalizeOptionalInteger,
  normalizeOptionalString
} from './normalizers.js';
import type {
  SupportTicketDetail,
  SupportTicketDetailItem,
  SupportTicketItem,
  SupportTicketListCommandResult,
  SupportTicketSummary,
  SupportTicketThread,
  SupportTicketThreadDetail,
  SupportTicketThreadItem
} from './types/index.js';

export function buildListResult(
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

export function normalizeSupportTicketItem(
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

export function normalizeSupportTicketDetail(
  item: SupportTicketDetail
): SupportTicketDetailItem {
  return {
    ...normalizeSupportTicketItem(item),
    crn: normalizeOptionalString(item.crn) ?? null,
    customer_type: normalizeOptionalString(item.customer_type) ?? null
  };
}

export function normalizeSupportTicketThread(
  thread: SupportTicketThread
): SupportTicketThreadItem {
  const direction =
    thread.direction === 'in' || thread.direction === 'out'
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

export function isSummaryTruncated(
  summary: string | null | undefined
): boolean {
  if (typeof summary !== 'string') {
    return false;
  }

  const trimmed = summary.trimEnd();
  return trimmed.endsWith('...') || trimmed.endsWith('…');
}

export function extractThreadText(
  detail: Pick<SupportTicketThreadDetail, 'content' | 'plainText'>
): string | undefined {
  const fromHtml = detail.content == null ? '' : htmlToText(detail.content);
  if (fromHtml.length > 0) {
    return fromHtml;
  }

  const fromPlain =
    typeof detail.plainText === 'string' ? detail.plainText.trim() : '';
  return fromPlain.length > 0 ? fromPlain : undefined;
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = htmlToText(value);
  return cleaned.length === 0 ? null : cleaned;
}

function htmlToText(html: string): string {
  // Insert newlines for break and block-close tags BEFORE parsing so the
  // parser's text extraction preserves paragraph boundaries that the server
  // expresses with <br> / </p> / </div> / </li> / </tr>.
  const withLineBreaks = html
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n');

  const root = parseHtml(withLineBreaks);
  root.querySelectorAll('script, style').forEach((node) => node.remove());

  return root.text
    .replace(/ /g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
