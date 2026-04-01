"""Schemas for authenticated account and onboarding APIs."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class BusinessProfileBase(BaseModel):
    """Base business profile fields."""

    company_name: str = Field(..., min_length=1, max_length=255)
    company_email: str | None = Field(None, max_length=255)
    company_address: str | None = None
    company_phone: str | None = Field(None, max_length=100)


class BusinessProfileUpdate(BusinessProfileBase):
    """Schema for onboarding or updating business profile."""

    pass


class BusinessProfileResponse(BusinessProfileBase):
    """Business profile payload returned to frontend."""

    id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceResponse(BaseModel):
    """Authenticated workspace summary."""

    id: str
    name: str
    slug: str
    onboarding_completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    """Authenticated app user summary."""

    id: str
    clerk_user_id: str
    email: str
    full_name: str | None
    workspace_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MeResponse(BaseModel):
    """Current authenticated account payload."""

    user: UserResponse
    workspace: WorkspaceResponse
    business_profile: BusinessProfileResponse | None
    needs_onboarding: bool
