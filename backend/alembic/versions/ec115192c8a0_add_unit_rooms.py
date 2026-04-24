"""add_unit_rooms

Revision ID: ec115192c8a0
Revises: dc8e45a3e58c
Create Date: 2026-03-29 04:31:17.254337

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec115192c8a0'
down_revision: Union[str, Sequence[str], None] = 'dc8e45a3e58c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('units', sa.Column('rooms', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('units', 'rooms')
