"""PDF generation service using WeasyPrint and Jinja2."""

import os
from pathlib import Path
from decimal import Decimal
from datetime import date
from typing import Optional, Any
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS

from ..config import settings

# Template directory
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "generated_pdfs"


class PDFGenerator:
    """Generate PDF invoices from templates."""

    def __init__(self):
        """Initialize the PDF generator with Jinja2 environment."""
        self.env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=True,
        )
        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    def generate_hourly_invoice(
        self,
        invoice: Any,
        client: Any,
        hours_entries: list,
        user: Optional[dict] = None,
        personal_name: Optional[str] = None,
    ) -> str:
        """
        Generate an hourly/contract invoice PDF.

        Args:
            invoice: Invoice model or dict with invoice data
            client: Client model or dict with client data
            hours_entries: List of hours entries
            user: Optional dict with user/company info (overrides config)
            personal_name: Optional personal name to display above company name

        Returns:
            Path to the generated PDF file
        """
        template = self.env.get_template("contract_hourly.html")

        # Calculate totals
        total_hours = sum(Decimal(str(e.hours if hasattr(e, 'hours') else e['hours'])) for e in hours_entries)
        hourly_rate = Decimal(str(hours_entries[0].rate if hasattr(hours_entries[0], 'rate') else hours_entries[0]['rate'])) if hours_entries else Decimal("0")

        # Use provided user info or fall back to config
        if user is None:
            user = settings.get_company_info()

        html_content = template.render(
            invoice=invoice,
            client=client,
            hours_entries=hours_entries,
            total_hours=total_hours,
            hourly_rate=hourly_rate,
            user=user,
            personal_name=personal_name,
        )

        return self._generate_pdf(html_content, invoice)

    def generate_tuition_invoice(
        self,
        invoice: Any,
        client: Any,
        line_items: list = None,
        due_date: Optional[date] = None,
        payment_link: Optional[str] = None,
        user: Optional[dict] = None,
    ) -> str:
        """
        Generate a tuition invoice PDF.

        Args:
            invoice: Invoice model or dict with invoice data
            client: Client model or dict with client data
            line_items: Optional list of line items
            due_date: Optional due date
            payment_link: Optional payment link URL
            user: Optional dict with user/company info (overrides config)

        Returns:
            Path to the generated PDF file
        """
        template = self.env.get_template("tuition.html")

        # Use provided user info or fall back to config
        if user is None:
            user = settings.get_company_info()

        html_content = template.render(
            invoice=invoice,
            client=client,
            line_items=line_items or [],
            due_date=due_date,
            payment_link=payment_link,
            user=user,
        )

        return self._generate_pdf(html_content, invoice)

    def generate_project_invoice(
        self,
        invoice: Any,
        client: Any,
        line_items: list,
        installment_info: Optional[str] = None,
        user: Optional[dict] = None,
    ) -> str:
        """
        Generate a project/itemized invoice PDF.

        Args:
            invoice: Invoice model or dict with invoice data
            client: Client model or dict with client data
            line_items: List of line items
            installment_info: Optional installment info (e.g., "Payment 4/6")
            user: Optional dict with user/company info (overrides config)

        Returns:
            Path to the generated PDF file
        """
        template = self.env.get_template("project.html")

        # Calculate subtotal
        subtotal = sum(
            Decimal(str(item.amount if hasattr(item, 'amount') else item['amount']))
            for item in line_items
        )

        # Use provided user info or fall back to config
        if user is None:
            user = settings.get_company_info()

        html_content = template.render(
            invoice=invoice,
            client=client,
            line_items=line_items,
            subtotal=subtotal,
            installment_info=installment_info,
            discount=None,
            tax=None,
            user=user,
        )

        return self._generate_pdf(html_content, invoice)

    def generate_spectrio_invoice(
        self,
        invoice: Any,
        client: Any,
        hours_entries: list,
        user: Optional[dict] = None,
        personal_name: str = "Leon Shimizu",
    ) -> str:
        """
        Generate a Spectrio-specific invoice PDF.

        Args:
            invoice: Invoice model or dict with invoice data
            client: Client model or dict with client data
            hours_entries: List of hours entries
            user: Optional dict with user/company info (overrides config)
            personal_name: Name to display at top of invoice

        Returns:
            Path to the generated PDF file
        """
        template = self.env.get_template("spectrio.html")

        # Calculate totals
        total_hours = sum(Decimal(str(e.hours if hasattr(e, 'hours') else e['hours'])) for e in hours_entries)
        hourly_rate = Decimal(str(hours_entries[0].rate if hasattr(hours_entries[0], 'rate') else hours_entries[0]['rate'])) if hours_entries else Decimal("0")

        # Use provided user info or fall back to config
        if user is None:
            user = settings.get_company_info()

        html_content = template.render(
            invoice=invoice,
            client=client,
            hours_entries=hours_entries,
            total_hours=total_hours,
            hourly_rate=hourly_rate,
            user=user,
            personal_name=personal_name,
        )

        return self._generate_pdf(html_content, invoice)

    def generate_invoice_pdf(
        self,
        invoice: Any,
        client: Any,
        hours_entries: list = None,
        line_items: list = None,
        template_type: str = "hourly",
        **kwargs,
    ) -> str:
        """
        Generate an invoice PDF based on template type.

        Args:
            invoice: Invoice model or dict
            client: Client model or dict
            hours_entries: List of hours entries (for hourly template)
            line_items: List of line items (for project/tuition template)
            template_type: One of "hourly", "tuition", "project", "spectrio"
            **kwargs: Additional template-specific arguments

        Returns:
            Path to the generated PDF file
        """
        # Auto-detect Spectrio clients to add personal name
        client_name = client.name if hasattr(client, 'name') else client.get('name', '')
        personal_name = kwargs.get("personal_name")
        if 'spectrio' in client_name.lower() and template_type == "hourly":
            # Use Leon Shimizu as personal name for Spectrio invoices
            personal_name = personal_name or "Leon Shimizu"

        if template_type == "spectrio":
            # Legacy support - redirect to hourly with personal name
            return self.generate_hourly_invoice(
                invoice=invoice,
                client=client,
                hours_entries=hours_entries or [],
                user=kwargs.get("user"),
                personal_name=personal_name or "Leon Shimizu",
            )
        elif template_type == "hourly":
            return self.generate_hourly_invoice(
                invoice=invoice,
                client=client,
                hours_entries=hours_entries or [],
                user=kwargs.get("user"),
                personal_name=personal_name,
            )
        elif template_type == "tuition":
            return self.generate_tuition_invoice(
                invoice=invoice,
                client=client,
                line_items=line_items or [],
                due_date=kwargs.get("due_date"),
                payment_link=kwargs.get("payment_link"),
                user=kwargs.get("user"),
            )
        elif template_type == "project":
            return self.generate_project_invoice(
                invoice=invoice,
                client=client,
                line_items=line_items or [],
                installment_info=kwargs.get("installment_info"),
                user=kwargs.get("user"),
            )
        else:
            raise ValueError(f"Unknown template type: {template_type}")

    def _generate_pdf(self, html_content: str, invoice: Any) -> str:
        """
        Generate PDF from HTML content.

        Args:
            html_content: Rendered HTML string
            invoice: Invoice object (for filename)

        Returns:
            Path to the generated PDF file
        """
        # Get invoice number for filename
        invoice_number = invoice.invoice_number if hasattr(invoice, 'invoice_number') else invoice['invoice_number']
        safe_filename = invoice_number.replace("/", "-").replace("\\", "-")
        output_path = OUTPUT_DIR / f"{safe_filename}.pdf"

        # Generate PDF
        html = HTML(string=html_content, base_url=str(TEMPLATE_DIR))
        html.write_pdf(str(output_path))

        return str(output_path)


# Singleton instance
pdf_generator = PDFGenerator()
