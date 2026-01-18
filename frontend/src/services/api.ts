/**
 * API client for Invoice Maker backend.
 */

import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type {
  Client,
  Invoice,
  InvoicePreview,
  ChatResponse,
  ChatSessionInfo,
  ChatSessionDetail,
  HoursExtractionResponse,
  QuickInvoiceResponse,
  GenerateEmailResponse,
  QuickHoursEntry,
} from '../types';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleError = (error: AxiosError): never => {
  if (error.response) {
    const message = (error.response.data as { detail?: string })?.detail || 'An error occurred';
    throw new Error(message);
  }
  throw error;
};

// Client API
export const clientsApi = {
  list: async (): Promise<Client[]> => {
    try {
      const response = await api.get('/api/clients');
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  get: async (id: string): Promise<Client> => {
    try {
      const response = await api.get(`/api/clients/${id}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  create: async (data: Partial<Client>): Promise<Client> => {
    try {
      const response = await api.post('/api/clients', data);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  update: async (id: string, data: Partial<Client>): Promise<Client> => {
    try {
      const response = await api.put(`/api/clients/${id}`, data);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/clients/${id}`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },
};

// Invoice API
export const invoicesApi = {
  list: async (params?: {
    client_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    include_archived?: boolean;
  }): Promise<Invoice[]> => {
    try {
      const response = await api.get('/api/invoices', { params });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  archive: async (id: string): Promise<void> => {
    try {
      await api.post(`/api/invoices/${id}/archive`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  restore: async (id: string): Promise<void> => {
    try {
      await api.post(`/api/invoices/${id}/restore`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  get: async (id: string): Promise<Invoice> => {
    try {
      const response = await api.get(`/api/invoices/${id}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  create: async (data: Partial<Invoice>): Promise<Invoice> => {
    try {
      const response = await api.post('/api/invoices', data);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  update: async (id: string, data: Partial<Invoice>): Promise<Invoice> => {
    try {
      const response = await api.put(`/api/invoices/${id}`, data);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/invoices/${id}`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  getPdfUrl: (id: string): string => {
    return `${API_BASE_URL}/api/invoices/${id}/pdf`;
  },
};

// Chat API
export const chatApi = {
  // Session management
  listSessions: async (clientId?: string, includeArchived?: boolean): Promise<ChatSessionInfo[]> => {
    try {
      const params: Record<string, string | boolean> = {};
      if (clientId) params.client_id = clientId;
      if (includeArchived) params.include_archived = true;
      const response = await api.get('/api/chat/sessions', { params });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  archiveSession: async (sessionId: string): Promise<void> => {
    try {
      await api.post(`/api/chat/sessions/${sessionId}/archive`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  restoreSession: async (sessionId: string): Promise<void> => {
    try {
      await api.post(`/api/chat/sessions/${sessionId}/restore`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  createSession: async (clientId?: string, title?: string): Promise<ChatSessionInfo> => {
    try {
      const response = await api.post('/api/chat/sessions', {
        client_id: clientId,
        title,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  getSession: async (sessionId: string): Promise<ChatSessionDetail> => {
    try {
      const response = await api.get(`/api/chat/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    try {
      await api.delete(`/api/chat/sessions/${sessionId}`);
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  // Messaging
  send: async (content: string, sessionId?: string, imageUrls?: string[]): Promise<ChatResponse> => {
    try {
      const response = await api.post('/api/chat', {
        content,
        session_id: sessionId,
        image_url: imageUrls?.[0],  // Primary image for legacy support
        image_urls: imageUrls,  // All images
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  // Upload image to S3
  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/chat/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  confirm: async (sessionId: string): Promise<ChatResponse> => {
    try {
      const response = await api.post('/api/chat/confirm', {
        session_id: sessionId,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  // Save an event message to chat history (persists to DB)
  saveEvent: async (sessionId: string, content: string, eventType?: string): Promise<void> => {
    try {
      await api.post(`/api/chat/sessions/${sessionId}/event`, {
        content,
        event_type: eventType,
      });
    } catch (error) {
      console.error('Failed to save event:', error);
      // Don't throw - event saving is not critical
    }
  },

  // Set the current preview for a session (for version dropdown selection)
  setPreviewData: async (sessionId: string, preview: object): Promise<void> => {
    await api.post(`/api/chat/sessions/${sessionId}/set-preview-data`, {
      preview,
    });
  },

  // Set a specific preview version as current (for "Use this version" feature)
  setPreviewVersion: async (sessionId: string, messageId: string): Promise<{ invoice_preview: InvoicePreview }> => {
    try {
      const response = await api.post(`/api/chat/sessions/${sessionId}/set-preview?message_id=${messageId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  createClient: async (
    sessionId: string,
    name: string,
    email?: string,
    defaultRate?: number,
    templateType?: string
  ): Promise<ChatResponse> => {
    try {
      const response = await api.post('/api/chat/create-client', {
        session_id: sessionId,
        name,
        email,
        default_rate: defaultRate,
        template_type: templateType,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  getHistory: async (sessionId: string): Promise<{
    session_id: string;
    history: Array<{ role: string; content: string }>;
    has_preview: boolean;
  }> => {
    try {
      const response = await api.get(`/api/chat/session/${sessionId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },
};

// Quick Invoice API
export const quickInvoiceApi = {
  extractHoursFromImage: async (
    imageBase64: string,
    startDate: string,
    endDate: string,
    imageType: string = 'image/png'
  ): Promise<HoursExtractionResponse> => {
    try {
      const response = await api.post('/api/quick-invoice/extract-hours-image', {
        image_base64: imageBase64,
        start_date: startDate,
        end_date: endDate,
        image_type: imageType,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  parseHoursText: async (
    text: string,
    startDate: string,
    endDate: string
  ): Promise<HoursExtractionResponse> => {
    try {
      const response = await api.post('/api/quick-invoice/parse-hours-text', {
        text,
        start_date: startDate,
        end_date: endDate,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  generateEmail: async (
    clientName: string,
    invoiceNumber: string,
    periodStart: string,
    periodEnd: string,
    totalHours: number | null,
    rate: number | null,
    totalAmount: number,
    invoiceType: string = 'hourly',
    paymentNumber?: string
  ): Promise<GenerateEmailResponse> => {
    try {
      const response = await api.post('/api/quick-invoice/generate-email', {
        client_name: clientName,
        invoice_number: invoiceNumber,
        period_start: periodStart,
        period_end: periodEnd,
        total_hours: totalHours,
        rate,
        total_amount: totalAmount,
        invoice_type: invoiceType,
        payment_number: paymentNumber,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },

  createQuickInvoice: async (
    clientId: string,
    startDate: string,
    endDate: string,
    hoursEntries: QuickHoursEntry[],
    rate?: number,
    notes?: string,
    generateEmail: boolean = true
  ): Promise<QuickInvoiceResponse> => {
    try {
      const response = await api.post('/api/quick-invoice/create', {
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        hours_entries: hoursEntries,
        rate,
        notes,
        generate_email: generateEmail,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError);
    }
  },
};

export default api;
