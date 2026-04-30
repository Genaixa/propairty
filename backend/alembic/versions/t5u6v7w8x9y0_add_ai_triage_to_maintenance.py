"""add ai_triage to maintenance_requests

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-04-30

"""
from alembic import op
import sqlalchemy as sa

revision = 't5u6v7w8x9y0'
down_revision = 's4t5u6v7w8x9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('maintenance_requests', sa.Column('ai_triage', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('maintenance_requests', 'ai_triage')
