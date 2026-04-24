"""add role column to public_users

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-04-14 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'k6l7m8n9o0p1'
down_revision = 'j5k6l7m8n9o0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('public_users', sa.Column('role', sa.String(), nullable=False, server_default='tenant'))


def downgrade():
    op.drop_column('public_users', 'role')
