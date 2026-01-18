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

### Dynamic Template Customization
**Priority:** Medium  
**Description:** Allow more flexible invoice customization beyond static templates. Two approaches to explore:

#### Option B: Configurable Template Fields
Store customization settings per client in the database:
- `header_style`: "personal_name_first" | "company_first" | "logo"
- `show_personal_name`: boolean
- `personal_name`: string (e.g., "Leon Shimizu")
- `show_timezone`: boolean
- `custom_footer`: string
- `hours_table_style`: "detailed" | "summary_only"

The AI could then modify these settings based on user requests like "put my name at the top."

#### Option C: AI-Generated Custom Templates
Allow AI to generate/modify HTML templates based on:
- User-uploaded example invoices (screenshots)
- Natural language descriptions ("I want a minimalist invoice with my name prominently displayed")
- Store generated templates per client for reuse

**Risks:** Generated HTML could break PDF rendering. Would need validation/sandboxing.

#### Current State
4 templates exist (hourly, tuition, project, spectrio). The Spectrio template was created to match specific client requirements. Option B is recommended as the next step when more customization is needed.

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

## High Priority - Coming Soon

### ~~Invoice Version Tracking in Chat (Preview Iterations)~~ ✅ COMPLETED
**Status:** Implemented January 18, 2026  
**Description:** Preview versions are now tracked during invoice creation:
- Each preview in a chat session gets a version number (v1, v2, v3...)
- Version badges displayed on preview cards in chat
- "Invoice preview ready" bar shows version if > v1
- Version counter resets when switching sessions

---

### Invoice Revision Tracking (Post-Creation)
**Priority:** Medium  
**Description:** After an invoice is created, track revisions as linked versions:
- When user asks for changes after generating, create a new invoice linked to the original
- Invoice numbers: `SPECTRIO-2026-001`, then `SPECTRIO-2026-001a`, `001b`, etc.
- Add `parent_invoice_id` field to Invoice model
- Show version history on invoice detail page
- Allow viewing/downloading any version

**Implementation approach:**
- Add `parent_invoice_id` column to invoices table (nullable)
- When creating a revision, link to the original invoice
- Update invoice detail page to show version history
- Add "View previous version" / "View next version" navigation

---

### ~~Invoice Naming Convention Fix~~ ✅ COMPLETED
**Status:** Implemented January 18, 2026  
**Description:** Invoice numbers now use format `PREFIX-YEAR-SEQ`:
- `SPECTRIO-2026-001`, `SPECTRIO-2026-002`, etc.
- Each client has a configurable `invoice_prefix`
- Sequential numbers auto-increment per client per year
- If a duplicate is created, adds letter suffix (a, b, c)

---

## AI Context Enhancements

### Richer Conversation History
**Priority:** Medium  
**Description:** Currently the AI only receives text content from conversation history. Enhance to include:

**What's Missing:**
- **Historical preview data**: Include structured JSON from previous previews in the chat, not just the text
- **Previously created invoices**: Tell AI which invoices were already generated in this session (numbers, totals, etc.)
- **Old image references**: Allow AI to reference images from earlier in the conversation

**Current State:**
- ✅ Current preview is now included in context (implemented Jan 18, 2026)
- ✅ Last 20 messages (text only) are included
- ✅ All client data is included
- ❌ Historical preview JSON not included
- ❌ Created invoice metadata not included
- ❌ Old images not accessible

**Implementation approach:**
- Store preview JSON with each message that has `has_preview: true`
- When invoice is created, add metadata to session (invoice_number, total, pdf_url)
- Pass this metadata to AI in system prompt

---

### Preview Version Selection
**Priority:** Low  
**Description:** Allow users to select and generate a previous preview version instead of only the latest.

**Use case:** User creates v1, modifies to v2, but decides v1 was better. Currently they must ask AI to "change it back." With this feature, they could click on v1 card and select "Use this version."

**Current workaround:** Ask AI to reverse changes (e.g., "change the rate back to $50/hr") - this works well because AI now has context.

**Proposed behavior:**
- Each preview card in chat history gets a "Use this version" button
- Clicking it sets that preview as the current one
- "Generate PDF" button then uses that version

**Note:** Low priority because the AI workaround is effective. Consider implementing if users frequently need to restore older versions.

---

## Technical Debt

### Consolidate Invoice Preview Logic
**Description:** The invoice preview rendering logic exists in both ChatInterface and the invoice detail page. Consider extracting to a shared component.

---

*Last updated: January 18, 2026*
