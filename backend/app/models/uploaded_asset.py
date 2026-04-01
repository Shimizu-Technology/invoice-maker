"""Metadata for uploaded private assets."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class UploadedAsset(Base):
    """Tracks uploaded images/files for workspace-scoped access."""

    __tablename__ = "uploaded_assets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), nullable=False
    )
    uploaded_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="uploaded_assets")
    uploaded_by: Mapped["User | None"] = relationship("User", back_populates="uploaded_assets")

    def __repr__(self) -> str:
        return f"<UploadedAsset(id={self.id}, storage_key={self.storage_key})>"
