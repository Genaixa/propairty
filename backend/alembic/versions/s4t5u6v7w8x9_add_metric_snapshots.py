"""add metric_snapshots table

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-04-30

"""
from alembic import op
import sqlalchemy as sa

revision = 's4t5u6v7w8x9'
down_revision = 'r3s4t5u6v7w8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'metric_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organisation_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organisation_id', 'date', name='uq_metric_snapshot_org_date'),
    )
    op.create_index('ix_metric_snapshots_org_id', 'metric_snapshots', ['organisation_id'])


def downgrade():
    op.drop_index('ix_metric_snapshots_org_id', table_name='metric_snapshots')
    op.drop_table('metric_snapshots')
