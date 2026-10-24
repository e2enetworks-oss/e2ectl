import { parse as parseHtml } from 'node-html-parser';

import type { SupportTicketListPage } from './client.js';
import {
  normalizeOptionalInteger,
  normalizeOptionalString
} from './normalizers.js';
import type {
  SupportTicketCreateResult,
  SupportTicketDepartment,
  SupportTicketDepartmentItem,
  SupportTicketDetail,
  SupportTicketDetailItem,
  SupportTicketItem,
  SupportTicketListCommandResult,
  SupportTicketSummary,
  SupportTicketThread,
  SupportTicketThreadDetail,
  SupportTicketThreadItem,
  SupportTicketTimelineEvent,
  SupportTicketTimelineEventItem
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
    assignee_id: trimmedStringOrNull(item.assignee_id),
    attachment_count: normalizeOptionalInteger(item.attachment_count),
    category: trimmedStringOrNull(item.category),
    channel: trimmedStringOrNull(item.channel),
    comment_count: normalizeOptionalInteger(item.comment_count),
    contact_id: trimmedStringOrNull(item.contact_id),
    created_at: trimmedStringOrNull(item.created_at),
    creator_email: trimmedStringOrNull(item.creator_email),
    customer_id: normalizeOptionalInteger(item.customer_id),
    department: trimmedStringOrNull(item.department),
    department_id: trimmedStringOrNull(item.department_id),
    description: normalizeDescription(item.description),
    due_date: trimmedStringOrNull(item.due_date),
    email: trimmedStringOrNull(item.email),
    emails_cc_on_ticket: Array.isArray(item.emails_cc_on_ticket)
      ? item.emails_cc_on_ticket.filter(
          (email): email is string =>
            typeof email === 'string' && email.length > 0
        )
      : [],
    id: item.id,
    is_priority_ticket: item.is_priority_ticket === true,
    priority: trimmedStringOrNull(item.priority),
    reply_option:
      typeof item.reply_option === 'boolean' ? item.reply_option : null,
    status: trimmedStringOrNull(item.status),
    sub_category: trimmedStringOrNull(item.sub_category),
    subject: trimmedStringOrNull(item.subject),
    task_count: normalizeOptionalInteger(item.task_count),
    ticket_category: trimmedStringOrNull(item.ticket_category),
    ticket_id: trimmedStringOrNull(item.ticket_id),
    ticket_number: trimmedStringOrNull(item.ticket_number),
    updated_at: trimmedStringOrNull(item.updated_at)
  };
}

export function normalizeSupportTicketDetail(
  item: SupportTicketDetail
): SupportTicketDetailItem {
  return {
    ...normalizeSupportTicketItem(item),
    crn: trimmedStringOrNull(item.crn),
    customer_type: trimmedStringOrNull(item.customer_type)
  };
}

/**
 * Build a (mostly empty) detail item from the minimal create response. Used as a
 * fallback for display when the post-create detail fetch fails — the ticket was
 * still created, so we surface the identifiers we do have rather than nulls only.
 */
export function buildDetailFromCreateResult(
  result: SupportTicketCreateResult
): SupportTicketDetailItem {
  return {
    ...normalizeSupportTicketItem({ id: result.id }),
    crn: null,
    customer_type: null,
    ticket_id: trimmedStringOrNull(result.ticket_id),
    ticket_number: trimmedStringOrNull(result.ticket_number)
  };
}

export function normalizeSupportTicketDepartment(
  department: SupportTicketDepartment
): SupportTicketDepartmentItem {
  return {
    description: trimmedStringOrNull(department.description),
    id: department.id,
    is_default: department.is_default === true,
    is_enabled: department.is_enabled === true,
    name: trimmedStringOrNull(department.name)
  };
}

export function normalizeSupportTicketThread(
  thread: SupportTicketThread,
  isSummaryComplete = true
): SupportTicketThreadItem {
  return {
    attachments: normalizeThreadAttachments(thread),
    author_email: trimmedStringOrNull(thread.author?.email),
    author_name: trimmedStringOrNull(thread.author?.name),
    author_type: trimmedStringOrNull(thread.author?.type),
    can_reply: thread.canReply === true,
    cc: trimmedStringOrNull(thread.cc),
    channel: trimmedStringOrNull(thread.channel),
    content_type: trimmedStringOrNull(thread.contentType),
    created_time: trimmedStringOrNull(thread.createdTime),
    // Preserve the raw value so unrecognized directions/visibilities surface to
    // the caller instead of being silently coerced to null.
    direction: trimmedStringOrNull(thread.direction),
    id: thread.id,
    is_description_thread: thread.isDescriptionThread === true,
    is_summary_complete: isSummaryComplete,
    summary: trimmedStringOrNull(thread.summary),
    to: trimmedStringOrNull(thread.to),
    visibility: trimmedStringOrNull(thread.visibility)
  };
}

function normalizeThreadAttachments(
  thread: SupportTicketThread
): SupportTicketThreadItem['attachments'] {
  return (thread.attachment_list?.data ?? []).map((att) => ({
    download_url: trimmedStringOrNull(att.download_url),
    file_name: normalizeOptionalString(att.file_name) ?? ''
  }));
}

export function normalizeSupportTicketTimelineEvent(
  event: SupportTicketTimelineEvent
): SupportTicketTimelineEventItem {
  return {
    actor:
      normalizeOptionalString(event.actor) ??
      normalizeOptionalString(event.performed_by) ??
      null,
    description:
      normalizeOptionalString(event.description) ??
      normalizeOptionalString(event.summary) ??
      null,
    event_type:
      normalizeOptionalString(event.type) ??
      normalizeOptionalString(event.event) ??
      null,
    status: trimmedStringOrNull(event.status),
    time:
      normalizeOptionalString(event.time) ??
      normalizeOptionalString(event.event_time) ??
      normalizeOptionalString(event.created_at) ??
      null
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

// Trimmed string, or null when the value is missing or blank.
function trimmedStringOrNull(
  value: string | number | null | undefined
): string | null {
  return normalizeOptionalString(value) ?? null;
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = htmlToText(value);
  return cleaned.length === 0 ? null : cleaned;
}

// node-html-parser decodes &nbsp; to U+00A0 (non-breaking space); the original
// regex stripper produced an ASCII space, so we normalize back to keep the
// public output stable across the swap. Built via fromCharCode so the source
// stays pure ASCII and survives every formatter / encoding round-trip.
const NBSP_REGEX = new RegExp(String.fromCharCode(0xa0), 'g');

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
    .replace(NBSP_REGEX, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
