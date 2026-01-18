"""Chat Pydantic schemas for request/response validation."""

from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class ChatRole(str, Enum):
    """Chat message roles."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessageCreate(BaseModel):
    """Schema for sending a chat message."""
    content: str = Field(..., min_length=1, max_length=5000)
    session_id: Optional[str] = Field(
        None,
        description="Session ID to continue a conversation"
    )
    image_url: Optional[str] = Field(
        None,
        description="URL of an uploaded image to include with the message (legacy/first image)"
    )
    image_urls: Optional[list[str]] = Field(
        None,
        description="URLs of multiple uploaded images to include with the message"
    )


class ChatMessage(BaseModel):
    """Schema for a chat message."""
    id: Optional[str] = None  # Message ID for version selection
    role: ChatRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    invoice_preview: Optional[Any] = None  # Include invoice preview stored with message
    preview_json: Optional[str] = None  # Raw preview JSON for version selection
    image_url: Optional[str] = None  # URL of attached image (legacy/first image)
    image_urls: Optional[list[str]] = None  # URLs of multiple attached images


class InvoicePreview(BaseModel):
    """Schema for invoice preview in chat response."""
    client_id: str
    client_name: str
    invoice_number: str
    invoice_type: str
    date: str
    service_period_start: Optional[str] = None
    service_period_end: Optional[str] = None
    hours_entries: list[dict] = Field(default_factory=list)
    line_items: list[dict] = Field(default_factory=list)
    total_amount: float
    notes: Optional[str] = None
    # Set when invoice is created from this preview
    invoice_id: Optional[str] = None
    pdf_url: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None


class ChatResponseStatus(str, Enum):
    """Chat response status types."""
    MESSAGE = "message"
    PREVIEW = "preview"
    CLARIFICATION_NEEDED = "clarification_needed"
    CLIENT_NOT_FOUND = "client_not_found"
    INVOICE_CREATED = "invoice_created"
    ERROR = "error"


class ChatResponse(BaseModel):
    """Schema for chat response."""
    status: ChatResponseStatus
    message: str
    session_id: str
    invoice_preview: Optional[InvoicePreview] = None
    invoice_id: Optional[str] = None
    pdf_url: Optional[str] = None
    suggested_client: Optional[dict] = None
    # Email fields for invoice creation
    email_subject: Optional[str] = None
    email_body: Optional[str] = None


class ConfirmInvoiceRequest(BaseModel):
    """Schema for confirming an invoice from preview."""
    session_id: str = Field(..., description="Session ID with the invoice preview")
    generate_pdf: bool = Field(
        default=True,
        description="Whether to generate PDF after creating invoice"
    )


class CreateClientFromChat(BaseModel):
    """Schema for creating a client from chat."""
    session_id: str
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = None
    default_rate: float = Field(default=0.0, ge=0)
    template_type: str = Field(default="hourly")


class ChatSessionInfo(BaseModel):
    """Schema for chat session summary."""
    id: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    title: str
    last_message: Optional[str] = None
    message_count: int = 0
    archived: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatSessionDetail(BaseModel):
    """Schema for full chat session with messages."""
    id: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    title: str
    messages: list[ChatMessage] = Field(default_factory=list)
    has_preview: bool = False
    invoice_preview: Optional[InvoicePreview] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CreateSessionRequest(BaseModel):
    """Schema for creating a new chat session."""
    client_id: Optional[str] = Field(
        None, 
        description="Client ID to associate with this session"
    )
    title: Optional[str] = Field(
        None,
        description="Optional title for the session"
    )


class SaveEventMessage(BaseModel):
    """Schema for saving an event message to chat history."""
    content: str = Field(..., min_length=1, max_length=1000)
    event_type: Optional[str] = Field(
        None,
        description="Type of event: 'invoice_sent', 'status_changed', etc."
    )


# Quick Invoice schemas
class HoursEntry(BaseModel):
    """Schema for a single hours entry."""
    date: str
    hours: float


class ExtractHoursFromImageRequest(BaseModel):
    """Schema for extracting hours from an image."""
    image_base64: str = Field(..., description="Base64 encoded image data")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    image_type: str = Field(default="image/png", description="MIME type")


class ParseHoursTextRequest(BaseModel):
    """Schema for parsing hours from text."""
    text: str = Field(..., description="Text with hours (e.g., '5, 5, 0, 0, 7')")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")


class HoursExtractionResponse(BaseModel):
    """Schema for hours extraction response."""
    success: bool
    hours_entries: list[HoursEntry] = Field(default_factory=list)
    total_hours: float = 0.0
    notes: Optional[str] = None
    error: Optional[str] = None


class GenerateEmailRequest(BaseModel):
    """Schema for generating email body."""
    client_name: str
    invoice_number: str
    period_start: str
    period_end: str
    total_hours: Optional[float] = None
    rate: Optional[float] = None
    total_amount: float
    invoice_type: str = "hourly"
    payment_number: Optional[str] = None


class GenerateEmailResponse(BaseModel):
    """Schema for generated email body."""
    subject: str
    body: str


class QuickInvoiceRequest(BaseModel):
    """Schema for creating a quick invoice."""
    client_id: str
    start_date: str
    end_date: str
    hours_entries: list[HoursEntry]
    rate: Optional[float] = None  # Uses client default if not provided
    notes: Optional[str] = None
    generate_email: bool = True


class QuickInvoiceResponse(BaseModel):
    """Schema for quick invoice response."""
    invoice_id: str
    invoice_number: str
    total_hours: float
    total_amount: float
    pdf_url: str
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
