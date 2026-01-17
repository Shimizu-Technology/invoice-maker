"""Add image_url to chat_messages

Revision ID: 003_add_image_url
Revises: 002_add_chat_sessions
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_add_image_url'
down_revision: Union[str, None] = '002_chat_sessions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add image_url column to chat_messages table
    op.add_column(
        'chat_messages',
        sa.Column('image_url', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    # Remove image_url column
    op.drop_column('chat_messages', 'image_url')
