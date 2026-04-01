"""Authentication and tenancy helpers for Clerk-backed requests."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models.business_profile import BusinessProfile
from .models.user import User
from .models.workspace import Workspace


def clerk_enabled() -> bool:
    """Return whether Clerk auth should be enforced."""
    return bool(settings.clerk_jwks_url or settings.clerk_issuer)


def _build_jwks_url() -> str:
    if settings.clerk_jwks_url:
        return settings.clerk_jwks_url
    if settings.clerk_issuer:
        return f"{settings.clerk_issuer.rstrip('/')}/.well-known/jwks.json"
    raise RuntimeError("Clerk is not configured")


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(_build_jwks_url())


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")
    return token


def _verify_clerk_token(token: str) -> dict[str, Any]:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        decode_kwargs: dict[str, Any] = {
            "algorithms": ["RS256"],
            "options": {"verify_aud": bool(settings.clerk_audience)},
        }
        if settings.clerk_audience:
            decode_kwargs["audience"] = settings.clerk_audience
        if settings.clerk_issuer:
            decode_kwargs["issuer"] = settings.clerk_issuer
        return jwt.decode(token, signing_key.key, **decode_kwargs)
    except Exception as exc:  # pragma: no cover - exact JWT errors vary
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth token") from exc


def _fetch_clerk_user_details(clerk_user_id: str, claims: dict[str, Any]) -> tuple[str, str | None]:
    """Fetch email and full name for a Clerk user."""
    if settings.clerk_secret_key:
        response = httpx.get(
            f"https://api.clerk.com/v1/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=10.0,
        )
        if response.is_success:
            payload = response.json()
            email = None
            primary_email_id = payload.get("primary_email_address_id")
            for item in payload.get("email_addresses", []):
                if item.get("id") == primary_email_id:
                    email = item.get("email_address")
                    break
            if not email and payload.get("email_addresses"):
                email = payload["email_addresses"][0].get("email_address")
            first_name = payload.get("first_name") or ""
            last_name = payload.get("last_name") or ""
            full_name = " ".join(part for part in [first_name, last_name] if part).strip() or None
            if email:
                return email, full_name

    email = claims.get("email") or claims.get("email_address")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user email could not be resolved",
        )
    full_name = claims.get("name")
    return email, full_name


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "workspace"


def _unique_workspace_slug(db: Session, base: str) -> str:
    slug = _slugify(base)
    candidate = slug
    counter = 2
    while db.query(Workspace).filter(Workspace.slug == candidate).first():
        candidate = f"{slug}-{counter}"
        counter += 1
    return candidate


def _ensure_business_profile(
    db: Session,
    workspace: Workspace,
    *,
    company_name: str | None,
    company_email: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
) -> BusinessProfile:
    profile = workspace.business_profile
    if profile:
        if company_name and not profile.company_name:
            profile.company_name = company_name
        if company_email and not profile.company_email:
            profile.company_email = company_email
        if company_address and not profile.company_address:
            profile.company_address = company_address
        if company_phone and not profile.company_phone:
            profile.company_phone = company_phone
        return profile

    profile = BusinessProfile(
        workspace_id=workspace.id,
        company_name=company_name,
        company_email=company_email,
        company_address=company_address,
        company_phone=company_phone,
    )
    db.add(profile)
    return profile


def _provision_workspace_for_user(db: Session, email: str, full_name: str | None) -> Workspace:
    workspace_name = f"{full_name}'s Workspace" if full_name else "My Workspace"
    slug_seed = full_name or email.split("@")[0]
    workspace = Workspace(
        name=workspace_name,
        slug=_unique_workspace_slug(db, slug_seed),
        onboarding_completed=False,
        is_bootstrap=False,
    )
    db.add(workspace)
    db.flush()
    _ensure_business_profile(
        db,
        workspace,
        company_name=full_name or email.split("@")[0].replace(".", " ").title(),
        company_email=email,
    )
    return workspace


def _claim_bootstrap_workspace_if_applicable(db: Session, email: str) -> Workspace | None:
    bootstrap_workspace = db.query(Workspace).filter(Workspace.is_bootstrap == True).first()
    if not bootstrap_workspace:
        return None

    configured_owner_email = settings.bootstrap_owner_email or settings.company_email
    if configured_owner_email and email.lower() != configured_owner_email.lower():
        return None

    if not configured_owner_email and db.query(User).count() > 0:
        return None

    bootstrap_workspace.is_bootstrap = False
    bootstrap_workspace.onboarding_completed = True
    profile = _ensure_business_profile(
        db,
        bootstrap_workspace,
        company_name=settings.company_name,
        company_email=settings.company_email or email,
        company_address=settings.company_address,
        company_phone=settings.company_phone,
    )
    if not profile.company_email:
        profile.company_email = email
    return bootstrap_workspace


@dataclass
class AuthContext:
    """Container for the authenticated app user and workspace."""

    user: User
    workspace: Workspace


def _get_or_create_dev_context(db: Session) -> AuthContext:
    user = db.query(User).filter(User.clerk_user_id == "dev-user").first()
    if user:
        return AuthContext(user=user, workspace=user.workspace)

    workspace = db.query(Workspace).filter(Workspace.is_bootstrap == True).first()
    if workspace is None:
        workspace = Workspace(
            name=settings.company_name or "Development Workspace",
            slug=_unique_workspace_slug(db, "dev-workspace"),
            onboarding_completed=True,
            is_bootstrap=False,
        )
        db.add(workspace)
        db.flush()
        _ensure_business_profile(
            db,
            workspace,
            company_name=settings.company_name,
            company_email=settings.company_email,
            company_address=settings.company_address,
            company_phone=settings.company_phone,
        )
    else:
        workspace.is_bootstrap = False

    user = User(
        clerk_user_id="dev-user",
        email=settings.bootstrap_owner_email or settings.company_email or "dev@example.com",
        full_name="Development User",
        workspace_id=workspace.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthContext(user=user, workspace=workspace)


def get_auth_context(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthContext:
    """Resolve the current authenticated app user and workspace."""
    if not clerk_enabled():
        return _get_or_create_dev_context(db)

    token = _extract_bearer_token(authorization)
    claims = _verify_clerk_token(token)
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth token")

    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    if user:
        return AuthContext(user=user, workspace=user.workspace)

    email, full_name = _fetch_clerk_user_details(clerk_user_id, claims)
    workspace = _claim_bootstrap_workspace_if_applicable(db, email) or _provision_workspace_for_user(
        db, email, full_name
    )
    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        full_name=full_name,
        workspace_id=workspace.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthContext(user=user, workspace=user.workspace)


def get_current_user(context: AuthContext = Depends(get_auth_context)) -> User:
    """Dependency for the current authenticated user."""
    return context.user


def get_current_workspace(context: AuthContext = Depends(get_auth_context)) -> Workspace:
    """Dependency for the current authenticated workspace."""
    return context.workspace
