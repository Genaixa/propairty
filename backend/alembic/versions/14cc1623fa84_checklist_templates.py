"""checklist_templates

Revision ID: 14cc1623fa84
Revises: 2083b17945ef
Create Date: 2026-04-29 09:52:00.218467

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '14cc1623fa84'
down_revision: Union[str, Sequence[str], None] = '2083b17945ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('checklists', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('unit_name', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('tenant_name', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('checklists', schema=None) as batch_op:
        batch_op.drop_column('tenant_name')
        batch_op.drop_column('unit_name')
        batch_op.drop_column('is_template')
