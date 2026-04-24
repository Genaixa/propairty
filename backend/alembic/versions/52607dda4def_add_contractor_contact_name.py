"""add_contractor_contact_name

Revision ID: 52607dda4def
Revises: 74aa7f788227
Create Date: 2026-04-04 20:22:26.133232

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '52607dda4def'
down_revision: Union[str, Sequence[str], None] = '74aa7f788227'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contractors', sa.Column('contact_name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('contractors', 'contact_name')
