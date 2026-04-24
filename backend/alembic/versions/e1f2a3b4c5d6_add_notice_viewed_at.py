"""add notice viewed_at

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('legal_notices', sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True))

def downgrade():
    op.drop_column('legal_notices', 'viewed_at')
