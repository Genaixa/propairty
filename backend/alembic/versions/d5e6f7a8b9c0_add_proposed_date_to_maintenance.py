"""add_proposed_date_to_maintenance

Revision ID: d5e6f7a8b9c0
Revises: ccecb7798e8b
Create Date: 2026-04-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'ccecb7798e8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('maintenance_requests', sa.Column('proposed_date', sa.Date(), nullable=True))
    op.add_column('maintenance_requests', sa.Column('proposed_date_status', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('maintenance_requests', 'proposed_date_status')
    op.drop_column('maintenance_requests', 'proposed_date')
