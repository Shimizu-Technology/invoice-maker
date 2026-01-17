/**
 * Chat interface component for AI-powered invoice creation.
 * Features: Client-based chat sessions, persistent conversations, session sidebar.
 * Session ID is managed via URL for shareable links and proper browser history.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi, clientsApi, invoicesApi } from '../services/api';
import type { ChatMessage, InvoicePreview, ChatSessionInfo, Client } from '../types';

interface PendingClientCreation {
  name: string;
  templateType: string;
  originalMessage: string;
  originalImageUrls?: string[];  // Store images to retry after client creation
}

interface CreatedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  pdfUrl: string;
  emailSubject?: string;
  emailBody?: string;
}

interface ChatInterfaceProps {
  sessionIdFromUrl?: string;
}

export default function ChatInterface({ sessionIdFromUrl }: ChatInterfaceProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<InvoicePreview | null>(null);
  // Start with sidebar hidden on mobile, shown on desktop
  const [showSidebar, setShowSidebar] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640; // sm breakpoint
    }
    return true;
  });
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [pendingClientCreation, setPendingClientCreation] = useState<PendingClientCreation | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  
  // Image upload state - support multiple images
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Track which message previews have expanded hours entries
  const [expandedPreviews, setExpandedPreviews] = useState<Set<number>>(new Set());
  
  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // PDF preview modal
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  
  // Copy success feedback - stores message index that was just copied
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions and clients on mount
  useEffect(() => {
    loadSessions();
    loadClients();
  }, []);

  // Load session from URL when sessionIdFromUrl changes
  useEffect(() => {
    if (sessionIdFromUrl && sessionIdFromUrl !== currentSessionId) {
      loadSession(sessionIdFromUrl, false); // Don't update URL since we're loading from URL
    }
  }, [sessionIdFromUrl]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await chatApi.listSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await clientsApi.list();
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadSession = async (sessionId: string, updateUrl = true) => {
    try {
      const session = await chatApi.getSession(sessionId);
      setCurrentSessionId(session.id);
      
      // Update URL to include session ID (if not already there)
      if (updateUrl && sessionIdFromUrl !== session.id) {
        navigate(`/chat/${session.id}`, { replace: true });
      }
      
      // Convert messages including invoice_preview and images
      const convertedMessages: ChatMessage[] = session.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp || Date.now()),
        invoicePreview: msg.invoice_preview || undefined,  // Map invoice preview from API
        imageUrl: msg.image_url || undefined,  // Map single image URL from API (legacy)
        imageUrls: msg.image_urls || undefined,  // Map multiple image URLs from API
      }));
      setMessages(convertedMessages);
      
      // Check if this session has a completed invoice (invoice_id in preview)
      if (session.invoice_preview?.invoice_id) {
        // Invoice was already created - show success state with email
        setCreatedInvoice({
          invoiceId: session.invoice_preview.invoice_id,
          invoiceNumber: session.invoice_preview.invoice_number,
          pdfUrl: session.invoice_preview.pdf_url || `/api/invoices/${session.invoice_preview.invoice_id}/pdf`,
          emailSubject: session.invoice_preview.email_subject || undefined,
          emailBody: session.invoice_preview.email_body || undefined,
        });
        setCurrentPreview(session.invoice_preview); // Keep preview for display
      } else if (session.invoice_preview) {
        // Preview exists but invoice not yet created
        setCurrentPreview(session.invoice_preview);
        setCreatedInvoice(null);
      } else {
        setCurrentPreview(null);
        setCreatedInvoice(null);
      }
      setPendingClientCreation(null);
    } catch (error) {
      console.error('Failed to load session:', error);
      // Navigate back to /chat if session load fails
      navigate('/chat', { replace: true });
    }
  };

  const createNewSession = async (clientId?: string) => {
    try {
      const session = await chatApi.createSession(clientId);
      setCurrentSessionId(session.id);
      setMessages([]);
      setCurrentPreview(null);
      setCreatedInvoice(null);
      setPendingClientCreation(null);
      
      // Navigate to new session URL
      navigate(`/chat/${session.id}`);
      
      await loadSessions(); // Refresh session list
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await chatApi.deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setCurrentPreview(null);
        setPendingClientCreation(null);
        setCreatedInvoice(null);
        // Navigate back to /chat
        navigate('/chat', { replace: true });
      }
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent, messageOverride?: string) => {
    e?.preventDefault?.();
    const userMessage = (messageOverride || input).trim();
    if (!userMessage || isLoading) return;

    // Handle multiple image uploads
    let imageUrls: string[] = [];
    const imagesToUpload = [...pendingImages];
    
    if (!messageOverride) {
      setInput('');
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      
      // Add user message with image previews
      setMessages((prev) => [
        ...prev,
        { 
          role: 'user', 
          content: userMessage, 
          timestamp: new Date(),
          imageUrls: imagesToUpload.map(img => img.preview), // Show local previews immediately
        },
      ]);
      
      // Clear pending images after adding to message
      if (imagesToUpload.length > 0) {
        setPendingImages([]);
      }
    }
    setIsLoading(true);
    setPendingClientCreation(null); // Clear any pending client creation

    try {
      // Upload images to S3 if present
      if (imagesToUpload.length > 0) {
        setIsUploadingImage(true);
        try {
          // Upload all images in parallel
          const uploadPromises = imagesToUpload.map(img => chatApi.uploadImage(img.file));
          const uploadResults = await Promise.all(uploadPromises);
          imageUrls = uploadResults.map(result => result.url);
          
          // Update the message with the S3 URLs instead of local previews
          setMessages((prev) => 
            prev.map((msg, idx) => 
              idx === prev.length - 1 && msg.role === 'user'
                ? { ...msg, imageUrls }
                : msg
            )
          );
        } catch (uploadError) {
          console.error('Failed to upload images:', uploadError);
          // Continue without images if upload fails
        } finally {
          setIsUploadingImage(false);
          // Revoke the object URLs to free memory
          imagesToUpload.forEach(img => URL.revokeObjectURL(img.preview));
        }
      }

      const response = await chatApi.send(userMessage, currentSessionId || undefined, imageUrls.length > 0 ? imageUrls : undefined);
      
      // Update session ID and URL if new session was created
      if (response.session_id !== currentSessionId) {
        setCurrentSessionId(response.session_id);
        navigate(`/chat/${response.session_id}`, { replace: true });
        await loadSessions(); // Refresh to show new session
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };

      if (response.status === 'preview' && response.invoice_preview) {
        assistantMessage.invoicePreview = response.invoice_preview;
        setCurrentPreview(response.invoice_preview);
      }

      if (response.status === 'invoice_created' && response.pdf_url && response.invoice_id) {
        // Extract invoice number from message (format: "Invoice XXX created successfully!")
        const invoiceMatch = response.message.match(/Invoice\s+(\S+)\s+created/i);
        const invoiceNumber = invoiceMatch ? invoiceMatch[1] : 'Invoice';
        
        setCreatedInvoice({
          invoiceId: response.invoice_id,
          invoiceNumber: invoiceNumber,
          pdfUrl: response.pdf_url,
        });
        setCurrentPreview(null);
        await loadSessions(); // Refresh session list
      }

      // Handle client not found - store for potential creation (including images)
      if (response.status === 'client_not_found' && response.suggested_client) {
        setPendingClientCreation({
          name: response.suggested_client.name,
          templateType: response.suggested_client.template_type || 'project',
          originalMessage: userMessage,
          originalImageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        });
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!pendingClientCreation || !currentSessionId) return;
    
    setIsLoading(true);
    try {
      // Create the client
      const response = await chatApi.createClient(
        currentSessionId,
        pendingClientCreation.name,
        undefined, // email
        0, // default rate
        pendingClientCreation.templateType
      );

      // Add success message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        },
      ]);

      // Refresh clients list
      await loadClients();
      await loadSessions();

      // Store the original message and images to retry
      const originalMessage = pendingClientCreation.originalMessage;
      const originalImageUrls = pendingClientCreation.originalImageUrls;
      setPendingClientCreation(null);

      // Auto-retry the original invoice request (with images if present)
      setMessages((prev) => [
        ...prev,
        { 
          role: 'user', 
          content: originalMessage, 
          timestamp: new Date(),
          imageUrls: originalImageUrls,  // Include original images
        },
      ]);
      
      // Send the original message again WITH images
      const retryResponse = await chatApi.send(
        originalMessage, 
        currentSessionId,
        originalImageUrls  // Pass images to the API
      );
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: retryResponse.message,
        timestamp: new Date(),
      };

      if (retryResponse.status === 'preview' && retryResponse.invoice_preview) {
        assistantMessage.invoicePreview = retryResponse.invoice_preview;
        setCurrentPreview(retryResponse.invoice_preview);
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error creating client: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmInvoice = async () => {
    if (!currentSessionId || !currentPreview || isLoading) return;

    setIsLoading(true);
    // Add user message showing they confirmed
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'Generate PDF', timestamp: new Date() },
    ]);

    try {
      const response = await chatApi.confirm(currentSessionId);

      if (response.status === 'invoice_created' && response.pdf_url && response.invoice_id) {
        const invoiceMatch = response.message.match(/Invoice\s+(\S+)\s+created/i);
        const invoiceNumber = invoiceMatch ? invoiceMatch[1] : 'Invoice';

        setCreatedInvoice({
          invoiceId: response.invoice_id,
          invoiceNumber: invoiceNumber,
          pdfUrl: response.pdf_url,
          emailSubject: response.email_subject || undefined,
          emailBody: response.email_body || undefined,
        });
        setCurrentPreview(null);

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.message, timestamp: new Date() },
        ]);
        await loadSessions();
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.message, timestamp: new Date() },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to generate PDF'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (createdInvoice?.pdfUrl) {
      // Open PDF in new tab (browser will handle download or display)
      const fullUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${createdInvoice.pdfUrl}`;
      window.open(fullUrl, '_blank');
    }
  };

  const handleViewInvoice = () => {
    if (createdInvoice?.invoiceId) {
      // Navigate to invoice detail page using React Router
      navigate(`/invoices/${createdInvoice.invoiceId}`);
    }
  };

  // Track if email was copied (for "Mark as Sent" prompt)
  const [emailCopied, setEmailCopied] = useState(false);
  const [markedAsSent, setMarkedAsSent] = useState(false);

  const handleCopyEmail = async () => {
    if (createdInvoice?.emailBody) {
      try {
        await navigator.clipboard.writeText(createdInvoice.emailBody);
        setEmailCopied(true);
      } catch (err) {
        console.error('Failed to copy email:', err);
      }
    }
  };

  const handleMarkAsSent = async () => {
    if (createdInvoice?.invoiceId) {
      try {
        await invoicesApi.update(createdInvoice.invoiceId, { status: 'sent' });
        setMarkedAsSent(true);
      } catch (err) {
        console.error('Failed to mark as sent:', err);
      }
    }
  };

  const handleCopyMessage = async (content: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(messageIndex);
      // Clear after 2 seconds
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  // Image handling - supports multiple images
  const handleImageSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select an image file (JPEG, PNG, GIF, or WebP)');
      return;
    }
    
    // Validate file size (10MB max per image)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Maximum size is 10MB per image.');
      return;
    }
    
    // Limit to 5 images max
    if (pendingImages.length >= 5) {
      alert('Maximum 5 images allowed per message.');
      return;
    }
    
    // Create preview and add to array
    const preview = URL.createObjectURL(file);
    setPendingImages(prev => [...prev, { file, preview }]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageSelect(file);
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Handle multiple dropped files
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        handleImageSelect(file);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => handleImageSelect(file));
    // Reset input so same files can be selected again
    e.target.value = '';
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAllPendingImages = () => {
    pendingImages.forEach(img => URL.revokeObjectURL(img.preview));
    setPendingImages([]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex h-full relative">
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar - Slide-out drawer on mobile, static on desktop */}
      <div className={`
        fixed sm:relative inset-y-0 left-0 z-50 sm:z-auto
        w-72 sm:w-64 
        transform transition-transform duration-200 ease-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full sm:translate-x-0 sm:w-0 sm:overflow-hidden'}
        bg-white sm:bg-stone-50 
        border-r border-stone-200 
        flex flex-col
        shadow-xl sm:shadow-none
      `}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-stone-200 flex items-center justify-between">
          <span className="font-display font-semibold text-stone-700 sm:hidden">Chat History</span>
          <button
            onClick={() => setShowSidebar(false)}
            className="sm:hidden p-2 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-b border-stone-200">
          <button
            onClick={() => { createNewSession(); setShowSidebar(false); }}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all text-sm font-medium shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        {/* Quick start with client */}
        {clients.length > 0 && (
          <div className="p-3 border-b border-stone-200">
            <select
              onChange={(e) => {
                if (e.target.value) { createNewSession(e.target.value); setShowSidebar(false); }
              }}
              className="w-full px-3 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white min-h-[44px]"
              defaultValue=""
            >
              <option value="" disabled>Start with client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingSessions ? (
            <div className="p-4 text-center text-stone-500 text-sm">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-stone-400 text-sm">
              <svg className="w-12 h-12 mx-auto mb-3 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              No chats yet
            </div>
          ) : (
            <div className="py-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group px-3 py-3 mx-2 mb-1 rounded-lg cursor-pointer flex items-center justify-between min-h-[56px] transition-colors ${
                    session.id === currentSessionId
                      ? 'bg-teal-50 border border-teal-200'
                      : 'hover:bg-stone-100'
                  }`}
                  onClick={() => { loadSession(session.id); setShowSidebar(false); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${session.id === currentSessionId ? 'text-teal-700' : 'text-stone-700'}`}>
                      {session.client_name || session.title}
                    </div>
                    <div className="text-xs text-stone-500 truncate mt-0.5">
                      {session.last_message || 'No messages'}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {formatDate(session.updated_at)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this chat?')) {
                        deleteSession(session.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-stone-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-soft overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-200 bg-gradient-to-r from-stone-50 to-white flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowSidebar(true)}
            className="sm:hidden p-2 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold text-stone-800 truncate">
              {currentSessionId && sessions.find(s => s.id === currentSessionId)?.client_name
                ? sessions.find(s => s.id === currentSessionId)?.client_name
                : 'Invoice Assistant'}
            </h2>
            <p className="text-sm text-stone-500 hidden sm:block">
              Tell me what invoice you need
            </p>
          </div>

          {/* Desktop sidebar toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="hidden sm:flex p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 min-w-[40px] min-h-[40px] items-center justify-center"
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </button>
        </div>

        {/* Messages - with drag-drop support */}
        <div 
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-stone-700 mb-2">
                Start a conversation
              </h3>
              <p className="text-stone-500 mb-6 max-w-sm">
                Tell me what invoice you need and I'll create it for you.
              </p>
              <div className="space-y-2 text-sm text-stone-600">
                <p className="text-xs uppercase tracking-wide text-stone-400 font-medium mb-2">Try saying:</p>
                <button 
                  onClick={() => setInput('Create an invoice for Spectrio for 40 hours in January')}
                  className="block w-full text-left px-4 py-2.5 rounded-lg bg-stone-50 hover:bg-teal-50 hover:text-teal-700 transition-colors border border-stone-200 hover:border-teal-200"
                >
                  "Create an invoice for Spectrio for 40 hours in January"
                </button>
                <button 
                  onClick={() => setInput('Bill Code School $500 for January tuition')}
                  className="block w-full text-left px-4 py-2.5 rounded-lg bg-stone-50 hover:bg-teal-50 hover:text-teal-700 transition-colors border border-stone-200 hover:border-teal-200"
                >
                  "Bill Code School $500 for January tuition"
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn group/message`}
            >
              <div className="relative max-w-[85%] sm:max-w-[75%]">
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-br-md'
                      : 'bg-stone-100 text-stone-800 rounded-bl-md'
                  }`}
                >
                  {/* Image attachments - support multiple images */}
                  {(message.imageUrls?.length || message.imageUrl) && (
                    <div className={`mb-2 flex flex-wrap gap-2 ${(message.imageUrls?.length || 0) > 1 ? '' : ''}`}>
                      {(message.imageUrls || (message.imageUrl ? [message.imageUrl] : [])).map((url, imgIdx) => (
                        <img 
                          key={imgIdx}
                          src={url} 
                          alt={`Attached image ${imgIdx + 1}`} 
                          className="max-w-[200px] max-h-48 rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity border border-white/20"
                          onClick={() => setPreviewImage(url)}
                        />
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>

                {/* Invoice Preview */}
                {message.invoicePreview && (
                  <div className="mt-4 p-4 bg-white rounded-xl border border-stone-200 text-stone-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h4 className="font-display font-semibold text-stone-700">Invoice Preview</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <p><span className="text-stone-500">Client:</span> {message.invoicePreview.client_name}</p>
                        <p><span className="text-stone-500">Invoice #:</span> {message.invoicePreview.invoice_number}</p>
                        <p><span className="text-stone-500">Date:</span> {message.invoicePreview.date}</p>
                        {message.invoicePreview.service_period_start && (
                          <p><span className="text-stone-500">Period:</span> {message.invoicePreview.service_period_start} - {message.invoicePreview.service_period_end}</p>
                        )}
                      </div>

                      {/* Hours Entries */}
                      {message.invoicePreview.hours_entries.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-stone-100">
                          <p className="text-stone-500 font-medium mb-1">Hours:</p>
                          <div className="space-y-1 text-xs">
                            {(expandedPreviews.has(index) 
                              ? message.invoicePreview.hours_entries 
                              : message.invoicePreview.hours_entries.slice(0, 5)
                            ).map((entry, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{entry.date}: {entry.hours}h @ ${entry.rate}/hr</span>
                                <span className="font-medium">{formatCurrency(entry.amount)}</span>
                              </div>
                            ))}
                            {message.invoicePreview.hours_entries.length > 5 && (
                              <button
                                onClick={() => {
                                  setExpandedPreviews(prev => {
                                    const next = new Set(prev);
                                    if (next.has(index)) {
                                      next.delete(index);
                                    } else {
                                      next.add(index);
                                    }
                                    return next;
                                  });
                                }}
                                className="text-teal-600 hover:text-teal-700 hover:underline mt-1"
                              >
                                {expandedPreviews.has(index) 
                                  ? '− Show less' 
                                  : `+ Show ${message.invoicePreview.hours_entries.length - 5} more entries`}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Line Items */}
                      {message.invoicePreview.line_items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-stone-100">
                          <p className="text-stone-500 font-medium mb-1">Items:</p>
                          <div className="space-y-1 text-xs">
                            {message.invoicePreview.line_items.map((item, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{item.description}</span>
                                <span className="font-medium">{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-stone-200 flex justify-between items-center">
                        <span className="font-semibold text-stone-700">Total</span>
                        <span className="text-xl font-display font-bold text-teal-700">
                          {formatCurrency(message.invoicePreview.total_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                </div>
                
                {/* Copy button - at bottom of message, appears on hover */}
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity`}>
                  <button
                    onClick={() => handleCopyMessage(message.content, index)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                      copiedMessageIndex === index
                        ? 'text-emerald-600'
                        : 'text-stone-400 hover:text-stone-600'
                    }`}
                    title="Copy message"
                  >
                    {copiedMessageIndex === index ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="bg-stone-100 rounded-2xl rounded-bl-md px-5 py-4">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending Client Creation */}
        {pendingClientCreation && (
          <div className="px-4 sm:px-6 py-3 border-t border-amber-200 bg-amber-50">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span className="text-sm">
                  Create new client "<strong>{pendingClientCreation.name}</strong>"?
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateClient}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors min-h-[44px] disabled:opacity-50 font-medium"
                >
                  Create Client
                </button>
                <button
                  onClick={() => setPendingClientCreation(null)}
                  className="px-4 py-2.5 bg-white text-stone-600 text-sm rounded-lg hover:bg-stone-100 transition-colors min-h-[44px] border border-stone-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Preview Actions */}
        {currentPreview && !pendingClientCreation && !createdInvoice && (
          <div className="px-4 sm:px-6 py-3 border-t border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-teal-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Invoice preview ready</span>
              </div>
              <button
                onClick={handleConfirmInvoice}
                disabled={isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-sm rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all min-h-[44px] disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate PDF
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Invoice Created Success */}
        {createdInvoice && (
          <div className="px-4 sm:px-6 py-4 border-t border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-display font-semibold">Invoice {createdInvoice.invoiceNumber} created!</span>
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 min-h-[44px] font-medium shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setShowPdfPreview(true)}
                  className="px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 min-h-[44px] font-medium shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Preview PDF
                </button>
                {createdInvoice.emailBody && (
                  <button
                    onClick={handleCopyEmail}
                    className={`px-4 py-2.5 text-white text-sm rounded-lg transition-colors flex items-center gap-2 min-h-[44px] font-medium shadow-sm ${
                      emailCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {emailCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Email
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleViewInvoice}
                  className="px-4 py-2.5 bg-stone-600 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors flex items-center gap-2 min-h-[44px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View
                </button>
                <button
                  onClick={() => {
                    setCreatedInvoice(null);
                    setEmailCopied(false);
                    setMarkedAsSent(false);
                  }}
                  className="px-4 py-2.5 bg-white text-stone-600 text-sm rounded-lg hover:bg-stone-100 transition-colors border border-stone-300 min-h-[44px]"
                >
                  Dismiss
                </button>
              </div>

              {/* Email preview */}
              {createdInvoice.emailBody && (
                <details className="mt-2">
                  <summary className="text-sm text-teal-700 cursor-pointer hover:text-teal-800 font-medium">
                    Preview email
                  </summary>
                  <div className="mt-2 p-3 bg-white rounded-lg border border-stone-200 text-sm">
                    <p className="text-stone-500 mb-1">
                      <span className="font-medium">Subject:</span> {createdInvoice.emailSubject}
                    </p>
                    <pre className="whitespace-pre-wrap text-stone-700 font-sans text-sm leading-relaxed">
                      {createdInvoice.emailBody}
                    </pre>
                  </div>
                </details>
              )}

              {/* Mark as Sent prompt - shows after copying email */}
              {emailCopied && !markedAsSent && (
                <div className="mt-3 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="text-sm text-amber-800">Email copied! Did you send it?</span>
                  <button
                    onClick={handleMarkAsSent}
                    className="ml-auto px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors font-medium"
                  >
                    Mark as Sent
                  </button>
                </div>
              )}

              {/* Sent confirmation */}
              {markedAsSent && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-800">Invoice marked as sent!</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-stone-200 bg-stone-50">
          {/* Hidden file input - supports multiple files */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
          />
          
          {/* Pending images preview - supports multiple */}
          {pendingImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 items-start">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative inline-block">
                  <img 
                    src={img.preview} 
                    alt={`Image ${idx + 1} to send`} 
                    className="max-h-24 rounded-lg border border-stone-300 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => removePendingImage(idx)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                    title="Remove image"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {isUploadingImage && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  Uploading...
                </div>
              )}
              {pendingImages.length > 1 && (
                <button
                  type="button"
                  onClick={clearAllPendingImages}
                  className="text-xs text-red-500 hover:text-red-700 underline self-center"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
          
          <div className="flex gap-2 sm:gap-3 items-end">
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || pendingImages.length >= 5}
              className="p-3 border border-stone-300 rounded-xl hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center text-stone-500 hover:text-teal-600 relative"
              title={pendingImages.length >= 5 ? "Maximum 5 images" : "Upload images"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {pendingImages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-600 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingImages.length}
                </span>
              )}
            </button>
            
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize textarea
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }}
                onKeyDown={(e) => {
                  // Enter to send, Shift+Enter for new line
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading) {
                      handleSubmit(e);
                    }
                  }
                }}
                onPaste={handlePaste}
                placeholder="Type your message... (paste images with Cmd/Ctrl+V)"
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[48px] max-h-[150px] bg-white text-stone-800 placeholder:text-stone-400 resize-none overflow-y-auto leading-relaxed"
                disabled={isLoading}
                rows={1}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 sm:px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl hover:from-teal-700 hover:to-teal-800 disabled:from-stone-300 disabled:to-stone-400 disabled:cursor-not-allowed transition-all min-h-[48px] min-w-[48px] sm:min-w-auto shadow-sm flex items-center justify-center gap-2 self-end"
            >
              <span className="hidden sm:inline font-medium">Send</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-1.5 text-center sm:text-left">
            <kbd className="px-1.5 py-0.5 bg-stone-200 rounded text-stone-600 font-mono text-[10px]">Enter</kbd> send · <kbd className="px-1.5 py-0.5 bg-stone-200 rounded text-stone-600 font-mono text-[10px]">Shift+Enter</kbd> new line · Paste or drop images
          </p>
        </form>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            {/* Close button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors flex items-center gap-2"
            >
              <span className="text-sm">Close</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Image */}
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Open in new tab link */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && createdInvoice?.pdfUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowPdfPreview(false)}
        >
          <div 
            className="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50 rounded-t-lg">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-stone-800">{createdInvoice.invoiceNumber}.pdf</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="p-1.5 text-stone-500 hover:text-stone-700 hover:bg-stone-200 rounded-md transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* PDF Iframe */}
            <div className="flex-1 bg-stone-100">
              <iframe
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${createdInvoice.pdfUrl}?inline=true`}
                className="w-full h-full rounded-b-lg"
                title="Invoice PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
