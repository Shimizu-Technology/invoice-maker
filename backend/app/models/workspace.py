"""Workspace model for tenant-scoped data ownership."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Workspace(Base):
    """A tenant container that owns clients, invoices, chats, and settings."""

    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bootstrap: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="workspace")
    business_profile: Mapped["BusinessProfile | None"] = relationship(
        "BusinessProfile",
        back_populates="workspace",
        uselist=False,
        cascade="all, delete-orphan",
    )
    clients: Mapped[list["Client"]] = relationship("Client", back_populates="workspace")
    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="workspace")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="workspace"
    )
    uploaded_assets: Mapped[list["UploadedAsset"]] = relationship(
        "UploadedAsset", back_populates="workspace", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workspace(id={self.id}, slug={self.slug})>"
