"""Chat session models for persistent conversations."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
import enum


class MessageRole(str, enum.Enum):
    """Message sender role."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatSession(Base):
    """Chat session linked to a client for persistent conversations."""

    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    
    # Store pending invoice preview as JSON string
    invoice_preview_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Archive flag - archived sessions are hidden from default list
    archived: Mapped[bool] = mapped_column(default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="session"
    )

    def __repr__(self) -> str:
        return f"<ChatSession(id={self.id}, client_id={self.client_id}, title={self.title})>"


class ChatMessage(Base):
    """Individual message in a chat session."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        SQLEnum(MessageRole), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Optional: image URL for messages with attached images (single/legacy)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Optional: multiple image URLs stored as JSON string
    image_urls_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Optional: store invoice preview with this message
    has_preview: Mapped[bool] = mapped_column(default=False)
    
    # Store the actual preview JSON data (when has_preview is True)
    preview_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")

    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, role={self.role}, content={self.content[:50]}...)>"
