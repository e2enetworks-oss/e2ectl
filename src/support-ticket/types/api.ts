export type SupportTicketStatus =
  | 'Closed'
  | 'Escalated'
  | 'New'
  | 'On Hold'
  | 'Open'
  | 'Resolved'
  | 'Waiting on Customer';

export type SupportTicketPriority = 'High' | 'Low' | 'Medium';

export type SupportTicketCategory = 'Billing' | 'Cloud' | 'Network' | 'Sales';

export type SupportTicketFilterCategory =
  | SupportTicketCategory
  | 'Abuse'
  | 'SOC';

export interface SupportTicketResource {
  id?: string;
  ip_address?: string;
  name: string;
}

export type SupportTicketContactPersonType =
  | 'Admin'
  | 'Billing'
  | 'Manager'
  | 'Technical Lead';

export interface SupportTicketSummary {
  assignee_id?: string | null;
  attachment_count?: number;
  category?: string | null;
  channel?: string | null;
  comment_count?: number;
  contact_id?: string | null;
  created_at?: string;
  creator_email?: string | null;
  customer_id?: number | null;
  department?: string | null;
  department_id?: string;
  description?: string | null;
  due_date?: string | null;
  email?: string | null;
  emails_cc_on_ticket?: string[];
  id: number;
  is_priority_ticket?: boolean;
  priority?: SupportTicketPriority | null;
  reply_option?: boolean;
  status?: string;
  sub_category?: string | null;
  subject?: string | null;
  task_count?: number;
  ticket_category?: string;
  ticket_id?: string;
  ticket_number?: string | null;
  updated_at?: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  crn?: number | string;
  customer_type?: 'Priority' | 'Standard';
}

/**
 * Shape returned by the create endpoint. The backend only echoes the local DB
 * id plus the Zoho identifiers — it does NOT return the full ticket detail.
 * The CLI fetches the populated detail in a follow-up request keyed off `id`.
 */
export interface SupportTicketCreateResult {
  id: number;
  ticket_id?: string | null;
  ticket_number?: string | null;
}

export interface SupportTicketDepartment {
  description?: string | null;
  id: number;
  is_default?: boolean;
  is_enabled?: boolean;
  name?: string | null;
}

export interface SupportTicketCreateRequest {
  cc_email_list: string[];
  channel?: string;
  component?: string;
  contact_person_email: string;
  contact_person_type: SupportTicketContactPersonType | '';
  department: number;
  description: string;
  file_name: string[];
  imagedata: string[];
  is_priority_ticket?: boolean;
  priority?: SupportTicketPriority | null;
  resource?: SupportTicketResource[] | null;
  subject: string;
  ticket_category: SupportTicketCategory;
}

export interface SupportTicketReplyRequest {
  abuse_ticket: boolean;
  channel?: string;
  comment: string;
  contact_person_email: string;
  contact_person_type: SupportTicketContactPersonType | '';
  file_name?: string[];
  imagedata?: string[];
  soc_ticket?: boolean;
}

export interface SupportTicketCloseRequest {
  comment: string;
  contact_person_email?: string;
  contact_person_type?: SupportTicketContactPersonType;
}

export interface SupportTicketReopenRequest {
  comment: string;
  contact_person_email?: string;
  contact_person_type?: SupportTicketContactPersonType;
}

export interface SupportTicketTimelineQuery {
  month?: number;
  year?: number;
}

/**
 * One entry returned by the ticket-timeline endpoint. The backend mixes a few
 * field names across event types, so the optional aliases below are normalized
 * down to a single shape by `normalizeSupportTicketTimelineEvent`.
 */
export interface SupportTicketTimelineEvent {
  actor?: string | null;
  created_at?: string | null;
  description?: string | null;
  event?: string | null;
  event_time?: string | null;
  performed_by?: string | null;
  status?: string | null;
  summary?: string | null;
  time?: string | null;
  type?: string | null;
}

export interface SupportTicketGetQuery {
  abuse_ticket?: boolean;
  contact_person_email?: string;
  contact_person_type?: string;
  soc_ticket?: boolean;
}

export interface SupportTicketThreadAuthor {
  email?: string | null;
  firstName?: string | null;
  id?: string | null;
  lastName?: string | null;
  name?: string | null;
  photoURL?: string | null;
  type?: string | null;
}

export interface SupportTicketThreadAttachment {
  attachment_index?: number;
  download_url?: string | null;
  file_name?: string | null;
}

export interface SupportTicketThread {
  attachmentCount?: string | null;
  attachment_list?: {
    data?: SupportTicketThreadAttachment[];
  } | null;
  author?: SupportTicketThreadAuthor | null;
  bcc?: string | null;
  canReply?: boolean;
  cc?: string | null;
  channel?: string | null;
  contentType?: string | null;
  createdTime?: string | null;
  direction?: string | null;
  fromEmailAddress?: string | null;
  hasAttach?: boolean;
  id: string;
  isDescriptionThread?: boolean;
  isForward?: boolean;
  responderId?: string | null;
  respondedIn?: string | null;
  status?: string | null;
  summary?: string | null;
  to?: string | null;
  type?: string | null;
  visibility?: string | null;
}

export interface SupportTicketThreadDetail extends SupportTicketThread {
  attachments?: SupportTicketThreadAttachment[] | null;
  content?: string | null;
  isContentTruncated?: boolean;
  plainText?: string | null;
}

export interface SupportTicketReplyResult {
  message: string;
}
