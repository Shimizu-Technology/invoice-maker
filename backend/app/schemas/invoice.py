"""Invoice Pydantic schemas for request/response validation."""

from datetime import datetime
from datetime import date as date_type
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from enum import Enum


class InvoiceStatus(str, Enum):
    """Invoice status options."""
    DRAFT = "draft"
    GENERATED = "generated"
    SENT = "sent"
    PAID = "paid"


class HoursEntryBase(BaseModel):
    """Base hours entry schema."""
    date: date_type
    hours: Decimal = Field(..., ge=0)  # Allow 0 hours for days with no work
    rate: Decimal = Field(..., ge=0)


class HoursEntryCreate(HoursEntryBase):
    """Schema for creating hours entry."""
    pass


class HoursEntryResponse(HoursEntryBase):
    """Schema for hours entry response."""
    id: str
    invoice_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @property
    def amount(self) -> Decimal:
        """Calculate amount for this entry."""
        return self.hours * self.rate


class LineItemBase(BaseModel):
    """Base line item schema."""
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    rate: Decimal = Field(..., ge=0)


class LineItemCreate(LineItemBase):
    """Schema for creating line item."""
    pass


class LineItemResponse(LineItemBase):
    """Schema for line item response."""
    id: str
    invoice_id: str
    amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    """Base invoice schema with common fields."""
    client_id: str
    invoice_number: str = Field(..., min_length=1, max_length=50)
    date: date_type = Field(default_factory=date_type.today)
    service_period_start: Optional[date_type] = None
    service_period_end: Optional[date_type] = None
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    """Schema for creating a new invoice."""
    hours_entries: list[HoursEntryCreate] = Field(default_factory=list)
    line_items: list[LineItemCreate] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    """Schema for updating an existing invoice."""
    invoice_number: Optional[str] = Field(None, min_length=1, max_length=50)
    date: Optional[date_type] = None
    service_period_start: Optional[date_type] = None
    service_period_end: Optional[date_type] = None
    status: Optional[InvoiceStatus] = None
    notes: Optional[str] = None


class InvoiceResponse(InvoiceBase):
    """Schema for invoice response."""
    id: str
    total_amount: Decimal
    status: InvoiceStatus
    pdf_path: Optional[str]
    created_at: datetime
    updated_at: datetime
    hours_entries: list[HoursEntryResponse] = Field(default_factory=list)
    line_items: list[LineItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class InvoiceSummary(BaseModel):
    """Schema for invoice list summary (without nested items)."""
    id: str
    client_id: str
    invoice_number: str
    date: date_type
    total_amount: Decimal
    status: InvoiceStatus
    archived: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
