"""Client Pydantic schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from enum import Enum


class TemplateType(str, Enum):
    """Invoice template types."""
    HOURLY = "hourly"
    TUITION = "tuition"
    PROJECT = "project"


class ClientBase(BaseModel):
    """Base client schema with common fields."""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    default_rate: Decimal = Field(default=Decimal("0.00"), ge=0)
    timezone: str = Field(default="ChST", max_length=50)
    template_type: TemplateType = Field(default=TemplateType.HOURLY)
    payment_terms: Optional[str] = None
    invoice_prefix: str = Field(default="INV", max_length=20)
    company_context: Optional[str] = None
    next_invoice_number: Optional[int] = Field(None, ge=1, description="Override next invoice sequence number")


class ClientCreate(ClientBase):
    """Schema for creating a new client."""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating an existing client."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    default_rate: Optional[Decimal] = Field(None, ge=0)
    timezone: Optional[str] = Field(None, max_length=50)
    template_type: Optional[TemplateType] = None
    payment_terms: Optional[str] = None
    invoice_prefix: Optional[str] = Field(None, max_length=20)
    company_context: Optional[str] = None
    next_invoice_number: Optional[int] = Field(None, ge=1, description="Override next invoice sequence number")


class ClientResponse(ClientBase):
    """Schema for client response."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
