"""Add archived columns and next_invoice_number

Revision ID: 007_archive_and_numbering
Revises: 006_add_preview_json
Create Date: 2026-01-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_archive_and_numbering'
down_revision: Union[str, None] = '006_add_preview_json'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add archived column to chat_sessions
    op.add_column(
        'chat_sessions',
        sa.Column('archived', sa.Boolean(), nullable=False, server_default='false')
    )
    
    # Add archived column to invoices
    op.add_column(
        'invoices',
        sa.Column('archived', sa.Boolean(), nullable=False, server_default='false')
    )
    
    # Add next_invoice_number to clients for manual sequence control
    op.add_column(
        'clients',
        sa.Column('next_invoice_number', sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('clients', 'next_invoice_number')
    op.drop_column('invoices', 'archived')
    op.drop_column('chat_sessions', 'archived')
