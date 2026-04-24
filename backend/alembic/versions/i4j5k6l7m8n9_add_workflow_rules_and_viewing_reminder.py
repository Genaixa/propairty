"""add workflow_rules and applicant viewing_reminder_sent

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'i4j5k6l7m8n9'
down_revision = ('h3i4j5k6l7m8', 'd5e6f7a8b9c0')
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'workflow_rules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('trigger', sa.String(), nullable=False),
        sa.Column('trigger_days', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('action', sa.String(), nullable=False, server_default='telegram_agent'),
        sa.Column('is_active', sa.Boolean(), server_default='TRUE'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column('applicants', sa.Column('viewing_reminder_sent', sa.Boolean(), server_default='FALSE'))


def downgrade():
    op.drop_table('workflow_rules')
    op.drop_column('applicants', 'viewing_reminder_sent')
