# Invoice Maker

An AI-powered invoice generator with a chat interface. Describe your invoice in natural language, upload screenshots of timesheets, and get professional PDFs ready to send.

## Tech Stack

**Backend**
- FastAPI (Python 3.11+)
- PostgreSQL + SQLAlchemy
- WeasyPrint (PDF generation)
- OpenRouter API (Claude 3.5 Sonnet)
- AWS S3 (image storage)

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Router

## Features

- **AI Chat Interface** - Describe invoices naturally: "Create an invoice for Spectrio for Jan 1-15, here's my timesheet"
- **Image Upload** - Paste screenshots or drag-drop timesheets for AI to extract hours
- **Client Management** - Store client info, default rates, and contract templates
- **PDF Generation** - Professional invoices with 3 templates (hourly, tuition, project)
- **Email Generation** - Auto-generated email body ready to paste into Gmail
- **Status Tracking** - Track invoices through draft → generated → sent → paid

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

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- WeasyPrint system dependencies (see below)

### 1. Clone & Setup Backend

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
> If you're on Linux or have libraries in the default path, you can run `uv run uvicorn app.main:app --reload` directly.

### 2. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

### WeasyPrint Dependencies (macOS)

WeasyPrint requires system libraries for PDF generation:

```bash
brew install pango cairo libffi gdk-pixbuf
```

## Environment Variables

Create `backend/.env` with:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | ✅ | API key from [OpenRouter](https://openrouter.ai/) |
| `OPENROUTER_MODEL` | | AI model (default: `anthropic/claude-3.5-sonnet`) |
| `COMPANY_NAME` | ✅ | Your name/company for invoice header |
| `COMPANY_EMAIL` | | Contact email on invoices |
| `COMPANY_ADDRESS` | | Address on invoices |
| `COMPANY_PHONE` | | Phone on invoices |
| `AWS_ACCESS_KEY_ID` | | For image uploads (optional) |
| `AWS_SECRET_ACCESS_KEY` | | For image uploads (optional) |
| `AWS_S3_BUCKET` | | S3 bucket name (optional) |
| `AWS_S3_REGION` | | S3 region (default: `us-east-1`) |
| `FRONTEND_URL` | | Frontend URL for CORS (default: `http://localhost:5173`) |

## Deployment

**Frontend** - Deploy to Netlify with auto-deploy from GitHub:
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_URL` env var to your backend URL

**Backend** - Deploy to Render, Railway, or similar:
- Use `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set all environment variables
- Ensure PostgreSQL addon is attached

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
