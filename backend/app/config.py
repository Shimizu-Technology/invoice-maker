"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str

    # OpenRouter AI
    openrouter_api_key: str
    openrouter_model: str = "anthropic/claude-3.5-sonnet"

    # Application
    environment: str = "development"
    debug: bool = True

    # CORS
    frontend_url: str = "http://localhost:5173"

    # Company/User Info for Invoices
    company_name: str = "Your Company Name"
    company_email: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None

    # AWS S3 for image storage
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_s3_bucket: Optional[str] = None
    aws_s3_region: str = "us-east-1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra environment variables
    )

    def get_company_info(self) -> dict:
        """Get company info as a dict for PDF generation."""
        return {
            "name": self.company_name,
            "email": self.company_email or "",
            "address": self.company_address or "",
            "phone": self.company_phone or "",
        }


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
