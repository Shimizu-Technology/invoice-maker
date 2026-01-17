"""Pydantic schemas for request/response validation."""

from .client import ClientCreate, ClientUpdate, ClientResponse
from .invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    HoursEntryCreate,
    LineItemCreate,
)
from .chat import (
    ChatMessageCreate,
    ChatResponse,
    ChatResponseStatus,
    ConfirmInvoiceRequest,
    CreateClientFromChat,
    InvoicePreview,
)

__all__ = [
    "ClientCreate",
    "ClientUpdate",
    "ClientResponse",
    "InvoiceCreate",
    "InvoiceUpdate",
    "InvoiceResponse",
    "HoursEntryCreate",
    "LineItemCreate",
    "ChatMessageCreate",
    "ChatResponse",
    "ChatResponseStatus",
    "ConfirmInvoiceRequest",
    "CreateClientFromChat",
    "InvoicePreview",
]
