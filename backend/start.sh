#!/bin/bash
# Start the backend server with required library path for WeasyPrint
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib

# Run database migrations before starting
echo "Running database migrations..."
uv run alembic upgrade head

# Start the server
echo "Starting server..."
uv run uvicorn app.main:app --reload "$@"
