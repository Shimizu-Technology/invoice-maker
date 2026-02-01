"""Add ticket and description to hours_entries

Revision ID: 008_ticket_and_description
Revises: 007_archive_and_numbering
Create Date: 2026-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_ticket_and_description'
down_revision: Union[str, None] = '007_archive_and_numbering'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ticket and description columns to hours_entries table."""
    op.add_column('hours_entries', sa.Column('ticket', sa.String(100), nullable=True))
    op.add_column('hours_entries', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove ticket and description columns from hours_entries table."""
    op.drop_column('hours_entries', 'description')
    op.drop_column('hours_entries', 'ticket')
