"""add_maintenance_notes

Revision ID: a1b2c3d4e5f6
Revises: 63cc4351ea10
Create Date: 2026-03-28 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '63cc4351ea10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'maintenance_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('maintenance_request_id', sa.Integer(), sa.ForeignKey('maintenance_requests.id'), nullable=False),
        sa.Column('author_type', sa.String(), nullable=False),
        sa.Column('author_name', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_maintenance_notes_request_id', 'maintenance_notes', ['maintenance_request_id'])


def downgrade() -> None:
    op.drop_index('ix_maintenance_notes_request_id', table_name='maintenance_notes')
    op.drop_table('maintenance_notes')
