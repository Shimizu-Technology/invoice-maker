#!/bin/bash
# Start the backend server with required library path for WeasyPrint
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
uv run uvicorn app.main:app --reload "$@"
