"""Add preview_json to chat_messages

Revision ID: 006
Revises: 005
Create Date: 2026-01-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_add_preview_json'
down_revision: Union[str, None] = '005_add_session_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add preview_json column to chat_messages table
    # This stores the full invoice preview JSON for messages that have has_preview=True
    op.add_column(
        'chat_messages',
        sa.Column('preview_json', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('chat_messages', 'preview_json')
