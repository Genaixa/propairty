"""add_maintenance_payments

Revision ID: 2083b17945ef
Revises: p1q2r3s4t5u6
Create Date: 2026-04-26 11:06:20.433966

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2083b17945ef'
down_revision: Union[str, Sequence[str], None] = 'p1q2r3s4t5u6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'maintenance_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('maintenance_request_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('paid_date', sa.Date(), nullable=False),
        sa.Column('ref', sa.String(), nullable=True),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('recorded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['maintenance_request_id'], ['maintenance_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_maintenance_payments_job', 'maintenance_payments', ['maintenance_request_id'])


def downgrade() -> None:
    op.drop_index('ix_maintenance_payments_job', table_name='maintenance_payments')
    op.drop_table('maintenance_payments')
