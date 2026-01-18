"""AI service for OpenRouter API integration."""

import json
from datetime import date
from typing import Optional
from openai import OpenAI

from ..config import settings


class AIService:
    """Service for interacting with OpenRouter API."""

    def __init__(self):
        """Initialize the AI service with OpenRouter client."""
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
        self.model = settings.openrouter_model

    def chat(
        self,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """
        Send a chat completion request to OpenRouter.

        Args:
            messages: List of message dicts with 'role' and 'content'
            system_prompt: Optional system prompt to prepend
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens in response

        Returns:
            The assistant's response text
        """
        full_messages = []

        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})

        full_messages.extend(messages)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return response.choices[0].message.content

    def extract_invoice_data(
        self,
        user_message: str,
        client_context: Optional[str] = None,
        conversation_history: Optional[list[dict]] = None,
        image_urls: Optional[list[str]] = None,
    ) -> dict:
        """
        Extract invoice data from natural language input.

        Args:
            user_message: The user's natural language request
            client_context: Optional context about known clients
            conversation_history: Optional previous messages in conversation
            image_urls: Optional URLs of attached images for context

        Returns:
            Extracted invoice data or clarification request
        """
        system_prompt = self._build_extraction_prompt(client_context)

        messages = []
        if conversation_history:
            messages.extend(conversation_history)
        
        # Build the user message content (with optional images)
        if image_urls and len(image_urls) > 0:
            # Multi-modal message with images
            user_content = []
            # Add all images first
            for img_url in image_urls:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": img_url}
                })
            # Add text last
            user_content.append({
                "type": "text",
                "text": user_message
            })
            messages.append({"role": "user", "content": user_content})
        else:
            messages.append({"role": "user", "content": user_message})

        response = self.chat(
            messages=messages,
            system_prompt=system_prompt,
            temperature=0.3,  # Lower temperature for structured extraction
        )

        return self._parse_extraction_response(response)

    def _build_extraction_prompt(self, client_context: Optional[str] = None) -> str:
        """Build the system prompt for invoice extraction."""
        today = date.today()
        today_str = today.strftime("%Y-%m-%d")
        current_year = today.year
        current_month = today.strftime("%B %Y")
        
        base_prompt = f"""You are an invoice extraction assistant. Your job is to extract invoice information from natural language requests and return structured JSON data.

IMPORTANT: Today's date is {today_str}. The current year is {current_year}. Always use {current_year} for dates unless explicitly told otherwise.

IMAGE CONTEXT: The user may attach screenshots or images containing invoice details, timesheets, work logs, or other context. If an image is provided, carefully analyze it to extract relevant information like hours worked, dates, line items, amounts, or any other invoice-related data. Combine the image information with the user's text message.

CRITICAL - DATA PRIORITY:
1. ALWAYS prioritize data from images over client defaults (rates, amounts, hours)
2. If you see "Total Hours" and "Net Pay" or "Total" in an image, CALCULATE the rate: rate = total / hours
3. If the image shows a specific rate, use that rate instead of the client's default rate
4. Only fall back to client default rates if no rate information is available anywhere
5. For HOURLY invoices: Include ALL days in the date range from the image/timesheet, INCLUDING days with 0 hours. This shows the complete pay period.

INVOICE TYPES:
1. "hourly" - For contract work billed by hours (e.g., consulting, development)
2. "tuition" - For education/training invoices with fixed amounts
3. "project" - For project-based work with line items

REQUIRED OUTPUT FORMAT:
Always respond with valid JSON in one of these formats:

1. If you have enough information to create an invoice:
{{
    "status": "ready",
    "invoice_data": {{
        "client_name": "Client Name",
        "invoice_type": "hourly|tuition|project",
        "invoice_number": "INV-XXXX",
        "date": "YYYY-MM-DD",
        "service_period_start": "YYYY-MM-DD",
        "service_period_end": "YYYY-MM-DD",
        "hours_entries": [
            {{"date": "YYYY-MM-DD", "hours": 8.0, "rate": 100.00}}
        ],
        "line_items": [
            {{"description": "Item description", "quantity": 1, "rate": 100.00}}
        ],
        "notes": "Optional notes"
    }}
}}

2. If you need clarification:
{{
    "status": "clarification_needed",
    "question": "Your clarifying question here",
    "context": "What you understood so far"
}}

RULES:
- For hourly invoices, ALWAYS ask for the specific dates and hours for each day worked
- For project/tuition invoices, always include line_items
- Generate invoice numbers in format: CLIENT-YYYY-MM (e.g., SPECTRIO-{current_year}-01)
- Today's date is {today_str} - use this as the invoice date unless specified otherwise
- Calculate service periods from the dates mentioned
- If client rate is known from context, use it; otherwise ask
- For hourly invoices, you MUST know the breakdown of hours by date - ask for this information
- Be helpful and conversational in clarification questions

YOUR CAPABILITIES - What you CAN modify:
✅ Invoice DATA: dates, hours, rates, amounts, line items, quantities
✅ Invoice NOTES: any text in the notes section
✅ Invoice NUMBER: the invoice number/ID
✅ CLIENT INFO: which client to bill (from known clients)
✅ SERVICE PERIOD: start and end dates

YOUR LIMITATIONS - What you CANNOT modify:
❌ TEMPLATE LAYOUT: You cannot change where elements appear (header position, section order)
❌ FONTS/COLORS: You cannot change typography or visual styling
❌ COMPANY BRANDING: You cannot change the company name/logo position
❌ ADD NEW SECTIONS: You cannot add custom sections to the invoice
❌ PERSONAL NAME PLACEMENT: The template controls where "Leon Shimizu" or company name appears

IMPORTANT - BE HONEST ABOUT LIMITATIONS:
If the user asks you to do something you CANNOT do (like "move my name to the top left" or "change the font"), you MUST:
1. Acknowledge what they asked for
2. Explain that you cannot modify the invoice template/layout
3. Explain what you CAN change (data, notes, amounts, dates, line items)
4. Offer to help with what you CAN do

Example response for layout requests:
"I can't modify the invoice template layout - the position of elements like your name, company info, and sections are fixed in the template. However, I can update the invoice data such as dates, hours, rates, line items, and notes. Would you like me to change any of those instead?"

DO NOT pretend you made a change if you didn't. If the user asks for something impossible, be transparent about it."""

        if client_context:
            base_prompt += f"\n\nKNOWN CLIENTS AND THEIR DEFAULTS:\n{client_context}"

        return base_prompt

    def _parse_extraction_response(self, response: str) -> dict:
        """Parse the AI response into structured data."""
        # Try to extract JSON from the response
        try:
            # First try direct JSON parse
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to find JSON in the response
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # If all else fails, return as clarification
        return {
            "status": "clarification_needed",
            "question": response,
            "context": "Could not parse structured response",
        }

    def extract_hours_from_image(
        self,
        image_base64: str,
        start_date: str,
        end_date: str,
        image_type: str = "image/png",
    ) -> dict:
        """
        Extract hours data from a screenshot using vision.

        Args:
            image_base64: Base64 encoded image data
            start_date: Start date of the period (YYYY-MM-DD)
            end_date: End date of the period (YYYY-MM-DD)
            image_type: MIME type of the image

        Returns:
            Extracted hours data with dates
        """
        today = date.today()
        
        system_prompt = f"""You are a data extraction assistant. Extract work hours from the image.

Today's date is {today.strftime("%Y-%m-%d")}. The billing period is {start_date} to {end_date}.

Extract ALL dates and hours you can see in the image. Return ONLY valid JSON in this format:
{{
    "success": true,
    "hours_entries": [
        {{"date": "YYYY-MM-DD", "hours": 5.0}},
        {{"date": "YYYY-MM-DD", "hours": 7.0}}
    ],
    "total_hours": 35.0,
    "notes": "Any relevant notes about the extraction"
}}

If you cannot extract the data, return:
{{
    "success": false,
    "error": "Description of the problem"
}}

RULES:
- Include ALL dates in the billing period, even if hours are 0
- Use the year from the billing period dates
- Only include dates within the specified period
- Be precise with decimal hours (5.5, 7.0, etc.)"""

        # Use vision model - Claude 3.5 Sonnet supports vision
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image_type};base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": f"Extract the work hours from this image for the period {start_date} to {end_date}. Return only JSON."
                    }
                ]
            }
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *messages
                ],
                temperature=0.1,
                max_tokens=2000,
            )
            
            result = response.choices[0].message.content
            return self._parse_extraction_response(result)
        except Exception as e:
            return {
                "success": False,
                "error": f"Vision extraction failed: {str(e)}"
            }

    def parse_hours_text(self, text: str, start_date: str, end_date: str) -> dict:
        """
        Parse hours from pasted text (e.g., "5, 5, 0, 0, 7, 5, 7").

        Args:
            text: Raw text with hours (comma or space separated)
            start_date: Start date of the period (YYYY-MM-DD)
            end_date: End date of the period (YYYY-MM-DD)

        Returns:
            Parsed hours data with dates
        """
        from datetime import datetime, timedelta
        
        try:
            # Parse the text to extract numbers
            # Handle formats like "5, 5, 0, 0, 7" or "5 5 0 0 7" or "Mon: 5, Tue: 5"
            import re
            numbers = re.findall(r'[\d.]+', text)
            hours_list = [float(n) for n in numbers]
            
            # Generate dates for the period
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            
            entries = []
            current_date = start
            idx = 0
            
            while current_date <= end and idx < len(hours_list):
                entries.append({
                    "date": current_date.strftime("%Y-%m-%d"),
                    "hours": hours_list[idx]
                })
                current_date += timedelta(days=1)
                idx += 1
            
            total_hours = sum(e["hours"] for e in entries)
            
            return {
                "success": True,
                "hours_entries": entries,
                "total_hours": total_hours,
                "notes": f"Parsed {len(entries)} days from text input"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to parse hours: {str(e)}"
            }

    def generate_email_body(
        self,
        client_name: str,
        invoice_number: str,
        period_start: str,
        period_end: str,
        total_hours: Optional[float],
        rate: Optional[float],
        total_amount: float,
        invoice_type: str = "hourly",
        payment_number: Optional[str] = None,
        custom_greeting: Optional[str] = None,
    ) -> str:
        """
        Generate a professional email body for the invoice.

        Args:
            client_name: Name of the client
            invoice_number: Invoice number
            period_start: Start of billing period
            period_end: End of billing period
            total_hours: Total hours (for hourly invoices)
            rate: Hourly rate (for hourly invoices)
            total_amount: Total invoice amount
            invoice_type: Type of invoice (hourly, project, etc.)
            payment_number: Payment installment (e.g., "4/6")
            custom_greeting: Custom greeting override

        Returns:
            Formatted email body
        """
        # Format the period
        from datetime import datetime
        try:
            start = datetime.strptime(period_start, "%Y-%m-%d")
            end = datetime.strptime(period_end, "%Y-%m-%d")
            period_str = f"{start.strftime('%b %d, %Y')} – {end.strftime('%b %d, %Y')}"
        except:
            period_str = f"{period_start} – {period_end}"

        # Format hours/rate info if available (for hourly invoices)
        hours_info = ""
        if total_hours and rate:
            hours_info = f"{total_hours} hours at ${rate:.2f}/hr"
        
        # Safe rate formatting
        rate_str = f"${rate:.2f}" if rate else ""

        # Client-specific templates (plain text for easy Gmail pasting)
        templates = {
            "spectrio": f"""Hi Accounts Payable Team,

Attached is my invoice {invoice_number} for the period {period_str}.
{f"It reflects {hours_info} for a total net of ${total_amount:,.2f}." if hours_info else f"Total: ${total_amount:,.2f}"}

Thank you and please let me know if you need any additional details or adjustments.

Leon Shimizu""",

            "actualize": f"""Hi Sandra,

Here's my work hours for the period {period_str}.
{f"Total: {hours_info} = ${total_amount:,.2f}." if hours_info else f"Total: ${total_amount:,.2f}"}

Thank you!
Leon Shimizu""",

            "code school": f"""Hi Sandra,

Attached is my invoice {invoice_number} for the period {period_str}.
Total: ${total_amount:,.2f}

Thank you!
Leon Shimizu""",

            "hafaloha": f"""Hi Hafaloha Team,

Hope you're well! Following up on Invoice {invoice_number} for the Hafaloha Online Ordering + POS + Wholesale project.

Invoice summary:
• Project installment ({payment_number or 'N/A'}) — ${max(total_amount - 150, 0):,.2f}
• Monthly subscription (hosting & 24/7 support) — $150
Total outstanding: ${total_amount:,.2f}

Checks (or cash) can be made payable to Shimizu Technology LLC.

If payment has already been sent, thank you—and please disregard this note.

Appreciate you all—thanks as always for the partnership.

Best,
— Leon Shimizu
Founder | Shimizu Technology LLC""",

            "guam": f"""Hi Team,

Attached is Invoice {invoice_number} for the period {period_str}.

Total Due: ${total_amount:,.2f}

Please let me know if you have any questions.

Best regards,
Leon Shimizu
Shimizu Technology LLC""",

            "default": f"""Hi {client_name} Team,

Please find attached Invoice {invoice_number} for the period {period_str}.

Total Due: ${total_amount:,.2f}

Please remit payment by check or ACH to Shimizu Technology. If you require a W-9 or purchase-order reference, please let me know.

Thank you for the opportunity to work together!

Best regards,
Leon Shimizu
Founder | Shimizu Technology LLC"""
        }

        # Select template based on client name
        client_key = client_name.lower().replace(" ", "")
        if "spectrio" in client_key:
            return templates["spectrio"]
        elif "actualize" in client_key:
            return templates["actualize"]
        elif "codeschool" in client_key:
            return templates["code school"]
        elif "hafaloha" in client_key:
            return templates["hafaloha"]
        elif "guam" in client_key:
            return templates["guam"]
        else:
            return templates["default"]


# Singleton instance
ai_service = AIService()
