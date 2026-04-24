"""merge_heads

Revision ID: 40e649c57b4c
Revises: 8aa4c1a0e17f, a9b8c7d6e5f4
Create Date: 2026-04-01 06:05:48.423649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40e649c57b4c'
down_revision: Union[str, Sequence[str], None] = ('8aa4c1a0e17f', 'a9b8c7d6e5f4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
