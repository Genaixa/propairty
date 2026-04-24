"""add_tenant_messages_table

Revision ID: ccecb7798e8b
Revises: a4d32ac059ad
Create Date: 2026-04-10 07:22:55.581073

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ccecb7798e8b'
down_revision: Union[str, Sequence[str], None] = 'a4d32ac059ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tenant_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('sender_type', sa.String(), nullable=False),
        sa.Column('sender_name', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tenant_messages_id'), 'tenant_messages', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tenant_messages_id'), table_name='tenant_messages')
    op.drop_table('tenant_messages')
