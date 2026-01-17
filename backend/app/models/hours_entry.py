"""HoursEntry model for tracking daily work hours on invoices."""

import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class HoursEntry(Base):
    """Hours entry for hourly/contract invoices."""

    __tablename__ = "hours_entries"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="hours_entries")

    @property
    def amount(self) -> Decimal:
        """Calculate amount for this entry."""
        return self.hours * self.rate

    def __repr__(self) -> str:
        return f"<HoursEntry(id={self.id}, date={self.date}, hours={self.hours})>"
