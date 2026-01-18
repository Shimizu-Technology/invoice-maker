"""Add session_id to invoices

Revision ID: 005
Revises: 004
Create Date: 2026-01-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_add_session_id'
down_revision: Union[str, None] = '004_add_image_urls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add session_id column to invoices table
    op.add_column(
        'invoices',
        sa.Column('session_id', sa.String(36), sa.ForeignKey('chat_sessions.id'), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('invoices', 'session_id')
