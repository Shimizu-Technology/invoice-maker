"""Invoice model for storing invoice data."""

import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, Text, DateTime, Date, Numeric, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
import enum


class InvoiceStatus(str, enum.Enum):
    """Invoice status options."""
    DRAFT = "draft"
    GENERATED = "generated"
    SENT = "sent"
    PAID = "paid"


class Invoice(Base):
    """Invoice model storing invoice details and line items."""

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("workspace_id", "invoice_number", name="uq_invoices_workspace_number"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), nullable=False
    )
    client_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clients.id"), nullable=False
    )
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("chat_sessions.id"), nullable=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    service_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        SQLEnum(InvoiceStatus), default=InvoiceStatus.DRAFT
    )
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Archive flag - archived invoices are hidden from default list
    archived: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="invoices")
    client: Mapped["Client"] = relationship("Client", back_populates="invoices")
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="invoices")
    hours_entries: Mapped[list["HoursEntry"]] = relationship(
        "HoursEntry", back_populates="invoice", cascade="all, delete-orphan"
    )
    line_items: Mapped[list["LineItem"]] = relationship(
        "LineItem", back_populates="invoice", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Invoice(id={self.id}, number={self.invoice_number})>"
