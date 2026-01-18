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
  version?: number;  // Track which preview version was used
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
  const [previewVersion, setPreviewVersion] = useState(0); // Track preview iterations
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
  const [dismissedInvoice, setDismissedInvoice] = useState<CreatedInvoice | null>(null);
  
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
  
  // Archive toggle for sessions
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  
  // Track all preview versions for dropdown selection
  const [previewHistory, setPreviewHistory] = useState<Array<{version: number; messageId?: string; preview: InvoicePreview}>>([]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  
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

  // Close version dropdown when clicking outside
  useEffect(() => {
    if (showVersionDropdown) {
      const handleClickOutside = () => setShowVersionDropdown(false);
      // Small delay to prevent immediate close on click
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showVersionDropdown]);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await chatApi.listSessions(undefined, showArchivedSessions);
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };
  
  // Reload sessions when archive toggle changes
  useEffect(() => {
    loadSessions();
  }, [showArchivedSessions]);

  const handleArchiveSession = async (sessionId: string) => {
    try {
      await chatApi.archiveSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // If we archived the current session, create a new one
      if (currentSessionId === sessionId) {
        createNewSession();
      }
    } catch (error) {
      console.error('Failed to archive session:', error);
    }
  };

  const handleRestoreSession = async (sessionId: string) => {
    try {
      await chatApi.restoreSession(sessionId);
      if (!showArchivedSessions) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        setSessions((prev) => prev.map((s) => 
          s.id === sessionId ? { ...s, archived: false } : s
        ));
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
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
      // Count previews to set version correctly and build preview history
      let versionCount = 0;
      const history: Array<{version: number; messageId?: string; preview: InvoicePreview}> = [];
      
      const convertedMessages: ChatMessage[] = session.messages.map(msg => {
        const hasPreview = msg.invoice_preview !== null && msg.invoice_preview !== undefined;
        if (hasPreview && msg.invoice_preview) {
          versionCount++;
          const versionedPreview = { ...msg.invoice_preview, version: versionCount } as InvoicePreview;
          // Add to history for dropdown selection
          history.push({ version: versionCount, messageId: msg.id, preview: versionedPreview });
        }
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp || Date.now()),
          invoicePreview: hasPreview && msg.invoice_preview
            ? { ...msg.invoice_preview, version: msg.invoice_preview.version || versionCount } as InvoicePreview
            : undefined,
          imageUrl: msg.image_url || undefined,
          imageUrls: msg.image_urls || undefined,
        };
      });
      setMessages(convertedMessages);
      setPreviewVersion(versionCount);
      setPreviewHistory(history);
      
      // Check if this session has a completed invoice (invoice_id in preview)
      if (session.invoice_preview?.invoice_id) {
        // Invoice was already created - show success state with email
        setCreatedInvoice({
          invoiceId: session.invoice_preview.invoice_id,
          invoiceNumber: session.invoice_preview.invoice_number,
          pdfUrl: session.invoice_preview.pdf_url || `/api/invoices/${session.invoice_preview.invoice_id}/pdf`,
          emailSubject: session.invoice_preview.email_subject || undefined,
          emailBody: session.invoice_preview.email_body || undefined,
          version: session.invoice_preview.version || versionCount,
        });
        setCurrentPreview(session.invoice_preview); // Keep preview for display
      } else if (session.invoice_preview) {
        // Preview exists but invoice not yet created
        setCurrentPreview(session.invoice_preview);
        setCreatedInvoice(null);
        setDismissedInvoice(null);
      } else {
        setCurrentPreview(null);
        setCreatedInvoice(null);
        setDismissedInvoice(null);
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
      setPreviewVersion(0); // Reset version counter for new session
      setPreviewHistory([]); // Reset preview history for new session
      setCreatedInvoice(null);
      setDismissedInvoice(null);
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
        setDismissedInvoice(null);
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
        // Increment version for new preview
        const newVersion = previewVersion + 1;
        setPreviewVersion(newVersion);
        
        // Add version to the preview
        const versionedPreview = { ...response.invoice_preview, version: newVersion };
        assistantMessage.invoicePreview = versionedPreview;
        setCurrentPreview(versionedPreview);
        
        // Add to preview history for dropdown selection
        setPreviewHistory(prev => [...prev, { version: newVersion, preview: versionedPreview }]);
        
        // Clear any previously created invoice - user is now working on a new/modified invoice
        // This prevents confusion with old success banner showing alongside new preview
        if (createdInvoice) {
          setCreatedInvoice(null);
          setDismissedInvoice(null);
        }
      }

      if (response.status === 'invoice_created' && response.pdf_url && response.invoice_id) {
        // Extract invoice number from message (format: "Invoice XXX created successfully!")
        const invoiceMatch = response.message.match(/Invoice\s+(\S+)\s+created/i);
        const invoiceNumber = invoiceMatch ? invoiceMatch[1] : 'Invoice';
        
        // Capture version if we have a current preview
        const usedVersion = currentPreview?.version;
        
        setCreatedInvoice({
          invoiceId: response.invoice_id,
          invoiceNumber: invoiceNumber,
          pdfUrl: response.pdf_url,
          version: usedVersion,
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
        // Increment version for new preview
        const newVersion = previewVersion + 1;
        setPreviewVersion(newVersion);
        
        const versionedPreview = { ...retryResponse.invoice_preview, version: newVersion };
        assistantMessage.invoicePreview = versionedPreview;
        setCurrentPreview(versionedPreview);
        
        // Add to preview history for dropdown selection
        setPreviewHistory(prev => [...prev, { version: newVersion, preview: versionedPreview }]);
        
        // Clear any previously created invoice
        if (createdInvoice) {
          setCreatedInvoice(null);
          setDismissedInvoice(null);
        }
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
        
        // Capture the version before clearing preview
        const usedVersion = currentPreview?.version;

        setCreatedInvoice({
          invoiceId: response.invoice_id,
          invoiceNumber: invoiceNumber,
          pdfUrl: response.pdf_url,
          emailSubject: response.email_subject || undefined,
          emailBody: response.email_body || undefined,
          version: usedVersion,
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
        // Include subject line with the body
        const emailText = createdInvoice.emailSubject 
          ? `Subject: ${createdInvoice.emailSubject}\n\n${createdInvoice.emailBody}`
          : createdInvoice.emailBody;
        await navigator.clipboard.writeText(emailText);
        setEmailCopied(true);
      } catch (err) {
        console.error('Failed to copy email:', err);
      }
    }
  };

  const handleMarkAsSent = async () => {
    if (createdInvoice?.invoiceId && currentSessionId) {
      try {
        // Update invoice status in DB
        await invoicesApi.update(createdInvoice.invoiceId, { status: 'sent' });
        setMarkedAsSent(true);
        
        // Save event to chat history (persists to DB)
        const eventContent = `✅ Invoice ${createdInvoice.invoiceNumber} has been marked as sent.`;
        await chatApi.saveEvent(currentSessionId, eventContent, 'invoice_sent');
        
        // Add to local state immediately
        const sentMessage: ChatMessage = {
          role: 'assistant',
          content: eventContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, sentMessage]);
      } catch (err) {
        console.error('Failed to mark as sent:', err);
      }
    }
  };

  // Handle "Use this version" for historical preview cards
  const handleUseThisVersion = async (messageId: string, preview: InvoicePreview) => {
    if (!currentSessionId || !messageId) return;
    
    try {
      // Call API to set this preview as current
      const result = await chatApi.setPreviewVersion(currentSessionId, messageId);
      
      // Update local state with the restored preview
      const restoredPreview = result.invoice_preview as InvoicePreview;
      
      // Add version number (next in sequence)
      setPreviewVersion((prev) => prev + 1);
      restoredPreview.version = previewVersion + 1;
      
      setCurrentPreview(restoredPreview);
      
      // Clear any created invoice since we're now working with a new preview
      setCreatedInvoice(null);
      setMarkedAsSent(false);
      setDismissedInvoice(null);
      
      // Add a message indicating the version was restored
      const restoreMessage: ChatMessage = {
        role: 'assistant',
        content: `Restored invoice preview v${preview.version || '?'} as the current version. You can now generate the PDF or make further changes.`,
        timestamp: new Date(),
        invoicePreview: restoredPreview,
      };
      setMessages((prev) => [...prev, restoreMessage]);
      
    } catch (err) {
      console.error('Failed to restore preview version:', err);
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

        {/* Archive toggle */}
        <div className="px-3 py-2 border-b border-stone-100">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-500">
            <input
              type="checkbox"
              checked={showArchivedSessions}
              onChange={(e) => setShowArchivedSessions(e.target.checked)}
              className="w-3.5 h-3.5 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            Show archived chats
          </label>
        </div>

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
                    <div className={`text-sm font-medium truncate flex items-center gap-1.5 ${session.id === currentSessionId ? 'text-teal-700' : 'text-stone-700'}`}>
                      {session.client_name || session.title}
                      {session.archived && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-stone-200 text-stone-500 rounded">archived</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 truncate mt-0.5">
                      {session.last_message || 'No messages'}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {formatDate(session.updated_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {session.archived ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-blue-500 hover:text-blue-600 transition-all rounded-lg hover:bg-blue-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Restore"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-stone-400 hover:text-stone-600 transition-all rounded-lg hover:bg-stone-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Archive"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this chat?')) {
                          deleteSession(session.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-stone-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
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
                      {message.invoicePreview.version && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-600 rounded-full">
                          v{message.invoicePreview.version}
                        </span>
                      )}
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
                      
                      {/* "Use this version" button - only for historical previews with message ID */}
                      {message.id && message.invoicePreview.version && (
                        <button
                          onClick={() => handleUseThisVersion(message.id!, message.invoicePreview!)}
                          className="mt-3 w-full py-2 px-3 text-sm text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Use this version
                        </button>
                      )}
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
                
                {/* Version dropdown - only show if there are multiple versions */}
                {previewHistory.length > 1 ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded hover:bg-teal-200 transition-colors"
                    >
                      v{currentPreview?.version || 1}
                      <svg className={`w-3 h-3 transition-transform ${showVersionDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showVersionDropdown && (
                      <div className="absolute bottom-full left-0 mb-1 py-1 bg-white rounded-lg shadow-lg border border-stone-200 min-w-[80px] z-10">
                        {previewHistory.map((item) => (
                          <button
                            key={item.version}
                            onClick={async () => {
                              setCurrentPreview(item.preview);
                              setShowVersionDropdown(false);
                              // Update backend so confirm uses the correct version
                              if (currentSessionId) {
                                try {
                                  await chatApi.setPreviewData(currentSessionId, item.preview);
                                } catch (error) {
                                  console.error('Failed to update preview version:', error);
                                }
                              }
                            }}
                            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-teal-50 ${
                              currentPreview?.version === item.version ? 'bg-teal-50 text-teal-700 font-medium' : 'text-stone-700'
                            }`}
                          >
                            v{item.version}
                            {currentPreview?.version === item.version && ' ✓'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : currentPreview?.version && currentPreview.version > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded">
                    v{currentPreview.version}
                  </span>
                )}
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

        {/* Invoice Created Success - Clean & Compact */}
        {createdInvoice && (
          <div className="px-4 sm:px-6 py-3 border-t border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            {/* Header row with invoice info */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-emerald-700 min-w-0">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-semibold text-sm truncate">{createdInvoice.invoiceNumber}</span>
                {createdInvoice.version && (
                  <span className="px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded font-medium flex-shrink-0">
                    v{createdInvoice.version}
                  </span>
                )}
              </div>
              {/* Dismiss - subtle on right */}
              <button
                onClick={() => {
                  setDismissedInvoice(createdInvoice);
                  setCreatedInvoice(null);
                  setCurrentPreview(null);
                  setEmailCopied(false);
                  setMarkedAsSent(false);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Action buttons - clean grid on mobile, inline on desktop */}
            <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2">
              <button
                onClick={handleDownloadPdf}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                title="Download PDF"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                onClick={() => setShowPdfPreview(true)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium"
                title="Preview PDF"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Preview</span>
              </button>
              {createdInvoice.emailBody && (
                <button
                  onClick={handleCopyEmail}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-white text-xs rounded-lg transition-colors font-medium ${
                    emailCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                  title={emailCopied ? 'Copied!' : 'Copy Email'}
                >
                  {emailCopied ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">{emailCopied ? 'Copied!' : 'Email'}</span>
                </button>
              )}
              <button
                onClick={handleViewInvoice}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 bg-stone-500 text-white text-xs rounded-lg hover:bg-stone-600 transition-colors"
                title="View in History"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="hidden sm:inline">View</span>
              </button>
            </div>

            {/* Email preview - collapsible */}
            {createdInvoice.emailBody && (
              <details className="mt-3">
                <summary className="text-sm text-teal-700 cursor-pointer hover:text-teal-800 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
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

            {/* Mark as Sent prompt - compact */}
            {emailCopied && !markedAsSent && (
              <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="text-xs sm:text-sm text-amber-800 flex-1">Email copied!</span>
                <button
                  onClick={handleMarkAsSent}
                  className="px-2.5 py-1 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 transition-colors font-medium whitespace-nowrap"
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
        )}

        {/* Minimized invoice bar - shows after dismiss */}
        {dismissedInvoice && !createdInvoice && (
          <div className="px-4 sm:px-6 py-2 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <span className="text-sm text-stone-600">
              Invoice {dismissedInvoice.invoiceNumber} created
            </span>
            <button
              onClick={() => {
                setCreatedInvoice(dismissedInvoice);
                setDismissedInvoice(null);
              }}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Show actions
            </button>
        </div>
      )}

      {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-3 sm:py-4 border-t border-stone-200 bg-stone-50">
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
              className="p-3 border border-stone-300 rounded-xl hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-[48px] w-[48px] flex items-center justify-center text-stone-500 hover:text-teal-600 relative flex-shrink-0"
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
            
            {/* Textarea - direct flex child with flex-1, self-end keeps it aligned at bottom */}
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
              placeholder="Type your message..."
              className="flex-1 min-w-0 px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 h-[48px] max-h-[150px] bg-white text-stone-800 placeholder:text-stone-400 resize-none overflow-y-auto leading-normal self-end"
              disabled={isLoading}
              rows={1}
            />
            
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 sm:px-6 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl hover:from-teal-700 hover:to-teal-800 disabled:from-stone-300 disabled:to-stone-400 disabled:cursor-not-allowed transition-all h-[48px] min-w-[48px] sm:min-w-auto shadow-sm flex items-center justify-center gap-2 flex-shrink-0"
            >
              <span className="hidden sm:inline font-medium">Send</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {/* Desktop: show full keyboard shortcuts, Mobile: simplified */}
          <p className="text-xs text-stone-400 mt-1.5 text-center sm:text-left">
            <span className="hidden sm:inline">
              <kbd className="px-1.5 py-0.5 bg-stone-200 rounded text-stone-600 font-mono text-[10px]">Enter</kbd> send · <kbd className="px-1.5 py-0.5 bg-stone-200 rounded text-stone-600 font-mono text-[10px]">Shift+Enter</kbd> new line · 
            </span>
            <span className="sm:hidden">Tap send · </span>
            Paste or drop images
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
