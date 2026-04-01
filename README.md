# Invoice Maker

An AI-powered invoice generator with a chat interface. Describe your invoice in natural language, upload screenshots of timesheets, and get professional PDFs ready to send.

## Tech Stack

**Backend**
- FastAPI (Python 3.11+)
- PostgreSQL + SQLAlchemy
- WeasyPrint (PDF generation)
- OpenRouter API (Gemini 2.5 Pro by default)
- AWS S3 (private workspace-scoped image storage)
- Clerk-backed authentication

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Router

## Features

- **AI Chat Interface** - Describe invoices naturally: "Create an invoice for Spectrio for Jan 1-15, here's my timesheet"
- **Image Upload** - Paste screenshots or drag-drop timesheets for AI to extract hours
- **Client Management** - Store client info, default rates, invoice prefixes, and contract templates
- **PDF Generation** - Professional invoices with multiple templates (hourly, tuition, project)
- **Email Generation** - Auto-generated email body ready to paste into Gmail
- **Status Tracking** - Track invoices through draft → generated → sent → paid
- **Preview Versioning** - Track invoice preview iterations (v1, v2, v3...) during creation
- **Archive Support** - Archive old chat sessions and invoices to keep things tidy
- **Mobile Optimized** - Clean, touch-friendly UI for creating invoices on the go
- **Multi-User SaaS Foundation** - Per-workspace isolation for clients, invoices, chats, and branding

## How It Works

### Creating an Invoice (Chat Flow)

1. **Start a chat** - Go to the Chat tab and describe what you need:
   - "Create an invoice for Spectrio for January 1-15"
   - "Invoice Guam Airport for 7 hours of consulting at $145/hr"

2. **Add context (optional)** - Paste or drag-drop screenshots of timesheets. The AI extracts dates, hours, and amounts automatically.

3. **Review the preview** - The AI shows a structured preview of your invoice with all line items, dates, and totals.

4. **Generate PDF** - Click "Generate PDF" to create the final invoice. The system:
   - Creates the invoice record in the database
   - Generates a professional PDF using the client's template
   - Auto-generates an email body specific to that client

5. **Send it** - Click "Copy Email" to copy the pre-written email, paste into Gmail, attach the PDF, and send. Then click "Mark as Sent" to update the status.

### Client Templates

Each client can have a different invoice template:
- **Hourly** - For contract work with date-by-date hour entries
- **Tuition** - For education/training with fixed payment amounts
- **Project** - For project-based work with line item descriptions

The AI automatically uses the right template based on the client's settings.

## Getting Started

### Option A: Docker (Recommended)

The easiest way to run locally - no system dependency setup needed.

```bash
# Start both backend and frontend
docker-compose up
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173

> **Note:** You still need `backend/.env` with your credentials. If you want real auth locally, also create `frontend/.env.local`.
>
> See [DOCKER.md](DOCKER.md) for detailed Docker guide.

### Option B: Manual Setup

#### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- WeasyPrint system dependencies (see below)

#### 1. Clone & Setup Backend

```bash
cd backend

# Install Python dependencies
uv sync

# Copy environment template and fill in your values
cp .env.example .env

# Run database migrations
uv run alembic upgrade head

# Start the backend server
./start.sh
```

The API runs at `http://localhost:8000`. View interactive docs at `/docs`.

> **Why `./start.sh` instead of `uvicorn` directly?**  
> WeasyPrint (the PDF library) requires native system libraries (Cairo, Pango, etc.). On macOS with Homebrew, these libraries are installed to `/opt/homebrew/lib`, but Python can't find them by default. The `start.sh` script sets `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib` before starting the server so WeasyPrint can locate these libraries.
>
> On Linux or Docker, run `uvicorn app.main:app --reload` directly.

#### 2. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template if you want local Clerk auth
cp .env.example .env.local

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

#### WeasyPrint Dependencies (macOS - manual setup only)

If not using Docker, WeasyPrint requires system libraries:

```bash
brew install pango cairo libffi gdk-pixbuf
```

## Environment Variables

Create `backend/.env` with values from `backend/.env.example`.

If you want real auth locally, also create `frontend/.env.local` from `frontend/.env.example`.

### Backend Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | ✅ | API key from [OpenRouter](https://openrouter.ai/) |
| `OPENROUTER_MODEL` | | AI model (default: `google/gemini-2.5-pro`) |
| `CLERK_JWKS_URL` | Recommended for auth | Clerk JWKS URL for JWT verification |
| `CLERK_ISSUER` | Alternative | Clerk issuer URL if you prefer deriving the JWKS URL |
| `CLERK_SECRET_KEY` | Recommended for auth | Used to fetch Clerk user details during provisioning |
| `CLERK_AUDIENCE` | Optional | Audience validation if your Clerk setup uses it |
| `BOOTSTRAP_OWNER_EMAIL` | Recommended for cutover | Email that should claim legacy single-tenant data on first real login |
| `COMPANY_NAME` | Optional | Bootstrap/dev fallback company name |
| `COMPANY_EMAIL` | Optional | Bootstrap/dev fallback company email |
| `COMPANY_ADDRESS` | Optional | Bootstrap/dev fallback address |
| `COMPANY_PHONE` | Optional | Bootstrap/dev fallback phone |
| `AWS_ACCESS_KEY_ID` | | For image uploads (optional) |
| `AWS_SECRET_ACCESS_KEY` | | For image uploads (optional) |
| `AWS_S3_BUCKET` | | S3 bucket name (optional) |
| `AWS_S3_REGION` | | S3 region (default: `us-east-1`) |
| `FRONTEND_URL` | | Frontend URL for CORS (default: `http://localhost:5173`) |

### Frontend Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Recommended | Backend base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Required for real auth | Clerk publishable key for sign-in/sign-up |

Without Clerk vars, the app runs in development bypass mode locally.

## Deployment

### Frontend (Netlify)

1. Connect repo, set **Base directory:** `frontend`
2. **Build command:** `npm run build`
3. **Publish directory:** `dist`
4. **Environment variable:** `VITE_API_URL` = your backend URL
5. **Environment variable:** `VITE_CLERK_PUBLISHABLE_KEY` = your Clerk frontend key

### Backend (Render with Docker)

1. Connect repo, set **Root directory:** `backend`
2. **Environment:** Docker
3. Render will auto-detect the `Dockerfile`
4. **Environment variables:** See table below

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | `postgresql://...` (Neon) |
| `OPENROUTER_API_KEY` | ✅ | `sk-or-v1-...` |
| `FRONTEND_URL` | ✅ | `https://your-app.netlify.app` |
| `CLERK_JWKS_URL` or `CLERK_ISSUER` | ✅ for real auth | Clerk JWT verification settings |
| `CLERK_SECRET_KEY` | ✅ for provisioning | Clerk backend secret |
| `BOOTSTRAP_OWNER_EMAIL` | Recommended at cutover | Existing owner email for legacy data claim |
| `AWS_ACCESS_KEY_ID` | | For image uploads |
| `AWS_SECRET_ACCESS_KEY` | | For image uploads |
| `AWS_S3_BUCKET` | | Your bucket name |

See `docs/clerk-launch-checklist.md` for the full auth launch flow and cutover checklist.

## Project Structure

```
invoice-maker/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints (chat, clients, invoices)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # AI, PDF, S3 services
│   │   └── templates/    # Invoice HTML/CSS templates
│   ├── alembic/          # Database migrations
│   └── start.sh          # Dev server script
├── frontend/
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Route pages
│       ├── services/     # API client
│       └── types/        # TypeScript types
└── README.md
```

## License

Private project.
