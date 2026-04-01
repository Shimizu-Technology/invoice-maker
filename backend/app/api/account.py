"""Authenticated account and onboarding endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_auth_context
from ..database import get_db
from ..schemas.account import BusinessProfileResponse, BusinessProfileUpdate, MeResponse

router = APIRouter()


@router.get("/me", response_model=MeResponse)
async def get_me(
    auth=Depends(get_auth_context),
):
    """Return the current authenticated user, workspace, and onboarding state."""
    workspace = auth.workspace
    business_profile = workspace.business_profile
    needs_onboarding = not workspace.onboarding_completed or not (
        business_profile and business_profile.company_name
    )
    return MeResponse(
        user=auth.user,
        workspace=workspace,
        business_profile=business_profile,
        needs_onboarding=needs_onboarding,
    )


@router.put("/business-profile", response_model=BusinessProfileResponse)
async def update_business_profile(
    payload: BusinessProfileUpdate,
    auth=Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Create or update the current workspace business profile."""
    workspace = auth.workspace
    profile = workspace.business_profile
    if profile is None:
        from ..models.business_profile import BusinessProfile

        profile = BusinessProfile(
            workspace_id=workspace.id,
            company_name=payload.company_name,
            company_email=payload.company_email,
            company_address=payload.company_address,
            company_phone=payload.company_phone,
        )
        db.add(profile)
    else:
        profile.company_name = payload.company_name
        profile.company_email = payload.company_email
        profile.company_address = payload.company_address
        profile.company_phone = payload.company_phone

    workspace.name = payload.company_name
    workspace.onboarding_completed = True
    db.commit()
    db.refresh(profile)
    return profile
