# Future Improvements

A running list of planned enhancements and nice-to-have features.

---

## UI/UX Enhancements

### Quick View Modal for Invoices
**Priority:** Medium  
**Description:** Add a "Quick View" option that opens a modal preview of the invoice instead of navigating to a separate page. This keeps the user in context (especially useful in the Chat interface).

**Proposed behavior:**
- Success banner shows three options:
  - "Download PDF" → Direct download
  - "Quick View" → Opens modal with invoice summary + download button
  - "View Details" → Navigates to full invoice page
- Modal should show: client, invoice number, date, line items, total, and a prominent download button

---

## Feature Ideas

### Copy from Last Invoice
**Priority:** Medium  
**Description:** For recurring clients, add a "Copy from last invoice" option that pre-fills the new invoice with the previous invoice's line items, just updating dates and amounts as needed.

---

### ~~Email Body Generation in Chat~~ ✅ COMPLETED
**Status:** Implemented January 17, 2026  
**Description:** After generating an invoice, the Chat interface now generates a client-specific email and shows "Copy Email" button with preview dropdown.

---

### Custom Invoice Templates Per Client
**Priority:** Low (Future)  
**Description:** Allow more customization of invoice formatting per client. Options to explore:
- **Template Builder:** Store custom templates per client (logo, colors, layout, field order)
- **More Template Varieties:** Add templates like "minimal", "detailed", "timesheet-style" that can be assigned per client
- **AI-Generated Templates:** Have AI generate HTML/CSS based on an uploaded example invoice

**Current state:** 3 templates (hourly, tuition, project) work well for most use cases. Revisit if specific formatting needs arise.

---

### ~~Invoice Status Workflow~~ ✅ COMPLETED
**Status:** Implemented January 17, 2026  
**Description:** Invoice statuses (draft, generated, sent, paid) can now be changed from the History page by clicking the status badge. "Mark as Sent" button also appears in Chat after copying email.

---

### Google Sheets Integration (Actualize)
**Priority:** Low  
**Description:** For clients like Actualize where hours are tracked in Google Sheets, explore direct integration to pull hours automatically. For now, screenshot/paste approach works.

---

## Recently Completed ✅

### Image Upload in Chat (January 17, 2026)
- Paste screenshots directly with Cmd+V / Ctrl+V
- Drag & drop images into chat
- Upload button for file selection
- Support for multiple images (up to 5 per message)
- Images stored permanently in S3
- AI analyzes images for invoice context (timesheets, work logs, etc.)

### Copy Chat Messages (January 17, 2026)
- Hover over any message to reveal copy button
- Works for both user and AI messages

---

## Technical Debt

### Consolidate Invoice Preview Logic
**Description:** The invoice preview rendering logic exists in both ChatInterface and the invoice detail page. Consider extracting to a shared component.

---

*Last updated: January 17, 2026*
