"""Initial schema for Invoice Maker.

Revision ID: 001_initial
Revises:
Create Date: 2026-01-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial tables for Invoice Maker."""
    
    # Create clients table
    op.create_table(
        'clients',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), unique=True, nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('default_rate', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='ChST'),
        sa.Column('template_type', sa.Enum('hourly', 'tuition', 'project', name='templatetype'), 
                  nullable=False, server_default='hourly'),
        sa.Column('payment_terms', sa.Text, nullable=True),
        sa.Column('invoice_prefix', sa.String(20), nullable=False, server_default='INV'),
        sa.Column('company_context', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), 
                  onupdate=sa.func.now()),
    )
    
    # Create invoices table
    op.create_table(
        'invoices',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('client_id', sa.String(36), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('invoice_number', sa.String(50), unique=True, nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('service_period_start', sa.Date, nullable=True),
        sa.Column('service_period_end', sa.Date, nullable=True),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('status', sa.Enum('draft', 'generated', 'sent', 'paid', name='invoicestatus'), 
                  nullable=False, server_default='draft'),
        sa.Column('pdf_path', sa.String(500), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), 
                  onupdate=sa.func.now()),
    )
    
    # Create hours_entries table
    op.create_table(
        'hours_entries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('invoice_id', sa.String(36), sa.ForeignKey('invoices.id'), nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('hours', sa.Numeric(5, 2), nullable=False),
        sa.Column('rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    
    # Create line_items table
    op.create_table(
        'line_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('invoice_id', sa.String(36), sa.ForeignKey('invoices.id'), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False, server_default='1.00'),
        sa.Column('rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    
    # Create indexes for common queries
    op.create_index('ix_invoices_client_id', 'invoices', ['client_id'])
    op.create_index('ix_invoices_date', 'invoices', ['date'])
    op.create_index('ix_invoices_status', 'invoices', ['status'])
    op.create_index('ix_hours_entries_invoice_id', 'hours_entries', ['invoice_id'])
    op.create_index('ix_line_items_invoice_id', 'line_items', ['invoice_id'])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_index('ix_line_items_invoice_id', 'line_items')
    op.drop_index('ix_hours_entries_invoice_id', 'hours_entries')
    op.drop_index('ix_invoices_status', 'invoices')
    op.drop_index('ix_invoices_date', 'invoices')
    op.drop_index('ix_invoices_client_id', 'invoices')
    
    op.drop_table('line_items')
    op.drop_table('hours_entries')
    op.drop_table('invoices')
    op.drop_table('clients')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS invoicestatus')
    op.execute('DROP TYPE IF EXISTS templatetype')
