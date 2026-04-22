"""add custom domain to orgs and tenant moveout checks

Revision ID: o0p1q2r3s4t5
Revises: n9o0p1q2r3s4
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'o0p1q2r3s4t5'
down_revision = 'n9o0p1q2r3s4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('organisations', sa.Column('custom_domain', sa.String(), nullable=True))
    op.create_index('ix_organisations_custom_domain', 'organisations', ['custom_domain'], unique=True)

    op.create_table(
        'tenant_moveout_checks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_index', sa.Integer(), nullable=False),
        sa.Column('checked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('tenant_id', 'item_index', name='uq_tenant_moveout_item'),
    )
    op.create_index('ix_tenant_moveout_checks_tenant', 'tenant_moveout_checks', ['tenant_id'])


def downgrade():
    op.drop_index('ix_tenant_moveout_checks_tenant', 'tenant_moveout_checks')
    op.drop_table('tenant_moveout_checks')
    op.drop_index('ix_organisations_custom_domain', 'organisations')
    op.drop_column('organisations', 'custom_domain')
