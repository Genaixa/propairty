"""add_unit_occupancy

Revision ID: 5f56d63bc56b
Revises: ec115192c8a0
Create Date: 2026-03-29 04:34:10.228878

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f56d63bc56b'
down_revision: Union[str, Sequence[str], None] = 'ec115192c8a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('units', sa.Column('occupancy_type', sa.String(), nullable=True))
    op.add_column('units', sa.Column('max_occupants', sa.Integer(), nullable=True))
    op.add_column('units', sa.Column('occupancy_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('units', 'occupancy_notes')
    op.drop_column('units', 'max_occupants')
    op.drop_column('units', 'occupancy_type')
