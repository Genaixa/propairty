"""add_contractor_reviews

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-29 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'contractor_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contractor_id', sa.Integer(), sa.ForeignKey('contractors.id'), nullable=False),
        sa.Column('maintenance_request_id', sa.Integer(), sa.ForeignKey('maintenance_requests.id'), nullable=True),
        sa.Column('reviewer_type', sa.String(), nullable=False),
        sa.Column('reviewer_name', sa.String(), nullable=False),
        sa.Column('stars', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_contractor_reviews_contractor_id', 'contractor_reviews', ['contractor_id'])


def downgrade() -> None:
    op.drop_index('ix_contractor_reviews_contractor_id', table_name='contractor_reviews')
    op.drop_table('contractor_reviews')
