"""Invoice API endpoints."""

from decimal import Decimal
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ..database import get_db
from ..models.invoice import Invoice, InvoiceStatus
from ..models.hours_entry import HoursEntry
from ..models.line_item import LineItem
from ..models.client import Client
from ..schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceSummary,
)
from ..services.pdf_generator import pdf_generator

router = APIRouter()


def calculate_invoice_total(
    hours_entries: List[HoursEntry], line_items: List[LineItem]
) -> Decimal:
    """Calculate total amount from hours entries and line items."""
    hours_total = sum(
        (entry.hours * entry.rate for entry in hours_entries), Decimal("0.00")
    )
    items_total = sum((item.amount for item in line_items), Decimal("0.00"))
    return hours_total + items_total


@router.get("", response_model=List[InvoiceSummary])
async def list_invoices(
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    status: Optional[InvoiceStatus] = Query(None, description="Filter by status"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    include_archived: bool = Query(False, description="Include archived invoices"),
    db: Session = Depends(get_db),
):
    """List all invoices with optional filters."""
    query = db.query(Invoice)

    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if status:
        query = query.filter(Invoice.status == status)
    if start_date:
        query = query.filter(Invoice.date >= start_date)
    if end_date:
        query = query.filter(Invoice.date <= end_date)
    
    # Filter out archived invoices by default
    if not include_archived:
        query = query.filter(Invoice.archived == False)

    invoices = query.order_by(Invoice.date.desc()).all()
    return invoices


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(invoice: InvoiceCreate, db: Session = Depends(get_db)):
    """Create a new invoice with hours entries or line items."""
    # Verify client exists
    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID '{invoice.client_id}' not found",
        )

    # Check if invoice number already exists
    existing = db.query(Invoice).filter(
        Invoice.invoice_number == invoice.invoice_number
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice number '{invoice.invoice_number}' already exists",
        )

    # Create invoice
    invoice_data = invoice.model_dump(exclude={"hours_entries", "line_items"})
    db_invoice = Invoice(**invoice_data)
    db.add(db_invoice)
    db.flush()  # Get the ID

    # Create hours entries
    for entry_data in invoice.hours_entries:
        db_entry = HoursEntry(
            invoice_id=db_invoice.id,
            **entry_data.model_dump(),
        )
        db.add(db_entry)

    # Create line items
    for item_data in invoice.line_items:
        item_dict = item_data.model_dump()
        item_dict["amount"] = item_dict["quantity"] * item_dict["rate"]
        db_item = LineItem(
            invoice_id=db_invoice.id,
            **item_dict,
        )
        db.add(db_item)

    db.flush()

    # Refresh to get relationships
    db.refresh(db_invoice)

    # Calculate and set total
    db_invoice.total_amount = calculate_invoice_total(
        db_invoice.hours_entries, db_invoice.line_items
    )

    db.commit()
    db.refresh(db_invoice)
    return db_invoice


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    """Get a single invoice by ID with all details."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID '{invoice_id}' not found",
        )
    return invoice


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: str, 
    inline: bool = Query(False, description="If true, display inline instead of download"),
    db: Session = Depends(get_db)
):
    """Generate and download/display invoice as PDF.
    
    Args:
        inline: If true, sets Content-Disposition to inline for preview.
                If false (default), sets to attachment for download.
    """
    # Get invoice with relationships
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID '{invoice_id}' not found",
        )

    # Get client
    client = db.query(Client).filter(Client.id == invoice.client_id).first()

    # Determine template type from client
    template_type = client.template_type.value if client else "hourly"

    # Helper function to return PDF with correct disposition
    def return_pdf(path: str):
        if inline:
            # For inline preview, don't set filename (browser displays it)
            return FileResponse(
                path,
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename=\"{invoice.invoice_number}.pdf\""}
            )
        else:
            # For download, set attachment disposition
            return FileResponse(
                path,
                media_type="application/pdf",
                filename=f"{invoice.invoice_number}.pdf",
            )

    # Check if PDF already exists
    if invoice.pdf_path and Path(invoice.pdf_path).exists():
        return return_pdf(invoice.pdf_path)

    # Generate PDF based on template type
    try:
        pdf_path = pdf_generator.generate_invoice_pdf(
            invoice=invoice,
            client=client,
            hours_entries=list(invoice.hours_entries),
            line_items=list(invoice.line_items),
            template_type=template_type,
        )

        # Update invoice with PDF path
        invoice.pdf_path = pdf_path
        invoice.status = InvoiceStatus.GENERATED
        db.commit()

        return return_pdf(pdf_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF: {str(e)}",
        )


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: str, invoice_update: InvoiceUpdate, db: Session = Depends(get_db)
):
    """Update an existing invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID '{invoice_id}' not found",
        )

    update_data = invoice_update.model_dump(exclude_unset=True)

    # Check if invoice number is being changed to an existing one
    if "invoice_number" in update_data and update_data["invoice_number"] != invoice.invoice_number:
        existing = db.query(Invoice).filter(
            Invoice.invoice_number == update_data["invoice_number"]
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invoice number '{update_data['invoice_number']}' already exists",
            )

    for field, value in update_data.items():
        setattr(invoice, field, value)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    """Delete an invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID '{invoice_id}' not found",
        )

    db.delete(invoice)
    db.commit()
    return None


@router.post("/{invoice_id}/archive")
async def archive_invoice(invoice_id: str, db: Session = Depends(get_db)):
    """Archive an invoice (hides from default list)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID '{invoice_id}' not found",
        )
    invoice.archived = True
    db.commit()
    return {"message": "Invoice archived", "archived": True}


@router.post("/{invoice_id}/restore")
async def restore_invoice(invoice_id: str, db: Session = Depends(get_db)):
    """Restore an archived invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with ID '{invoice_id}' not found",
        )
    invoice.archived = False
    db.commit()
    return {"message": "Invoice restored", "archived": False}
