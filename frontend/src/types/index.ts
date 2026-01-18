/**
 * TypeScript type definitions for Invoice Maker.
 */

export type InvoiceStatus = 'draft' | 'generated' | 'sent' | 'paid';
export type TemplateType = 'hourly' | 'tuition' | 'project';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  default_rate: string;
  timezone: string;
  template_type: TemplateType;
  payment_terms: string | null;
  invoice_prefix: string;
  company_context: string | null;
  next_invoice_number: number | null;  // Manual override for next invoice number
  created_at: string;
  updated_at: string;
}

export interface HoursEntry {
  id: string;
  invoice_id: string;
  date: string;
  hours: string;
  rate: string;
  created_at: string;
}

export interface LineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  date: string;
  service_period_start: string | null;
  service_period_end: string | null;
  total_amount: string;
  status: InvoiceStatus;
  pdf_path: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  hours_entries: HoursEntry[];
  line_items: LineItem[];
}

export interface InvoicePreview {
  client_id: string;
  client_name: string;
  invoice_number: string;
  invoice_type: string;
  date: string;
  service_period_start: string | null;
  service_period_end: string | null;
  hours_entries: Array<{
    date: string;
    hours: number;
    rate: number;
    amount: number;
  }>;
  line_items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  total_amount: number;
  // Set when invoice is created from this preview
  invoice_id?: string;
  pdf_url?: string;
  email_subject?: string;
  email_body?: string;
  notes: string | null;
  // Version tracking for preview iterations
  version?: number;
}

export interface ChatMessage {
  id?: string;  // Message ID from database (for "Use this version" feature)
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  invoicePreview?: InvoicePreview;
  previewJson?: string;  // Raw preview JSON (for version selection)
  imageUrl?: string;  // Single image (legacy/first image)
  imageUrls?: string[];  // Multiple images
}

export type ChatResponseStatus =
  | 'message'
  | 'preview'
  | 'clarification_needed'
  | 'client_not_found'
  | 'invoice_created'
  | 'error';

export interface ChatResponse {
  status: ChatResponseStatus;
  message: string;
  session_id: string;
  invoice_preview: InvoicePreview | null;
  invoice_id: string | null;
  pdf_url: string | null;
  suggested_client: {
    name: string;
    template_type: string;
  } | null;
  email_subject: string | null;
  email_body: string | null;
}

export interface ChatSessionInfo {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  last_message: string | null;
  message_count: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// API response message type (uses snake_case from backend)
export interface ApiChatMessage {
  id?: string;  // Message ID from database
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  invoice_preview?: Partial<InvoicePreview> | null;  // Partial since API may not have all fields
  image_url?: string | null;  // Single image (legacy/first image)
  image_urls?: string[] | null;  // Multiple images
}

export interface ChatSessionDetail {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  messages: ApiChatMessage[];  // API returns snake_case
  has_preview: boolean;
  invoice_preview: InvoicePreview | null;
  created_at: string;
  updated_at: string;
}

// Quick Invoice types
export interface QuickHoursEntry {
  date: string;
  hours: number;
}

export interface HoursExtractionResponse {
  success: boolean;
  hours_entries: QuickHoursEntry[];
  total_hours: number;
  notes: string | null;
  error: string | null;
}

export interface QuickInvoiceResponse {
  invoice_id: string;
  invoice_number: string;
  total_hours: number;
  total_amount: number;
  pdf_url: string;
  email_subject: string | null;
  email_body: string | null;
}

export interface GenerateEmailResponse {
  subject: string;
  body: string;
}
