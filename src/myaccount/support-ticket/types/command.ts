export interface SupportTicketItem {
  assignee_id: string | null;
  attachment_count: number | null;
  category: string | null;
  channel: string | null;
  comment_count: number | null;
  contact_id: string | null;
  created_at: string | null;
  creator_email: string | null;
  customer_id: number | null;
  department: string | null;
  department_id: string | null;
  description: string | null;
  due_date: string | null;
  email: string | null;
  emails_cc_on_ticket: string[];
  id: number;
  is_priority_ticket: boolean;
  priority: string | null;
  reply_option: boolean | null;
  status: string | null;
  sub_category: string | null;
  subject: string | null;
  task_count: number | null;
  ticket_category: string | null;
  ticket_id: string | null;
  ticket_number: string | null;
  updated_at: string | null;
}

export interface SupportTicketDetailItem extends SupportTicketItem {
  crn: string | null;
  customer_type: string | null;
}

export interface SupportTicketAttachmentItem {
  download_url: string | null;
  file_name: string;
}

export interface SupportTicketThreadItem {
  attachments: SupportTicketAttachmentItem[];
  author_email: string | null;
  author_name: string | null;
  author_type: string | null;
  can_reply: boolean;
  channel: string | null;
  cc: string | null;
  content_type: string | null;
  created_time: string | null;
  // Kept as a raw string (rather than a closed 'in' | 'out' union) so that any
  // new value the API introduces surfaces to the user instead of being silently
  // dropped to null.
  direction: string | null;
  id: string;
  is_description_thread: boolean;
  // Whether the summary below holds the full thread body. False means the API
  // returned a truncated preview and the full-content fetch did not succeed.
  is_summary_complete: boolean;
  summary: string | null;
  to: string | null;
  // Raw string for the same forward-compatibility reason as `direction`.
  visibility: string | null;
}

export interface SupportTicketDepartmentItem {
  description: string | null;
  id: number;
  is_default: boolean;
  is_enabled: boolean;
  name: string | null;
}

export interface SupportTicketListCommandResult {
  account_manager: string | null;
  action: 'list';
  items: SupportTicketItem[];
  page: {
    open_count: number | null;
    page_no: number | null;
    per_page: number | null;
    resolved_count: number | null;
    total_pages: number | null;
    total_records: number | null;
    urgent_count: number | null;
  };
}

export interface SupportTicketGetCommandResult {
  account_manager: string | null;
  action: 'get';
  ticket: SupportTicketDetailItem;
}

export interface SupportTicketDepartmentsCommandResult {
  action: 'departments';
  departments: SupportTicketDepartmentItem[];
}

export interface SupportTicketCreateCommandResult {
  account_manager: string | null;
  action: 'create';
  // True when the full ticket detail was fetched after creation; false when the
  // create succeeded but the follow-up detail fetch failed (see `warnings`).
  detail_loaded: boolean;
  ticket: SupportTicketDetailItem;
  warnings: readonly string[];
}

export interface SupportTicketReplyCommandResult {
  action: 'reply';
  message: string;
  ticket_id: number;
}

export interface SupportTicketCloseCommandResult {
  action: 'close';
  message: string;
  ticket_id: number;
}

export interface SupportTicketReopenCommandResult {
  action: 'reopen';
  message: string;
  ticket_id: number;
}

export interface SupportTicketTimelineEventItem {
  actor: string | null;
  description: string | null;
  event_type: string | null;
  status: string | null;
  time: string | null;
}

export interface SupportTicketTimelineCommandResult {
  action: 'timeline';
  events: SupportTicketTimelineEventItem[];
  filters: {
    month: number | null;
    year: number | null;
  };
  ticket_id: number;
}

export interface SupportTicketRepliesCommandResult {
  action: 'get-replies';
  threads: SupportTicketThreadItem[];
  ticket_id: number;
  warnings: readonly string[];
}

export type SupportTicketCommandResult =
  | SupportTicketCloseCommandResult
  | SupportTicketCreateCommandResult
  | SupportTicketDepartmentsCommandResult
  | SupportTicketGetCommandResult
  | SupportTicketListCommandResult
  | SupportTicketRepliesCommandResult
  | SupportTicketReopenCommandResult
  | SupportTicketReplyCommandResult
  | SupportTicketTimelineCommandResult;
