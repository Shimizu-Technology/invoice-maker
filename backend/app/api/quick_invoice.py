"""Quick Invoice API endpoints for streamlined invoice creation."""

from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.client import Client
from ..models.invoice import Invoice
from ..models.hours_entry import HoursEntry
from ..schemas.chat import (
    ExtractHoursFromImageRequest,
    ParseHoursTextRequest,
    HoursExtractionResponse,
    GenerateEmailRequest,
    GenerateEmailResponse,
    QuickInvoiceRequest,
    QuickInvoiceResponse,
    HoursEntry as HoursEntrySchema,
)
from ..services.ai_service import ai_service
from ..services.pdf_generator import pdf_generator

router = APIRouter()


@router.post("/extract-hours-image", response_model=HoursExtractionResponse)
async def extract_hours_from_image(
    request: ExtractHoursFromImageRequest,
    db: Session = Depends(get_db),
):
    """
    Extract work hours from an uploaded image using AI vision.
    
    Upload a screenshot of your timesheet, Google Sheet, etc.
    and the AI will extract the dates and hours.
    """
    result = ai_service.extract_hours_from_image(
        image_base64=request.image_base64,
        start_date=request.start_date,
        end_date=request.end_date,
        image_type=request.image_type,
    )
    
    if result.get("success"):
        return HoursExtractionResponse(
            success=True,
            hours_entries=[
                HoursEntrySchema(date=e["date"], hours=e["hours"])
                for e in result.get("hours_entries", [])
            ],
            total_hours=result.get("total_hours", 0.0),
            notes=result.get("notes"),
        )
    else:
        return HoursExtractionResponse(
            success=False,
            error=result.get("error", "Unknown error"),
        )


@router.post("/parse-hours-text", response_model=HoursExtractionResponse)
async def parse_hours_from_text(
    request: ParseHoursTextRequest,
    db: Session = Depends(get_db),
):
    """
    Parse work hours from pasted text.
    
    Supports formats like:
    - "5, 5, 0, 0, 7, 5, 7" (comma separated)
    - "5 5 0 0 7 5 7" (space separated)
    - "Mon: 5, Tue: 5, Wed: 0" (labeled)
    """
    result = ai_service.parse_hours_text(
        text=request.text,
        start_date=request.start_date,
        end_date=request.end_date,
    )
    
    if result.get("success"):
        return HoursExtractionResponse(
            success=True,
            hours_entries=[
                HoursEntrySchema(date=e["date"], hours=e["hours"])
                for e in result.get("hours_entries", [])
            ],
            total_hours=result.get("total_hours", 0.0),
            notes=result.get("notes"),
        )
    else:
        return HoursExtractionResponse(
            success=False,
            error=result.get("error", "Unknown error"),
        )


@router.post("/generate-email", response_model=GenerateEmailResponse)
async def generate_email_body(
    request: GenerateEmailRequest,
    db: Session = Depends(get_db),
):
    """
    Generate a professional email body for an invoice.
    
    Uses client-specific templates for known clients.
    """
    body = ai_service.generate_email_body(
        client_name=request.client_name,
        invoice_number=request.invoice_number,
        period_start=request.period_start,
        period_end=request.period_end,
        total_hours=request.total_hours,
        rate=request.rate,
        total_amount=request.total_amount,
        invoice_type=request.invoice_type,
        payment_number=request.payment_number,
    )
    
    # Generate subject line
    subject = f"Invoice {request.invoice_number} - {request.client_name}"
    
    return GenerateEmailResponse(
        subject=subject,
        body=body,
    )


def generate_invoice_number(client: Client, invoice_date: datetime) -> str:
    """Generate an invoice number for a client."""
    month_str = invoice_date.strftime("%Y-%m")
    prefix = client.name.upper().replace(" ", "")[:10]
    return f"{prefix}-{month_str}"


@router.post("/create", response_model=QuickInvoiceResponse)
async def create_quick_invoice(
    request: QuickInvoiceRequest,
    db: Session = Depends(get_db),
):
    """
    Create an invoice quickly with pre-extracted hours.
    
    This is the streamlined endpoint for creating invoices
    after hours have been extracted from an image or parsed from text.
    """
    # Get the client
    client = db.query(Client).filter(Client.id == request.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Use provided rate or client default
    rate = Decimal(str(request.rate)) if request.rate else client.default_rate
    
    # Calculate totals
    total_hours = sum(e.hours for e in request.hours_entries)
    total_amount = rate * Decimal(str(total_hours))
    
    # Parse dates
    try:
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d").date()
        invoice_date = datetime.now().date()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {str(e)}",
        )
    
    # Generate invoice number
    invoice_number = generate_invoice_number(client, datetime.now())
    
    # Create the invoice
    invoice = Invoice(
        client_id=client.id,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        service_period_start=start_date,
        service_period_end=end_date,
        total_amount=total_amount,
        status="draft",
        notes=request.notes,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    # Create hours entries
    hours_entries_db = []
    for entry in request.hours_entries:
        entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
        hours_entry = HoursEntry(
            invoice_id=invoice.id,
            date=entry_date,
            hours=Decimal(str(entry.hours)),
            rate=rate,
        )
        db.add(hours_entry)
        hours_entries_db.append(hours_entry)
    
    db.commit()
    
    # Generate PDF
    try:
        pdf_path = pdf_generator.generate_invoice_pdf(
            invoice=invoice,
            client=client,
            hours_entries=hours_entries_db,
            line_items=[],
            template_type="contract_hourly",
        )
        invoice.pdf_path = pdf_path
        db.commit()
    except Exception as e:
        # PDF generation failed but invoice was created
        pass
    
    # Generate email if requested
    email_subject = None
    email_body = None
    if request.generate_email:
        email_body = ai_service.generate_email_body(
            client_name=client.name,
            invoice_number=invoice_number,
            period_start=request.start_date,
            period_end=request.end_date,
            total_hours=float(total_hours),
            rate=float(rate),
            total_amount=float(total_amount),
            invoice_type="hourly",
        )
        email_subject = f"Invoice {invoice_number} - {client.name}"
    
    return QuickInvoiceResponse(
        invoice_id=invoice.id,
        invoice_number=invoice_number,
        total_hours=float(total_hours),
        total_amount=float(total_amount),
        pdf_url=f"/api/invoices/{invoice.id}/pdf",
        email_subject=email_subject,
        email_body=email_body,
    )
