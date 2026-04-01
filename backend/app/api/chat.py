"""Chat API endpoints for AI-powered invoice creation."""

import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal

from ..auth import get_current_user, get_current_workspace
from ..database import get_db
from ..models.client import Client, TemplateType
from ..models.chat_session import ChatSession, ChatMessage, MessageRole
from ..models.invoice import Invoice, InvoiceStatus
from ..models.uploaded_asset import UploadedAsset
from ..models.user import User
from ..models.workspace import Workspace
from ..schemas.chat import (
    ChatMessageCreate,
    ChatResponse,
    ChatResponseStatus,
    ConfirmInvoiceRequest,
    CreateClientFromChat,
    InvoicePreview,
    ChatSessionInfo,
    ChatSessionDetail,
    CreateSessionRequest,
    ChatMessage as ChatMessageSchema,
    ChatRole,
    SaveEventMessage,
)
from ..services.invoice_parser import invoice_parser
from ..services.pdf_generator import pdf_generator
from ..services.ai_service import ai_service
from ..services.s3_service import s3_service

router = APIRouter()
ASSET_REF_PREFIX = "asset:"


def get_or_create_session(
    session_id: Optional[str],
    db: Session,
    workspace: Workspace,
    client_id: Optional[str] = None
) -> ChatSession:
    """Get existing session or create a new one."""
    if session_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == session_id, ChatSession.workspace_id == workspace.id)
            .first()
        )
        if session:
            return session
    
    # Create new session
    session = ChatSession(workspace_id=workspace.id)
    if client_id:
        client = (
            db.query(Client)
            .filter(Client.id == client_id, Client.workspace_id == workspace.id)
            .first()
        )
        if client:
            session.client_id = client.id
            session.title = f"Chat with {client.name}"
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def make_asset_ref(asset_id: str) -> str:
    """Create a stable stored reference for an uploaded asset."""
    return f"{ASSET_REF_PREFIX}{asset_id}"


def parse_asset_ref(value: str | None) -> str | None:
    """Extract asset ID from a stored reference."""
    if value and value.startswith(ASSET_REF_PREFIX):
        return value[len(ASSET_REF_PREFIX):]
    return None


