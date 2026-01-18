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

### Chat Input Alignment Fix (January 19, 2026)
- Fixed horizontal alignment: all sections use consistent `px-4 sm:px-6` padding
- Fixed vertical alignment: upload button, textarea, and send button all aligned at bottom with fixed 48px height
- Removed wrapper div that was causing textarea to stretch incorrectly

### Mobile Success Banner Redesign (January 19, 2026)
- Compact header with X dismiss button instead of text button
- 4-column icon-only grid for action buttons on mobile
- Full labels shown on desktop with `sm:inline`
- More compact mark-as-sent prompt

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

### Richer Conversation History ✅ IMPLEMENTED
**Priority:** Medium  
**Status:** ✅ Complete (Jan 18, 2026)

**What was implemented:**
- ✅ Historical preview JSON stored with messages (`preview_json` column)
- ✅ AI sees preview summaries in conversation history (`[PREVIEW: Client - $Amount, Invoice #X]`)
- ✅ Session invoices included in AI context (numbers, amounts, status)
- ✅ Old image references noted in history (`[X image(s) attached]`)
- ✅ Event messages persisted to DB (marked as sent, etc.)

---

### Preview Version Selection ✅ IMPLEMENTED
**Priority:** Low → Implemented  
**Status:** ✅ Complete (Jan 18, 2026)

**What was implemented:**
- ✅ Each preview card in chat history has "Use this version" button
- ✅ Clicking it sets that preview as the current session preview
- ✅ Backend endpoint: `POST /api/chat/sessions/{id}/set-preview?message_id=X`
- ✅ Frontend updates currentPreview state and adds confirmation message

---

## UI Polish & Refinements

### Global Issues

#### Invoice Number Placeholder Wrong Year
**Priority:** High  
**Status:** Pending  
**Location:** Manual Invoice Form  
**Issue:** Shows "INV-2025-01" instead of "2026"

#### Mixed Invoice Number Formats in History
**Priority:** Medium  
**Status:** Known limitation  
**Location:** Invoice History  
**Issue:** Old format (INV-2026-01-XX) vs new (SPECTRIO-2026-XXX) creates visual inconsistency. Historical invoices retain original format.

#### Button Style Consistency
**Priority:** Medium  
**Status:** Partially addressed  
**Description:** Button hierarchy established:
- **Primary**: Filled teal (Generate PDF, Create Invoice, Add Client)
- **Secondary**: Filled blue/stone (Preview, View)
- **Tertiary**: Text only or X icon (Dismiss)
- **Danger**: Outlined red (Delete)

#### ~~Success Banner Competes with Content~~ ✅ COMPLETED
**Status:** Implemented January 19, 2026  
**Description:** Success banner redesigned for mobile:
- Compact header with X dismiss button
- 4-column icon-only grid for action buttons on mobile
- Full labels shown on desktop
- More compact mark-as-sent prompt

---

### Desktop Specific

#### Chat Interface Polish
- [x] Success banner takes too much vertical space - made more compact ✅
- [x] "Preview email" dropdown arrow is small - added chevron icon ✅
- [ ] v4 badge is subtle - could be slightly larger/more prominent
- [x] Long button row - now uses icons on mobile, full text on desktop ✅
- [ ] Copy button at bottom right of messages feels orphaned

#### Manual Form Polish
- [ ] Form feels sparse - add subtle section dividers or groupings
- [ ] Hours entry row: Date picker very wide - balance Date/Hours/Rate more evenly
- [ ] No visual feedback for invalid/empty required fields
- [ ] "Create Invoice" button could be more prominent

#### Clients Page Polish
- [ ] Cards lack visual hierarchy - make client name larger/bolder
- [ ] "No email" / "No notes" could be lighter for more distinction
- [ ] Delete button red text feels harsh - use outline style
- [ ] Button row at bottom feels cramped - add more vertical padding

#### Invoice History Table Polish
- [ ] Actions column has 4 text links - icons would be cleaner (like mobile)
- [ ] "Duplicate" in purple is inconsistent - should match other actions
- [ ] Table rows lack hover state - add subtle background on hover
- [ ] Filter section feels basic - polish date pickers

---

### Mobile Specific

#### Chat History Sidebar
- [ ] Close X button is small - increase tap target (min 44x44px)
- [ ] Session list items need more padding for touch targets
- [ ] No visual separator between sessions - add subtle dividers
- [ ] Truncated text ("Invoice SPECTRIO-2026-004 creat...") - consider 2-line layout

#### Chat Empty State
- [ ] Example prompt cards feel flat - add subtle shadow/border
- [ ] Hamburger icon could be larger for better tap target
- [ ] Input area bottom hint text is very small
- [ ] Send button disabled state not distinct enough

#### Mobile Clients Page
- [ ] Type badges wrap awkwardly on narrow screens - place below name?
- [ ] Button row feels tight - consider stacking vertically
- [ ] Cards lack visual depth - add subtle shadow/border
- [ ] Email text could overflow - ensure truncation

#### Mobile Invoice History
- [ ] "Filters" dropdown needs chevron icon
- [ ] Status dropdown tap target should be 44px minimum
- [ ] Invoice number link could be bolder/more tappable-looking
- [ ] Action icons at bottom feel cramped - more spacing

---

### Design System Standardization

#### Typography Scale
```
Page titles: text-2xl font-bold
Card titles: text-lg font-semibold  
Labels: text-sm text-stone-500
Body: text-sm or text-base
```

#### Card Styling
```
Border radius: rounded-lg (consistent)
Shadow: shadow-sm or shadow (consistent)
Padding: p-4 or p-6 (consistent)
```

#### Color Refinement
- Keep teal primary (teal-600)
- Soften red for delete (red-500 → red-400 or outline)
- Remove purple from "Duplicate" - use teal or neutral

---

## Technical Debt

### Consolidate Invoice Preview Logic
**Description:** The invoice preview rendering logic exists in both ChatInterface and the invoice detail page. Consider extracting to a shared component.

---

*Last updated: January 19, 2026*
