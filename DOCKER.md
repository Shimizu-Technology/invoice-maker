# Docker Setup

Simple guide to running Invoice Maker with Docker.

## What is Docker?

Docker packages your app and all its dependencies into a **container** - think of it as a lightweight, portable box that has everything needed to run the app.

**Why use it?**
- ✅ **Same environment everywhere** - Works the same on your Mac, a coworker's Windows, or a cloud server
- ✅ **No "works on my machine" problems** - All dependencies are bundled
- ✅ **One command to start** - No installing Python, Node, WeasyPrint libraries separately

**How it works:**
1. `Dockerfile` - A recipe that describes how to build the container (install Python, add libraries, copy code)
2. `docker-compose.yml` - Defines which containers to run and how they connect
3. `docker-compose up` - Builds and starts everything

### One Command, Multiple Services

Normally you'd need two terminals:
```
Terminal 1: cd backend && ./start.sh
Terminal 2: cd frontend && npm run dev
```

With Docker Compose, one command starts both:
```
docker-compose up
```

Both services run in separate containers, but their logs are merged in one terminal:
```
backend-1  | INFO: Uvicorn running on http://0.0.0.0:8000
frontend-1 | VITE ready in 142 ms
```

---

## Quick Start

```bash
# Make sure you have backend/.env with your credentials
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values

# Start everything
docker-compose up
```

That's it! Visit:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## What's Running

| Service | Description | Port |
|---------|-------------|------|
| `backend` | FastAPI server with WeasyPrint for PDFs | 8000 |
| `frontend` | React dev server with hot reload | 5173 |

## Common Commands

```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# View just backend logs
docker-compose logs -f backend

# Stop everything
docker-compose down

# Rebuild after changing dependencies
docker-compose build --no-cache

# Restart just backend
docker-compose restart backend

# Run services in separate terminals (if you prefer)
docker-compose up backend      # Terminal 1
docker-compose up frontend     # Terminal 2
```

## How It Works

### Backend (`backend/Dockerfile`)

1. Starts with Python 3.11 slim image
2. Installs system libraries for WeasyPrint (pango, cairo, etc.)
3. Installs Python dependencies from `requirements.txt`
4. Runs uvicorn with hot reload

### Frontend

Uses Node.js Alpine image, mounts your code, runs `npm run dev`.

## Files

```
invoice-maker/
├── docker-compose.yml     # Defines both services
├── backend/
│   ├── Dockerfile         # Backend image definition
│   ├── .dockerignore      # Files to exclude from image
│   └── .env               # Your secrets (not in git)
```

## Environment Variables

The backend needs these in `backend/.env`:

```env
DATABASE_URL=postgresql://...        # Required
OPENROUTER_API_KEY=sk-or-v1-...      # Required
COMPANY_NAME=Your Name               # Required
FRONTEND_URL=http://localhost:5173   # For CORS

# Optional - for image uploads
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
```

## Troubleshooting

### "Cannot connect to database"
Check your `DATABASE_URL` in `backend/.env`. Make sure the Neon database is accessible.

### "Port already in use"
Stop any local servers running on ports 5173 or 8000, or change the ports in `docker-compose.yml`.

### Changes not reflecting
For Python code changes, the container should auto-reload. For dependency changes, rebuild:
```bash
docker-compose build --no-cache
```

### View container status
```bash
docker-compose ps
```
