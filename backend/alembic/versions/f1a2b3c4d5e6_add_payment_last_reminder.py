"""add payment last_reminder_sent

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('rent_payments', sa.Column('last_reminder_sent', sa.Date(), nullable=True))

def downgrade():
    op.drop_column('rent_payments', 'last_reminder_sent')
