"""API routers for the Invoice Maker application."""

from fastapi import APIRouter
from .clients import router as clients_router
from .invoices import router as invoices_router
from .chat import router as chat_router
from .quick_invoice import router as quick_invoice_router

api_router = APIRouter(prefix="/api")
api_router.include_router(clients_router, prefix="/clients", tags=["clients"])
api_router.include_router(invoices_router, prefix="/invoices", tags=["invoices"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(quick_invoice_router, prefix="/quick-invoice", tags=["quick-invoice"])

__all__ = ["api_router"]
