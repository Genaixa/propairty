"""compliance_cert_unit_id

Revision ID: 30d1c9bc7c91
Revises: 14cc1623fa84
Create Date: 2026-04-29 11:11:15.203808

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '30d1c9bc7c91'
down_revision: Union[str, Sequence[str], None] = '14cc1623fa84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('compliance_certificates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('unit_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_compliance_cert_unit', 'units', ['unit_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('compliance_certificates', schema=None) as batch_op:
        batch_op.drop_constraint('fk_compliance_cert_unit', type_='foreignkey')
        batch_op.drop_column('unit_id')
