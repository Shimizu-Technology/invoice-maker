"""Add multi-tenant auth and ownership foundations.

Revision ID: 009_multi_tenant_foundation
Revises: 008_ticket_and_description
Create Date: 2026-01-21
"""

from typing import Sequence, Union
import os
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "009_multi_tenant_foundation"
down_revision: Union[str, None] = "008_ticket_and_description"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add workspaces, users, business profiles, and workspace scoping."""
    bind = op.get_bind()

    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_bootstrap", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("slug", name="uq_workspaces_slug"),
    )

    op.create_table(
        "business_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("company_email", sa.String(255), nullable=True),
        sa.Column("company_address", sa.Text(), nullable=True),
        sa.Column("company_phone", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id", name="uq_business_profiles_workspace_id"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("clerk_user_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("clerk_user_id", name="uq_users_clerk_user_id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("workspace_id", name="uq_users_workspace_id"),
    )

    op.create_table(
        "uploaded_assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("uploaded_by_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.add_column("clients", sa.Column("workspace_id", sa.String(36), nullable=True))
    op.add_column("invoices", sa.Column("workspace_id", sa.String(36), nullable=True))
    op.add_column("chat_sessions", sa.Column("workspace_id", sa.String(36), nullable=True))

    op.create_index("ix_clients_workspace_id", "clients", ["workspace_id"])
    op.create_index("ix_invoices_workspace_id", "invoices", ["workspace_id"])
    op.create_index("ix_chat_sessions_workspace_id", "chat_sessions", ["workspace_id"])
    op.create_index("ix_uploaded_assets_workspace_id", "uploaded_assets", ["workspace_id"])

    clients_count = bind.execute(sa.text("SELECT COUNT(*) FROM clients")).scalar() or 0
    invoices_count = bind.execute(sa.text("SELECT COUNT(*) FROM invoices")).scalar() or 0
    sessions_count = bind.execute(sa.text("SELECT COUNT(*) FROM chat_sessions")).scalar() or 0
    existing_data_count = clients_count + invoices_count + sessions_count

    if existing_data_count > 0:
        workspace_id = str(uuid.uuid4())
        profile_id = str(uuid.uuid4())
        company_name = os.getenv("COMPANY_NAME", "Shimizu Technology")
        company_email = os.getenv("COMPANY_EMAIL")
        company_address = os.getenv("COMPANY_ADDRESS")
        company_phone = os.getenv("COMPANY_PHONE")

        bind.execute(
            sa.text(
                """
                INSERT INTO workspaces (id, name, slug, onboarding_completed, is_bootstrap)
                VALUES (:id, :name, :slug, true, true)
                """
            ),
            {
                "id": workspace_id,
                "name": company_name or "Default Workspace",
                "slug": "bootstrap-owner",
            },
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO business_profiles
                (id, workspace_id, company_name, company_email, company_address, company_phone)
                VALUES (:id, :workspace_id, :company_name, :company_email, :company_address, :company_phone)
                """
            ),
            {
                "id": profile_id,
                "workspace_id": workspace_id,
                "company_name": company_name,
                "company_email": company_email,
                "company_address": company_address,
                "company_phone": company_phone,
            },
        )

        bind.execute(
            sa.text("UPDATE clients SET workspace_id = :workspace_id WHERE workspace_id IS NULL"),
            {"workspace_id": workspace_id},
        )
        bind.execute(
            sa.text("UPDATE invoices SET workspace_id = :workspace_id WHERE workspace_id IS NULL"),
            {"workspace_id": workspace_id},
        )
        bind.execute(
            sa.text("UPDATE chat_sessions SET workspace_id = :workspace_id WHERE workspace_id IS NULL"),
            {"workspace_id": workspace_id},
        )

    op.alter_column("clients", "workspace_id", nullable=False)
    op.alter_column("invoices", "workspace_id", nullable=False)
    op.alter_column("chat_sessions", "workspace_id", nullable=False)

    op.create_foreign_key("fk_clients_workspace_id", "clients", "workspaces", ["workspace_id"], ["id"])
    op.create_foreign_key("fk_invoices_workspace_id", "invoices", "workspaces", ["workspace_id"], ["id"])
    op.create_foreign_key("fk_chat_sessions_workspace_id", "chat_sessions", "workspaces", ["workspace_id"], ["id"])

    op.execute("ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_name_key")
    op.execute("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key")

    op.create_unique_constraint("uq_clients_workspace_name", "clients", ["workspace_id", "name"])
    op.create_unique_constraint(
        "uq_invoices_workspace_number", "invoices", ["workspace_id", "invoice_number"]
    )


def downgrade() -> None:
    """Remove multi-tenant auth and ownership foundations."""
    op.drop_constraint("uq_invoices_workspace_number", "invoices", type_="unique")
    op.drop_constraint("uq_clients_workspace_name", "clients", type_="unique")

    op.create_unique_constraint("invoices_invoice_number_key", "invoices", ["invoice_number"])
    op.create_unique_constraint("clients_name_key", "clients", ["name"])

    op.drop_constraint("fk_chat_sessions_workspace_id", "chat_sessions", type_="foreignkey")
    op.drop_constraint("fk_invoices_workspace_id", "invoices", type_="foreignkey")
    op.drop_constraint("fk_clients_workspace_id", "clients", type_="foreignkey")

    op.drop_index("ix_uploaded_assets_workspace_id", table_name="uploaded_assets")
    op.drop_index("ix_chat_sessions_workspace_id", table_name="chat_sessions")
    op.drop_index("ix_invoices_workspace_id", table_name="invoices")
    op.drop_index("ix_clients_workspace_id", table_name="clients")

    op.drop_column("chat_sessions", "workspace_id")
    op.drop_column("invoices", "workspace_id")
    op.drop_column("clients", "workspace_id")

    op.drop_table("uploaded_assets")
    op.drop_table("users")
    op.drop_table("business_profiles")
    op.drop_table("workspaces")
