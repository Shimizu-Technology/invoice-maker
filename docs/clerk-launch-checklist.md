# Clerk Launch Checklist

This checklist is for switching `invoice-maker` from development bypass mode to the real Clerk-authenticated multi-user flow.

## Local Setup

### Frontend
Create `frontend/.env.local` from `frontend/.env.example` and set:

- `VITE_API_URL=http://localhost:8000`
- `VITE_CLERK_PUBLISHABLE_KEY=<your Clerk publishable key>`

### Backend
Create `backend/.env` from `backend/.env.example` and set:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` if overriding the default
- `FRONTEND_URL=http://localhost:5173`
- `CLERK_JWKS_URL` or `CLERK_ISSUER`
- `CLERK_SECRET_KEY` for first-login user provisioning
- `BOOTSTRAP_OWNER_EMAIL` if attaching existing single-tenant data to the first real owner account

Optional but recommended:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `AWS_S3_REGION`

## Clerk Dashboard

Configure the Clerk application with:

- open signup enabled
- the sign-in methods you want to support
- local development URLs allowed
- production domain URLs added before launch

Recommended local URLs:

- frontend app: `http://localhost:5173`
- backend API: `http://localhost:8000`

## First Real Auth Smoke Test

1. Start backend with `./start.sh` or your normal local backend command.
2. Start frontend with `npm run dev`.
3. Open the app in a fresh browser session.
4. Confirm you are taken to Clerk sign-in/sign-up instead of dev bypass.
5. Create a new account.
6. Confirm first login lands in onboarding.
7. Complete business profile onboarding.
8. Confirm `chat`, `clients`, and `history` load for the new user.
9. Create a client and verify it does not appear for any other user.
10. Upload a chat image and confirm it still renders after reload.
11. Generate an invoice and confirm PDF/email generation still works.

## Existing Data Migration Check

If this environment already had single-tenant production data:

1. Sign up using the email that matches `BOOTSTRAP_OWNER_EMAIL`.
2. Confirm the legacy clients, invoices, and chat sessions appear in that account.
3. Sign up with a second unrelated user.
4. Confirm the second user sees an empty isolated workspace.

## Production Env Checklist

### Frontend

- `VITE_API_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

### Backend

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `FRONTEND_URL`
- `CLERK_JWKS_URL` or `CLERK_ISSUER`
- `CLERK_SECRET_KEY`
- `BOOTSTRAP_OWNER_EMAIL` during cutover if needed
- S3 credentials and bucket settings if uploads are enabled

## Notes

- Without Clerk env configured, the app intentionally runs in development bypass mode.
- Business branding now comes from per-workspace onboarding/business profile data, not only global env vars.
- Uploaded chat images are now stored as workspace-owned private assets and resolved with presigned URLs.
