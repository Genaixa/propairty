"""add feature flags

Revision ID: n9o0p1q2r3s4
Revises: m8n9o0p1q2r3
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = 'n9o0p1q2r3s4'
down_revision = 'm8n9o0p1q2r3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'org_feature_flags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organisation_id', sa.Integer(), nullable=False),
        sa.Column('flag_key', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organisation_id', 'flag_key', name='uq_org_flag'),
    )
    op.create_index('ix_org_feature_flags_org', 'org_feature_flags', ['organisation_id'])


def downgrade():
    op.drop_index('ix_org_feature_flags_org', table_name='org_feature_flags')
    op.drop_table('org_feature_flags')
