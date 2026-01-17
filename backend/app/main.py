"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import api_router

app = FastAPI(
    title="Invoice Maker API",
    description="AI-powered invoice generator API",
    version="0.1.0",
    redirect_slashes=False,  # Prevent 307 redirects that cause mixed-content issues
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Invoice Maker API",
        "docs": "/docs",
        "health": "/health",
    }