def resolve_image_reference(value: str, db: Session, workspace: Workspace) -> str:
    """Resolve stored image references into signed URLs when needed."""
    asset_id = parse_asset_ref(value)
    if not asset_id:
        return value

    asset = (
        db.query(UploadedAsset)
        .filter(
            UploadedAsset.id == asset_id,
            UploadedAsset.workspace_id == workspace.id,
        )
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Uploaded asset not found")
    return s3_service.generate_presigned_url(asset.storage_key)


def resolve_image_references(
    values: list[str] | None,
    db: Session,
    workspace: Workspace,
) -> list[str] | None:
    """Resolve a list of image references into signed URLs."""
    if not values:
        return None
    return [resolve_image_reference(value, db, workspace) for value in values]


def get_workspace_session_or_404(session_id: str, db: Session, workspace: Workspace) -> ChatSession:
    """Fetch a chat session for the current workspace or raise 404."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.workspace_id == workspace.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


def get_conversation_history(session: ChatSession, limit: int = 20) -> list[dict]:
    """Get conversation history for AI context.
    
    Includes:
    - Message role and content
    - Preview JSON for messages with invoice previews
    - Image URLs for messages with attached images
    """
    messages = session.messages[-limit:] if len(session.messages) > limit else session.messages
    history = []
    
    for msg in messages:
        entry = {"role": msg.role.value, "content": msg.content}
        
        # Include preview JSON if this message had a preview
        if msg.has_preview and msg.preview_json:
            entry["preview_json"] = msg.preview_json
        
        # Include image URLs if present (Feature 2 will use this)
        if msg.image_urls_json:
            entry["image_urls"] = msg.image_urls_json
        elif msg.image_url:
            entry["image_urls"] = json.dumps([msg.image_url])
        
        history.append(entry)
    
    return history


@router.get("/sessions", response_model=list[ChatSessionInfo])
async def list_sessions(
    client_id: Optional[str] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """List all chat sessions, optionally filtered by client."""
    query = (
        db.query(ChatSession)
        .filter(ChatSession.workspace_id == workspace.id)
        .order_by(ChatSession.updated_at.desc())
    )
    
    if client_id:
        query = query.filter(ChatSession.client_id == client_id)
    
    # Filter out archived sessions by default
    if not include_archived:
        query = query.filter(ChatSession.archived == False)
    
    sessions = query.limit(50).all()
    
    result = []
    for session in sessions:
        client_name = session.client.name if session.client else None
        last_message = session.messages[-1].content if session.messages else None
        if last_message and len(last_message) > 100:
            last_message = last_message[:100] + "..."
        
        result.append(ChatSessionInfo(
            id=session.id,
            client_id=session.client_id,
            client_name=client_name,
            title=session.title,
            last_message=last_message,
            message_count=len(session.messages),
            archived=session.archived,
            created_at=session.created_at,
            updated_at=session.updated_at,
        ))
    
    return result


@router.post("/sessions", response_model=ChatSessionInfo)
async def create_session(
    request: CreateSessionRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Create a new chat session."""
    title = request.title or "New Chat"
    client_id = None
    
    if request.client_id:
        client = (
            db.query(Client)
            .filter(Client.id == request.client_id, Client.workspace_id == workspace.id)
            .first()
        )
        if client:
            client_id = client.id
            title = f"Chat with {client.name}"
    
    session = ChatSession(
        workspace_id=workspace.id,
        client_id=client_id,
        title=title,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return ChatSessionInfo(
        id=session.id,
        client_id=session.client_id,
        client_name=session.client.name if session.client else None,
        title=session.title,
        last_message=None,
        message_count=0,
        archived=session.archived,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Get a chat session with all messages."""
    session = get_workspace_session_or_404(session_id, db, workspace)
    
    # Parse session-level invoice preview if stored
    session_preview = None
    if session.invoice_preview_json:
        try:
            import json as json_mod
            preview_data = json_mod.loads(session.invoice_preview_json)
            session_preview = preview_data
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Build messages, attaching preview to messages that have it
    messages = []
    for msg in session.messages:
        # Parse image_urls_json if present
        image_urls = None
        if msg.image_urls_json:
            try:
                raw_image_urls = json.loads(msg.image_urls_json)
                image_urls = resolve_image_references(raw_image_urls, db, workspace)
            except (json.JSONDecodeError, TypeError):
                pass
        elif msg.image_url:
            image_urls = [resolve_image_reference(msg.image_url, db, workspace)]
        
        # For messages with previews, use the stored preview JSON, not the session-level one
        msg_preview = None
        msg_preview_json = None
        if msg.has_preview and msg.preview_json:
            try:
                msg_preview = json.loads(msg.preview_json)
                msg_preview_json = msg.preview_json  # Raw JSON for version selection
            except (json.JSONDecodeError, TypeError):
                pass
        elif msg.has_preview:
            # Fallback to session preview for older messages without stored preview
            msg_preview = session_preview
        
        messages.append(ChatMessageSchema(
            id=msg.id,  # Include message ID for version selection
            role=ChatRole(msg.role.value),
            content=msg.content,
            timestamp=msg.created_at,
            invoice_preview=msg_preview,
            preview_json=msg_preview_json,
            image_url=msg.image_url,
            image_urls=image_urls,
        ))
    
    # Parse invoice preview if stored
    invoice_preview = None
    if session.invoice_preview_json:
        try:
            preview_data = json.loads(session.invoice_preview_json)
            invoice_preview = InvoicePreview(**preview_data)
        except (json.JSONDecodeError, ValueError):
            pass
    
    return ChatSessionDetail(
        id=session.id,
        client_id=session.client_id,
        client_name=session.client.name if session.client else None,
        title=session.title,
        messages=messages,
        has_preview=invoice_preview is not None,
        invoice_preview=invoice_preview,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Delete a chat session."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.workspace_id == workspace.id)
        .first()
    )
    if session:
        db.delete(session)
        db.commit()
    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/archive")
async def archive_session(
    session_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Archive a chat session (hides from default list)."""
    session = get_workspace_session_or_404(session_id, db, workspace)
    session.archived = True
    db.commit()
    return {"message": "Session archived", "archived": True}


@router.post("/sessions/{session_id}/restore")
async def restore_session(
    session_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Restore an archived chat session."""
    session = get_workspace_session_or_404(session_id, db, workspace)
    session.archived = False
    db.commit()
    return {"message": "Session restored", "archived": False}


@router.post("/sessions/{session_id}/event")
async def save_event_message(
    session_id: str, 
    event: SaveEventMessage, 
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    Save an event message to chat history.
    
    Used for tracking events like:
    - Invoice marked as sent
    - Invoice status changed
    - Other important actions
    
    These messages appear in conversation history and provide context for the AI.
    """
    session = get_workspace_session_or_404(session_id, db, workspace)
    
    # Save as an assistant message (system event)
    event_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.ASSISTANT,
        content=event.content,
    )
    db.add(event_msg)
    db.commit()
    
    return {
        "success": True,
        "message": "Event saved to chat history",
        "event_type": event.event_type,
    }


@router.post("/sessions/{session_id}/set-preview")
async def set_preview_version(
    session_id: str,
    message_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    Set a specific message's preview as the current preview for the session.
    
    Used when user clicks "Use this version" on an older preview card.
    """
    session = get_workspace_session_or_404(session_id, db, workspace)
    
    # Find the message with the preview
    message = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.session_id == session_id,
        ChatMessage.has_preview == True
    ).first()
    
    if not message or not message.preview_json:
        raise HTTPException(status_code=404, detail="Preview not found")
    
    # Set this preview as the current session preview
    session.invoice_preview_json = message.preview_json
    db.commit()
    
    # Return the preview data
    preview_data = json.loads(message.preview_json)
    
    return {
        "success": True,
        "message": "Preview restored",
        "invoice_preview": preview_data,
    }


class SetPreviewRequest(BaseModel):
    preview: dict


@router.post("/sessions/{session_id}/set-preview-data")
async def set_preview_data(
    session_id: str,
    request: SetPreviewRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    Set the current invoice preview for the session directly from preview data.
    
    Used when user selects a version from the dropdown.
    """
    session = get_workspace_session_or_404(session_id, db, workspace)
    
    # Set this preview as the current session preview
    session.invoice_preview_json = json.dumps(request.preview)
    db.commit()
    
    return {
        "success": True,
        "message": "Preview updated",
    }


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse, include_in_schema=False)
async def chat(
    message: ChatMessageCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    Process a chat message for invoice creation.

    Send natural language requests like:
    - "Create an invoice for Spectrio for 40 hours in January"
    - "Bill Code School $500 for January tuition"
    - "Make an invoice for the website project, $2000"
    """
    # Get or create session
    session = get_or_create_session(message.session_id, db, workspace)

    # Save user message to database
    # Handle multiple images - store as JSON
    image_urls_json = None
    if message.image_urls:
        image_urls_json = json.dumps(message.image_urls)
    
    user_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content=message.content,
        image_url=message.image_url or (message.image_urls[0] if message.image_urls else None),
        image_urls_json=image_urls_json,
    )
    db.add(user_msg)
    db.commit()

    # Check for confirmation command
    lower_content = message.content.lower().strip()
    if lower_content in ["confirm", "yes", "create", "generate", "ok"]:
        if session.invoice_preview_json:
            return await _confirm_invoice(session, db, workspace)
        else:
            # Save assistant response
            assistant_msg = ChatMessage(
                session_id=session.id,
                role=MessageRole.ASSISTANT,
                content="Nothing to confirm. Tell me about the invoice you want to create.",
            )
            db.add(assistant_msg)
            db.commit()
            
            return ChatResponse(
                status=ChatResponseStatus.MESSAGE,
                message="Nothing to confirm. Tell me about the invoice you want to create.",
                session_id=session.id,
            )

    # Get conversation history
    history = get_conversation_history(session)
    
    # Get current invoice preview if one exists (for modifications)
    current_preview = None
    if session.invoice_preview_json:
        try:
            current_preview = json.loads(session.invoice_preview_json)
        except json.JSONDecodeError:
            pass

    # Get invoices created in this session for AI context
    session_invoices = []
    session_invoice_records = db.query(Invoice).filter(Invoice.session_id == session.id).all()
    for inv in session_invoice_records:
        invoice_info = {
            "invoice_number": inv.invoice_number,
            "total_amount": float(inv.total_amount),
            "status": inv.status.value,
            "created_at": inv.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        # Try to get the version from the current preview if this is the most recent invoice
        if current_preview and current_preview.get("invoice_id") == inv.id:
            invoice_info["version_used"] = current_preview.get("version", "unknown")
        session_invoices.append(invoice_info)

    # Process the message (with optional images)
    # Use image_urls if provided, otherwise fall back to single image_url
    image_refs = message.image_urls or ([message.image_url] if message.image_url else None)
    image_urls = resolve_image_references(image_refs, db, workspace) if image_refs else None
    result = invoice_parser.process_chat_message(
        message=message.content,
        db=db,
        workspace_id=workspace.id,
        conversation_history=history[:-1],  # Exclude current message
        image_urls=image_urls,  # Pass image URLs for vision processing
        current_preview=current_preview,  # Pass current preview for modifications
        session_invoices=session_invoices,  # Pass invoices created in this session
    )

    # Handle different response types
    if result["status"] == "preview":
        preview_data = result["invoice_preview"]
        
        # Store preview in session
        session.invoice_preview_json = json.dumps(preview_data)
        
        # Update session title if we identified a client
        if preview_data.get("client_name") and session.title == "New Chat":
            session.title = f"Invoice: {preview_data['client_name']}"
        
        # If we identified a client, link the session to it
        if preview_data.get("client_id") and not session.client_id:
            session.client_id = preview_data["client_id"]
        
        # Save assistant response with preview JSON
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=result["message"],
            has_preview=True,
            preview_json=json.dumps(preview_data),  # Store full preview for history
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(
            status=ChatResponseStatus.PREVIEW,
            message=result["message"],
            session_id=session.id,
            invoice_preview=InvoicePreview(**preview_data),
        )

    elif result["status"] == "clarification_needed":
        # Save assistant response
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=result["message"],
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(
            status=ChatResponseStatus.CLARIFICATION_NEEDED,
            message=result["message"],
            session_id=session.id,
        )

    elif result["status"] == "client_not_found":
        # Save assistant response
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=result["message"],
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(
            status=ChatResponseStatus.CLIENT_NOT_FOUND,
            message=result["message"],
            session_id=session.id,
            suggested_client=result.get("suggested_client"),
        )

    else:
        # Save error response
        error_message = result.get("message", "An error occurred.")
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=error_message,
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(
            status=ChatResponseStatus.ERROR,
            message=error_message,
            session_id=session.id,
        )


async def _confirm_invoice(session: ChatSession, db: Session, workspace: Workspace) -> ChatResponse:
    """Confirm and create an invoice from preview."""
    try:
        preview = json.loads(session.invoice_preview_json)
    except (json.JSONDecodeError, TypeError):
        return ChatResponse(
            status=ChatResponseStatus.ERROR,
            message="No valid invoice preview found.",
            session_id=session.id,
        )

    # Check if invoice was already created from this preview
    if preview.get("invoice_id"):
        return ChatResponse(
            status=ChatResponseStatus.INVOICE_CREATED,
            message=f"Invoice was already created. You can download it below.",
            session_id=session.id,
            invoice_id=preview["invoice_id"],
            pdf_url=preview.get("pdf_url", f"/api/invoices/{preview['invoice_id']}/pdf"),
        )

    # Store user confirmation message
    user_confirm_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content="Generate PDF",
    )
    db.add(user_confirm_msg)

    try:
        # Create the invoice (linked to this chat session)
        invoice = invoice_parser.create_invoice_from_preview(
            preview, db, workspace_id=workspace.id, session_id=session.id
        )

        client = (
            db.query(Client)
            .filter(Client.id == invoice.client_id, Client.workspace_id == workspace.id)
            .first()
        )
        template_type = preview.get("invoice_type", "hourly")

        email_subject = f"Invoice {invoice.invoice_number} - {client.name}"
        email_body = ai_service.generate_email_body(
            client_name=client.name,
            invoice_number=invoice.invoice_number,
            period_start=preview.get("service_period_start", preview.get("date", "")),
            period_end=preview.get("service_period_end", preview.get("date", "")),
            total_hours=sum(e.get("hours", 0) for e in preview.get("hours_entries", [])) or None,
            rate=preview.get("hours_entries", [{}])[0].get("rate") if preview.get("hours_entries") else None,
            total_amount=invoice.total_amount,
            invoice_type=template_type,
            sender_name=workspace.business_profile.company_name if workspace.business_profile else None,
            company_name=workspace.business_profile.company_name if workspace.business_profile else None,
        )

        pdf_url = None
        pdf_error = None
        try:
            # Get personal_name from preview if specified
            personal_name = preview.get("personal_name")
            pdf_path = pdf_generator.generate_invoice_pdf(
                invoice=invoice,
                client=client,
                hours_entries=list(invoice.hours_entries),
                line_items=list(invoice.line_items),
                template_type=template_type,
                personal_name=personal_name,
                user=workspace.business_profile.to_company_info() if workspace.business_profile else None,
            )
            invoice.pdf_path = pdf_path
            invoice.status = InvoiceStatus.GENERATED
            pdf_url = f"/api/invoices/{invoice.id}/pdf"
        except Exception as exc:
            pdf_error = str(exc)

        # Mark preview as completed and store email for later retrieval
        preview["invoice_id"] = invoice.id
        preview["pdf_url"] = pdf_url
        preview["email_subject"] = email_subject
        preview["email_body"] = email_body
        session.invoice_preview_json = json.dumps(preview)

        success_message = (
            f"Invoice {invoice.invoice_number} created successfully! PDF is ready for download."
            if pdf_url
            else f"Invoice {invoice.invoice_number} was created, but PDF generation failed: {pdf_error}"
        )
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=success_message,
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(
            status=ChatResponseStatus.INVOICE_CREATED,
            message=success_message,
            session_id=session.id,
            invoice_id=invoice.id,
            pdf_url=pdf_url,
            email_subject=email_subject,
            email_body=email_body,
        )

    except Exception as e:
        error_message = f"Failed to create invoice: {str(e)}"
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=error_message,
        )
        db.add(assistant_msg)
        db.commit()
        
        return ChatResponse(
            status=ChatResponseStatus.ERROR,
            message=error_message,
            session_id=session.id,
        )


@router.post("/confirm", response_model=ChatResponse)
async def confirm_invoice(
    request: ConfirmInvoiceRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Confirm and create an invoice from the current preview."""
    session = get_workspace_session_or_404(request.session_id, db, workspace)

    if not session.invoice_preview_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No invoice preview to confirm",
        )

    return await _confirm_invoice(session, db, workspace)


@router.post("/create-client", response_model=ChatResponse)
async def create_client_from_chat(
    request: CreateClientFromChat,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Create a new client from chat when client not found."""
    session = get_workspace_session_or_404(request.session_id, db, workspace)

    # Create the client
    template_type = TemplateType(request.template_type) if request.template_type else TemplateType.HOURLY

    client = Client(
        workspace_id=workspace.id,
        name=request.name,
        email=request.email,
        default_rate=Decimal(str(request.default_rate)),
        template_type=template_type,
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    # Link session to new client
    session.client_id = client.id
    session.title = f"Chat with {client.name}"
    
    # Save message
    response_message = f"Client '{client.name}' created! Now tell me about the invoice you want to create."
    assistant_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.ASSISTANT,
        content=response_message,
    )
    db.add(assistant_msg)
    db.commit()

    return ChatResponse(
        status=ChatResponseStatus.MESSAGE,
        message=response_message,
        session_id=session.id,
    )


# Legacy endpoint for backwards compatibility
@router.get("/session/{session_id}")
async def get_session_history(
    session_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Get the conversation history for a session (legacy endpoint)."""
    session = get_workspace_session_or_404(session_id, db, workspace)

    return {
        "session_id": session_id,
        "history": [
            {"role": msg.role.value, "content": msg.content}
            for msg in session.messages
        ],
        "has_preview": session.invoice_preview_json is not None,
    }


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
):
    """Upload an image to S3 for use in chat messages."""
    # Validate S3 is configured
    if not s3_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload is not configured. Please set AWS S3 credentials.",
        )
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed types: {', '.join(allowed_types)}",
        )
    
    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB.",
        )
    
    try:
        storage_key = s3_service.upload_image(
            file_content=content,
            content_type=file.content_type,
            original_filename=file.filename,
            workspace_id=workspace.id,
        )
        asset = UploadedAsset(
            workspace_id=workspace.id,
            uploaded_by_user_id=user.id,
            storage_key=storage_key,
            content_type=file.content_type,
            original_filename=file.filename,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return {
            "asset_id": asset.id,
            "asset_ref": make_asset_ref(asset.id),
            "url": s3_service.generate_presigned_url(asset.storage_key),
            "filename": file.filename,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}",
        )
