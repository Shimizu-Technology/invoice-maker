"""Client model for storing client information and preferences."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Text, DateTime, Numeric, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
import enum


class TemplateType(str, enum.Enum):
    """Invoice template types."""
    HOURLY = "hourly"
    TUITION = "tuition"
    PROJECT = "project"


class Client(Base):
    """Client model storing billing information and preferences."""

    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0.00")
    )
    timezone: Mapped[str] = mapped_column(String(50), default="ChST")
    template_type: Mapped[TemplateType] = mapped_column(
        SQLEnum(TemplateType), default=TemplateType.HOURLY
    )
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV")
    company_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Manual control over next invoice number (if None, auto-calculated)
    next_invoice_number: Mapped[int | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="client", cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="client"
    )

    def __repr__(self) -> str:
        return f"<Client(id={self.id}, name={self.name})>"
