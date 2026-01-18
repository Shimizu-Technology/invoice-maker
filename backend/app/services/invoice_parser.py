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
        current_preview: Optional[dict] = None,
        session_invoices: Optional[list[dict]] = None,
    ) -> dict:
        """
        Process a chat message and extract/create invoice.

        Args:
            message: User's natural language message
            db: Database session
            conversation_history: Previous messages in conversation
            image_urls: Optional URLs of attached images for context
            current_preview: Optional current invoice preview to modify
            session_invoices: Optional list of invoices created in this session

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
            current_preview=current_preview,
            session_invoices=session_invoices,
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

    def _normalize_client_name(self, name: str) -> str:
        """Normalize client name by removing common suffixes and extra whitespace."""
        import re
        # Remove common business suffixes
        suffixes = [
            r'\s+LLC\.?$', r'\s+Inc\.?$', r'\s+Corp\.?$', r'\s+Corporation$',
            r'\s+Ltd\.?$', r'\s+Limited$', r'\s+Co\.?$', r'\s+Company$',
            r'\s+LP$', r'\s+LLP$', r'\s+PC$', r'\s+PLLC$',
        ]
        normalized = name.strip()
        for suffix in suffixes:
            normalized = re.sub(suffix, '', normalized, flags=re.IGNORECASE)
        return normalized.strip()

    def _find_or_suggest_client(
        self, client_name: str, db: Session
    ) -> Optional[Client]:
        """Find a client by name (case-insensitive, normalized match)."""
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
        if client:
            return client

        # Normalized match - strip LLC, Inc, etc. and compare
        normalized_input = self._normalize_client_name(client_name)
        all_clients = db.query(Client).all()
        for c in all_clients:
            normalized_db = self._normalize_client_name(c.name)
            # Check if normalized names match (case-insensitive)
            if normalized_input.lower() == normalized_db.lower():
                return c
            # Also check if one contains the other
            if normalized_input.lower() in normalized_db.lower() or normalized_db.lower() in normalized_input.lower():
                return c

        return None

    def _generate_invoice_number(self, client: Client, invoice_date: date, db: Session) -> str:
        """
        Generate a unique invoice number in format: PREFIX-YEAR-SEQ
        
        Examples:
            - SPECTRIO-2026-001
            - GUAM-2026-001
            - INV-2026-015
        
        If client.next_invoice_number is set, uses that instead of auto-calculating.
        """
        prefix = client.invoice_prefix or "INV"
        year = invoice_date.year
        
        # If client has a manual override for next invoice number, use it
        if client.next_invoice_number is not None:
            next_seq = client.next_invoice_number
            return f"{prefix}-{year}-{next_seq:03d}"
        
        # Find the highest sequence number for this client in this year
        # Look for pattern like PREFIX-YEAR-XXX
        pattern = f"{prefix}-{year}-%"
        
        existing_invoices = db.query(Invoice).filter(
            Invoice.client_id == client.id,
            Invoice.invoice_number.like(pattern)
        ).all()
        
        max_seq = 0
        for inv in existing_invoices:
            # Extract the sequence number from the invoice number
            try:
                parts = inv.invoice_number.split("-")
                if len(parts) >= 3:
                    seq_part = parts[-1]
                    # Handle cases like "001" or "001a" (version suffix)
                    seq_num = int(''.join(filter(str.isdigit, seq_part[:3])))
                    max_seq = max(max_seq, seq_num)
            except (ValueError, IndexError):
                continue
        
        next_seq = max_seq + 1
        return f"{prefix}-{year}-{next_seq:03d}"
    
    def _get_unique_invoice_number(self, base_number: str, db: Session) -> str:
        """Ensure invoice number is unique by adding version suffix if needed."""
        if db is None:
            return base_number

        # Check if base number exists
        existing = db.query(Invoice).filter(
            Invoice.invoice_number == base_number
        ).first()
        if not existing:
            return base_number

        # Find the next available version letter (a, b, c, ...)
        version = ord('a')
        while version <= ord('z'):
            candidate = f"{base_number}{chr(version)}"
            existing = db.query(Invoice).filter(
                Invoice.invoice_number == candidate
            ).first()
            if not existing:
                return candidate
            version += 1
        
        # Fallback to timestamp if we somehow run out of letters
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
            # Generate using client prefix: PREFIX-YEAR-SEQ format
            invoice_number = self._generate_invoice_number(client, invoice_date, db)

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
        self, preview: dict, db: Session, session_id: Optional[str] = None
    ) -> Invoice:
        """Create an actual invoice from a preview."""
        # Ensure invoice number is unique at creation time
        # (in case another invoice was created since preview was generated)
        base_number = preview["invoice_number"]
        unique_number = self._get_unique_invoice_number(base_number, db)

        # Create invoice
        invoice = Invoice(
            client_id=preview["client_id"],
            session_id=session_id,  # Link to chat session for context
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

        # If client had a manual next_invoice_number, increment it for next time
        client = db.query(Client).filter(Client.id == preview["client_id"]).first()
        if client and client.next_invoice_number is not None:
            client.next_invoice_number += 1

        db.commit()
        db.refresh(invoice)
        return invoice


# Singleton instance
invoice_parser = InvoiceParser()
