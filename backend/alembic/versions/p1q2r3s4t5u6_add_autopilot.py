"""add autopilot config and log tables

Revision ID: p1q2r3s4t5u6
Revises: o0p1q2r3s4t5
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'p1q2r3s4t5u6'
down_revision = 'o0p1q2r3s4t5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'autopilot_config',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False, unique=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('checks', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_table(
        'autopilot_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('check_type', sa.String(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('recipient_label', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('message_sent', sa.Text(), nullable=True),
        sa.Column('dedup_key', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_autopilot_log_org', 'autopilot_log', ['organisation_id'])
    op.create_index('ix_autopilot_log_dedup', 'autopilot_log', ['dedup_key', 'created_at'])


def downgrade():
    op.drop_table('autopilot_log')
    op.drop_table('autopilot_config')
