# Multi-User SaaS Migration Plan

## Purpose
This document defines how to evolve `invoice-maker` from a single-user internal tool into a secure multi-user product that other people can sign up for and use independently.

It is intended to serve two purposes:
- a build roadmap while implementing the feature
- a durable record of the architectural decisions we made

## Current State
Today the application is effectively single-tenant.

### Why it is single-tenant
- There is no authentication or authorization layer.
- API endpoints operate on global data.
- `clients`, `invoices`, and `chat_sessions` are not owned by a user or workspace.
- invoice branding comes from global environment variables like `COMPANY_NAME`, `COMPANY_EMAIL`, and `COMPANY_ADDRESS`
- uploaded images are not scoped to a user account or tenant

### Practical implication
If multiple people used the app as-is, they would share the same data set and company branding. That is not acceptable for a public product.

## Goal
Allow any user to sign up, log in, and use the app without seeing or affecting another user's data.

For the first implementation, the priority is simple account isolation, not full team/workspace SaaS complexity.

## Chosen Product Model
Use a simplified workspace-based multi-tenant architecture.

### Chosen approach
- each signed-in user gets exactly one workspace
- each workspace has exactly one member for MVP
- all business data is scoped to that workspace
- future team support, multiple workspaces, and invites are explicitly deferred

### Why keep a workspace concept at all
- it gives us clean data isolation now
- it preserves a path to teams later
- it avoids doing a full rewrite if multi-member support is added in the future

## MVP Scope
The first public multi-user version should include:
- Clerk authentication
- open signup
- one workspace per user
- strict data isolation for clients, invoices, chats, and uploads
- protected frontend routes
- simple onboarding
- preservation of all current production data by attaching it to the existing owner's workspace

The MVP does not need:
- multi-member teams
- invitations
- multiple workspaces per user
- admin back office
- subscription billing
- quotas / metering beyond basic safeguards
- granular role systems

## High-Level Architecture

### Core concepts
- `User`: an authenticated person
- `Workspace`: the account/container that owns data
- `BusinessProfile`: simple invoice header / branding data for that user's account

### Ownership model
The following records should belong to a workspace:
- `clients`
- `invoices`
- `chat_sessions`
- uploaded files / image metadata

The following records inherit ownership through their parent:
- `hours_entries` through `invoice`
- `line_items` through `invoice`
- `chat_messages` through `chat_session`

## Chosen Auth Approach
Use `Clerk` for authentication, following the conventions in `starter-app/CLERK_AUTH_SETUP_GUIDE.md`.

### Auth principles
- Clerk is the identity provider
- the app database remains the source of truth for ownership and authorization
- the backend must verify auth and enforce access rules
- frontend route protection is for UX, not security

### What not to do
- do not build custom password auth
- do not rely on frontend route guards alone for authorization

## Data Model Changes

### New tables

#### `users`
Suggested fields:
- `id`
- `auth_provider`
- `auth_provider_user_id`
- `email`
- `full_name`
- `created_at`
- `updated_at`

Notes:
- if using managed auth, this can either mirror provider users or store app-specific user metadata

#### `workspaces`
Suggested fields:
- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

#### `business_profiles`
Suggested fields:
- `id`
- `workspace_id`
- `company_name`
- `company_email`
- `company_address`
- `company_phone`
- `default_currency`
- `default_invoice_notes`
- `logo_url` (optional, future)
- `created_at`
- `updated_at`

Notes:
- keep this intentionally simple for MVP
- one workspace has one business profile
- richer settings can be added later

### Existing table changes

#### `clients`
Add:
- `workspace_id`

#### `invoices`
Add:
- `workspace_id`

#### `chat_sessions`
Add:
- `workspace_id`

#### uploaded image metadata table
If uploads remain important, create a table such as `uploaded_assets`:
- `id`
- `workspace_id`
- `uploaded_by_user_id`
- `url`
- `storage_key`
- `content_type`
- `created_at`

### Constraints and indexes
- unique index on `workspaces.slug`
- unique client names should be workspace-scoped, not global
  - current global uniqueness on `clients.name` should become effectively `unique(workspace_id, name)` if desired
- invoice number uniqueness should likely be workspace-scoped unless there is a specific reason to keep it globally unique
  - recommended: `unique(workspace_id, invoice_number)`

