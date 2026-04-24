"""add_org_reminder_settings

Revision ID: 63cc4351ea10
Revises: d0219d233a3b
Create Date: 2026-03-28 23:20:41.874099

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63cc4351ea10'
down_revision: Union[str, Sequence[str], None] = 'd0219d233a3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organisations', sa.Column('reminder_channels', sa.Text(), nullable=True))
    op.add_column('organisations', sa.Column('reminder_days', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('organisations', 'reminder_days')
    op.drop_column('organisations', 'reminder_channels')
