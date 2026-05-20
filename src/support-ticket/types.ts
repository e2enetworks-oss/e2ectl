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
  file?: string;
  file_name?: string[];
  imagedata?: string[];
}

export interface SupportTicketCloseRequest {
  comment: string;
  contact_person_email?: string;
  contact_person_type?: SupportTicketContactPersonType;
}

export interface SupportTicketGetQuery {
  contact_person_email?: string;
  contact_person_type?: string;
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