## Backend Changes

### 1. Add auth middleware / dependency
Every protected route should resolve:
- authenticated user
- that user's workspace

Suggested dependency flow:
- verify Clerk session/JWT
- resolve or provision app user
- resolve the user's single workspace
- inject both into route handlers

### 2. Scope all database queries
Every API endpoint that reads or writes tenant data must filter by `workspace_id`.

Examples:
- `GET /clients` -> only clients for current workspace
- `GET /invoices` -> only invoices for current workspace
- `GET /sessions` -> only sessions for current workspace
- `GET /invoices/{id}` -> ensure invoice belongs to current workspace

### 3. Enforce ownership on nested resources
Even if an ID exists, deny access when it belongs to another workspace.

### 4. Move company settings out of env config
Current invoice company branding comes from `backend/app/config.py`.

That should be replaced with:
- a simple `business_profiles` record stored in database
- data loaded at invoice generation time for the current workspace

Environment variables should remain only for true app-level config:
- database connection
- OpenRouter key
- S3 credentials
- frontend URL
- environment

### 5. Update PDF generation
`pdf_generator` should use workspace business profile data instead of global env data.

### 6. Update chat and AI context
When building client context for AI:
- only include clients from the current workspace
- only include session history for the current workspace

### 7. Update S3 / upload flow
Uploads should be tenant-aware.

Chosen direction based on `starter-app/AWS_S3_SETUP_GUIDE.md`:
- use a private S3 bucket
- use presigned upload/download flows
- include workspace-based path prefixes in S3 keys
- keep upload metadata in database
- prevent cross-tenant visibility

## Frontend Changes

### Auth UI
Add:
- sign up page
- login page
- logout action
- auth session handling

### Protected routes
Require auth for:
- chat
- manual invoice creation
- clients
- history
- invoice detail

### Onboarding flow
Keep onboarding simple.

On first login:
1. create workspace automatically
2. create or collect a basic business profile
3. optionally add first client later
4. land user in chat or dashboard

### Active workspace state
At MVP there is only one workspace per user, so the UI does not need workspace switching.

Still, backend data modeling should make adding workspace switching possible later.

## API Design Recommendations

### Keep current routes, add auth and scoping
This is the least disruptive path.

