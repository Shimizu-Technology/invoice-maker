"""Add image_urls_json to chat_messages

Revision ID: 004_add_image_urls
Revises: 003_add_image_url
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_add_image_urls'
down_revision: Union[str, None] = '003_add_image_url'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add image_urls_json column to chat_messages table
    op.add_column(
        'chat_messages',
        sa.Column('image_urls_json', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    # Remove image_urls_json column
    op.drop_column('chat_messages', 'image_urls_json')
