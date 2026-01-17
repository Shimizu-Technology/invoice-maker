"""Invoice parser service for processing AI-extracted data."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session

from ..models.client import Client, TemplateType
from ..models.invoice import Invoice, InvoiceStatus
from ..models.hours_entry import HoursEntry
from ..models.line_item import LineItem
from .ai_service import ai_service


class InvoiceParser:
    """Parse and create invoices from AI-extracted data."""

    def process_chat_message(
        self,
        message: str,
        db: Session,
        conversation_history: Optional[list[dict]] = None,
        image_urls: Optional[list[str]] = None,
    ) -> dict:
        """
        Process a chat message and extract/create invoice.

        Args:
            message: User's natural language message
            db: Database session
            conversation_history: Previous messages in conversation
            image_urls: Optional URLs of attached images for context

        Returns:
            Response dict with status and data
        """
        # Build client context
        client_context = self._build_client_context(db)

        # Extract invoice data using AI
        extraction = ai_service.extract_invoice_data(
            user_message=message,
            client_context=client_context,
            conversation_history=conversation_history,
            image_urls=image_urls,
        )

        if extraction.get("status") == "clarification_needed":
            return {
                "status": "clarification_needed",
                "message": extraction.get("question", "Could you provide more details?"),
                "context": extraction.get("context"),
            }

        if extraction.get("status") == "ready":
            invoice_data = extraction.get("invoice_data", {})
            return self._process_invoice_data(invoice_data, db)

        return {
            "status": "error",
            "message": "Could not process your request. Please try again.",
        }

    def _build_client_context(self, db: Session) -> str:
        """Build context string with client information."""
        clients = db.query(Client).all()
        if not clients:
            return "No clients registered yet."

        context_parts = []
        for client in clients:
            parts = [
                f"- {client.name}:",
                f"  rate=${client.default_rate}/hr",
                f"  type={client.template_type.value}",
                f"  invoice_prefix={client.invoice_prefix}",
            ]
            if client.email:
                parts.append(f"  email={client.email}")
            if client.company_context:
                parts.append(f"  notes: {client.company_context}")
            context_parts.append("\n".join(parts))

        return "\n".join(context_parts)

    def _process_invoice_data(self, invoice_data: dict, db: Session) -> dict:
        """Process extracted invoice data and create/preview invoice."""
        # Find or create client
        client_name = invoice_data.get("client_name", "").strip()
        client = self._find_or_suggest_client(client_name, db)

        if client is None:
            return {
                "status": "client_not_found",
                "message": f"Client '{client_name}' not found. Would you like to create a new client?",
                "suggested_client": {
                    "name": client_name,
                    "template_type": invoice_data.get("invoice_type", "hourly"),
                },
            }

        # Build invoice preview
        invoice_preview = self._build_invoice_preview(invoice_data, client, db)

        return {
            "status": "preview",
            "message": "Here's your invoice preview. Say 'confirm' to generate the PDF.",
            "invoice_preview": invoice_preview,
            "client": {
                "id": client.id,
                "name": client.name,
            },
        }

    def _find_or_suggest_client(
        self, client_name: str, db: Session
    ) -> Optional[Client]:
        """Find a client by name (case-insensitive partial match)."""
        if not client_name:
            return None

        # Exact match first
        client = db.query(Client).filter(
            Client.name.ilike(client_name)
        ).first()
        if client:
            return client

        # Partial match
        client = db.query(Client).filter(
            Client.name.ilike(f"%{client_name}%")
        ).first()
        return client

    def _get_unique_invoice_number(self, base_number: str, db: Session) -> str:
        """Generate a unique invoice number by appending a sequence if needed."""
        if db is None:
            return base_number

        # Check if base number exists
        existing = db.query(Invoice).filter(
            Invoice.invoice_number == base_number
        ).first()
        if not existing:
            return base_number

        # Find the next available sequence number
        seq = 1
        while True:
            candidate = f"{base_number}-{seq:02d}"
            existing = db.query(Invoice).filter(
                Invoice.invoice_number == candidate
            ).first()
            if not existing:
                return candidate
            seq += 1
            if seq > 99:
                # Fallback to timestamp
                import time
                return f"{base_number}-{int(time.time())}"

    def _build_invoice_preview(self, invoice_data: dict, client: Client, db: Session = None) -> dict:
        """Build an invoice preview from extracted data."""
        invoice_type = invoice_data.get("invoice_type", client.template_type.value)

        # Parse dates
        invoice_date = self._parse_date(invoice_data.get("date")) or date.today()
        period_start = self._parse_date(invoice_data.get("service_period_start"))
        period_end = self._parse_date(invoice_data.get("service_period_end"))

        # Generate invoice number if not provided
        invoice_number = invoice_data.get("invoice_number")
        if not invoice_number:
            # Use client's invoice prefix if set, otherwise derive from name
            prefix = client.invoice_prefix if client.invoice_prefix != "INV" else client.name.upper().replace(" ", "-")[:10]
            base_number = f"{prefix}-{invoice_date.strftime('%Y-%m')}"
            invoice_number = self._get_unique_invoice_number(base_number, db)

        # Process entries based on type
        hours_entries = []
        line_items = []
        total_amount = Decimal("0.00")

        if invoice_type == "hourly":
            for entry in invoice_data.get("hours_entries", []):
                entry_date = self._parse_date(entry.get("date")) or invoice_date
                hours = Decimal(str(entry.get("hours", 0)))
                rate = Decimal(str(entry.get("rate", client.default_rate)))
                amount = hours * rate
                total_amount += amount
                hours_entries.append({
                    "date": entry_date.isoformat(),
                    "hours": float(hours),
                    "rate": float(rate),
                    "amount": float(amount),
                })
        else:
            for item in invoice_data.get("line_items", []):
                quantity = Decimal(str(item.get("quantity", 1)))
                rate = Decimal(str(item.get("rate", 0)))
                amount = quantity * rate
                total_amount += amount
                line_items.append({
                    "description": item.get("description", ""),
                    "quantity": float(quantity),
                    "rate": float(rate),
                    "amount": float(amount),
                })

        return {
            "client_id": client.id,
            "client_name": client.name,
            "invoice_number": invoice_number,
            "invoice_type": invoice_type,
            "date": invoice_date.isoformat(),
            "service_period_start": period_start.isoformat() if period_start else None,
            "service_period_end": period_end.isoformat() if period_end else None,
            "hours_entries": hours_entries,
            "line_items": line_items,
            "total_amount": float(total_amount),
            "notes": invoice_data.get("notes"),
        }

    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        """Parse a date string into a date object."""
        if not date_str:
            return None

        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            pass

        try:
            return datetime.strptime(date_str, "%m/%d/%Y").date()
        except ValueError:
            pass

        return None

    def create_invoice_from_preview(
        self, preview: dict, db: Session
    ) -> Invoice:
        """Create an actual invoice from a preview."""
        # Ensure invoice number is unique at creation time
        # (in case another invoice was created since preview was generated)
        base_number = preview["invoice_number"]
        unique_number = self._get_unique_invoice_number(base_number, db)

        # Create invoice
        invoice = Invoice(
            client_id=preview["client_id"],
            invoice_number=unique_number,
            date=self._parse_date(preview["date"]) or date.today(),
            service_period_start=self._parse_date(preview.get("service_period_start")),
            service_period_end=self._parse_date(preview.get("service_period_end")),
            total_amount=Decimal(str(preview["total_amount"])),
            status=InvoiceStatus.DRAFT,
            notes=preview.get("notes"),
        )
        db.add(invoice)
        db.flush()

        # Create hours entries
        for entry in preview.get("hours_entries", []):
            db_entry = HoursEntry(
                invoice_id=invoice.id,
                date=self._parse_date(entry["date"]) or date.today(),
                hours=Decimal(str(entry["hours"])),
                rate=Decimal(str(entry["rate"])),
            )
            db.add(db_entry)

        # Create line items
        for item in preview.get("line_items", []):
            db_item = LineItem(
                invoice_id=invoice.id,
                description=item["description"],
                quantity=Decimal(str(item["quantity"])),
                rate=Decimal(str(item["rate"])),
                amount=Decimal(str(item["amount"])),
            )
            db.add(db_item)

        db.commit()
        db.refresh(invoice)
        return invoice


# Singleton instance
invoice_parser = InvoiceParser()
