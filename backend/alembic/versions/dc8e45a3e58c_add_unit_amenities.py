"""add_unit_amenities

Revision ID: dc8e45a3e58c
Revises: 1283c3c7fc54
Create Date: 2026-03-29 04:26:37.662665

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc8e45a3e58c'
down_revision: Union[str, Sequence[str], None] = '1283c3c7fc54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('units', sa.Column('amenities', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('units', 'amenities')
