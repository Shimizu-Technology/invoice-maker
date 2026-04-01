"""Business profile used for workspace invoice branding."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class BusinessProfile(Base):
    """Per-workspace business profile used in invoice headers and emails."""

    __tablename__ = "business_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), unique=True, nullable=False
    )
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_phone: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="business_profile")

    def to_company_info(self) -> dict:
        """Return company info in the shape expected by PDF generation."""
        return {
            "name": self.company_name or "",
            "email": self.company_email or "",
            "address": self.company_address or "",
            "phone": self.company_phone or "",
        }

    def __repr__(self) -> str:
        return f"<BusinessProfile(id={self.id}, company_name={self.company_name})>"