Examples:
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/invoices`
- `POST /api/chat`

Internally they become workspace-scoped rather than global.

### Add new account routes
Likely needed:
- `GET /api/me`
- `GET /api/workspace`
- `PUT /api/business-profile`
- `POST /api/onboarding`

## Migration Strategy

### Recommended sequence

#### Phase 1: Foundations
- add new user/workspace tables
- add `workspace_id` columns to tenant-owned tables
- create business profile table
- keep app working for existing single-user data

#### Phase 2: Backfill existing data
Create one default workspace for the existing owner data and assign all current records to it.

This allows migration without losing current invoices, clients, or chats.

#### Phase 3: Add auth
- integrate Clerk
- require auth for frontend access
- add backend token verification

#### Phase 4: Enforce tenant scoping
- update all queries
- add authorization checks
- test cross-tenant isolation

#### Phase 5: Add onboarding
- create workspace on first login
- collect company profile

#### Phase 6: Public launch controls
- rate limiting
- usage monitoring
- quotas or billing if needed

## Existing Data Backfill Plan
Because the app already has production data, we need a safe migration path.

### Backfill approach
1. create a workspace for the current owner
2. create a business profile using current env-based company values
3. set `workspace_id` on all existing:
   - clients
   - invoices
   - chat_sessions
4. derive ownership of nested data from parent records

### Important note
Do not remove env-based branding immediately. Keep a temporary fallback during migration so invoice generation still works if a business profile is missing.

## Security Requirements

### Required
- authenticated access for all tenant routes
- strict workspace scoping in backend
- no trusting workspace IDs from raw frontend input without verification
- secure token/session validation
- rate limiting
- audit logging for important actions if feasible

### Nice to have
- signed URLs for sensitive files
- upload virus scanning or content validation
- stronger moderation / abuse protection for public signup

## Billing and Usage Controls
If outside users can upload screenshots and call LLM APIs, costs can rise quickly.

### Recommended launch protections
- max images per message
- max file size
- usage logging per workspace when possible

More advanced quotas and metering are deferred to future improvements.

### Billing later
When ready, add:
- Stripe
- subscription tiers
- metered usage for AI-heavy workflows if needed

## Product Decisions to Make

### Decisions now locked for MVP
1. auth provider: `Clerk`
2. signup model: open signup
3. account model: one workspace per user
4. team model: no team support yet
5. roles: none beyond the single account owner for MVP
6. uploads: private S3 bucket with tenant-aware access
7. preserve and migrate all current data into the existing owner's workspace

## Chosen MVP Decisions
- Auth provider: `Clerk`
- Signup: open signup
- Account model: one workspace per user
- Roles: single-owner style MVP, no team roles exposed yet
- Billing: not in MVP
- Invoice number uniqueness: per workspace
- Client uniqueness: per workspace
- Company profile: simple business profile stored in database per workspace
- Upload strategy: private S3 bucket with presigned access

## Concrete Implementation Checklist

### Database
- [ ] create `users` table
- [ ] create `workspaces` table
- [ ] create `business_profiles` table
- [ ] add `workspace_id` to `clients`
- [ ] add `workspace_id` to `invoices`
- [ ] add `workspace_id` to `chat_sessions`
- [ ] add indexes and uniqueness constraints
- [ ] write backfill migration for existing data

### Backend
- [ ] integrate auth verification
- [ ] create current user dependency
- [ ] create current workspace dependency
- [ ] scope all client queries
- [ ] scope all invoice queries
- [ ] scope all chat queries
- [ ] update PDF generation to use workspace settings
- [ ] update AI client context to use workspace-scoped clients
- [ ] add onboarding endpoints

### Frontend
- [ ] add login/signup
- [ ] add protected routes
- [ ] add session persistence
- [ ] add onboarding flow
- [ ] add company profile settings UI
- [ ] add logout
- [ ] prepare state for active workspace

### Uploads and storage
- [ ] make upload keys workspace-aware
- [ ] add upload metadata table if needed
- [ ] ensure no cross-tenant file access

### Operations
- [ ] add rate limiting
- [ ] add usage logging
- [ ] add alerts/monitoring for AI costs
- [ ] document rollout and migration steps

## Testing Plan

### Backend tests
- user can only read their own workspace data
- user cannot read another workspace's invoice by ID
- user cannot update another workspace's client
- PDF generation uses workspace company profile
- AI context only includes current workspace clients

### Frontend tests
- unauthenticated users are redirected to login
- first-time user sees onboarding
- logged-in user can create clients/invoices/chats normally
- switching sessions never reveals other tenant data

### Manual security tests
- attempt direct API access to another tenant's IDs
- attempt changing IDs in frontend requests
- test file upload and retrieval isolation

## Rollout Plan

### Suggested rollout
1. implement data model and auth in staging
2. backfill current owner data into one workspace
3. test existing workflows thoroughly
4. soft launch with open signup if comfortable
5. monitor AI cost, upload usage, and support issues
6. open public signup once stable

## Risks

### Main risks
- missing one unscoped query and leaking data across tenants
- underestimating the amount of env-based logic tied to a single business
- AI/upload costs rising after public access
- migration complexity if current production data is not backfilled carefully

## Definition of Done
This feature should be considered complete when:
- a new user can sign up and onboard without manual intervention
- each workspace has isolated clients, invoices, chats, and settings
- invoice branding comes from workspace profile, not global env vars
- no tenant can access another tenant's records
- current owner data remains intact after migration
- the app is safe enough for external beta users

## Future Enhancements
- workspace invites
- member roles and permissions
- multiple workspaces per user
- Stripe billing
- usage dashboard
- logos and richer branding
- audit log
- admin support tools
- whitelist / controlled signup
- template marketplace or custom templates

## Decision Log
Use this section to record what was actually chosen during implementation.

### Decisions made
- Auth provider: Clerk
- Signup model: open signup
- One workspace per user for MVP
- No team members or roles in MVP
- Preserve and migrate existing data into the current owner's workspace
- Use a private S3 bucket pattern for uploads
- Defer admin tools, invites, billing, quotas, and multi-workspace support

### Notable deviations from this plan
- Pending
