export interface SupportTicketContextOptions {
  alias?: string;
  location?: string;
  projectId?: string;
}

export interface SupportTicketListOptions extends SupportTicketContextOptions {
  category?: string[];
  contactEmail?: string;
  contactType?: string;
  pageNo?: string;
  perPage?: string;
  priority?: string[];
  status?: string[];
  year?: string;
}

export interface SupportTicketCreateOptions extends SupportTicketContextOptions {
  attachment?: string[];
  cc?: string[];
  channel?: string;
  component?: string;
  contactEmail?: string;
  contactType?: string;
  department: string;
  description: string;
  isPriorityTicket?: boolean;
  priority?: string;
  resource?: string[];
  subject: string;
  ticketCategory: string;
}

export interface SupportTicketGetOptions extends SupportTicketContextOptions {
  abuseTicket?: boolean;
  contactEmail?: string;
  contactType?: string;
  socTicket?: boolean;
}

export interface SupportTicketReplyOptions extends SupportTicketContextOptions {
  abuseTicket?: boolean;
  attachment?: string[];
  channel?: string;
  comment: string;
  contactEmail?: string;
  contactType?: string;
  socTicket?: boolean;
}

export interface SupportTicketCloseOptions extends SupportTicketContextOptions {
  comment: string;
  contactEmail?: string;
  contactType?: string;
}

export interface SupportTicketReopenOptions extends SupportTicketContextOptions {
  comment: string;
  contactEmail?: string;
  contactType?: string;
}

export interface SupportTicketTimelineOptions extends SupportTicketContextOptions {
  month?: string;
  year?: string;
}
