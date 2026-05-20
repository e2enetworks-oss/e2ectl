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
  direction: 'in' | 'out' | null;
  id: string;
  is_description_thread: boolean;
  summary: string | null;
  to: string | null;
  visibility: 'private' | 'public' | null;
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

export interface SupportTicketCreateCommandResult {
  action: 'create';
  ticket: SupportTicketDetailItem;
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

export interface SupportTicketRepliesCommandResult {
  action: 'replies';
  threads: SupportTicketThreadItem[];
  ticket_id: number;
}

export type SupportTicketCommandResult =
  | SupportTicketCloseCommandResult
  | SupportTicketCreateCommandResult
  | SupportTicketGetCommandResult
  | SupportTicketListCommandResult
  | SupportTicketRepliesCommandResult
  | SupportTicketReplyCommandResult;
