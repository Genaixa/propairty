"""add view tracking across portals

Revision ID: a9b8c7d6e5f4
Revises: f1a2b3c4d5e6
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'a9b8c7d6e5f4'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None

def upgrade():
    # Contractor: when did contractor first open this job
    op.add_column('maintenance_requests', sa.Column('contractor_viewed_at', sa.DateTime(timezone=True), nullable=True))
    # Landlord: when did landlord first view this renewal offer
    op.add_column('lease_renewals', sa.Column('landlord_viewed_at', sa.DateTime(timezone=True), nullable=True))
    # Portal messages: exact timestamp agent message was read by landlord
    op.add_column('portal_messages', sa.Column('read_at', sa.DateTime(timezone=True), nullable=True))
    # Landlord report downloads
    op.create_table(
        'landlord_report_views',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('landlord_id', sa.Integer(), sa.ForeignKey('landlords.id'), nullable=False),
        sa.Column('report_month', sa.String(), nullable=False),
        sa.Column('viewed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_column('maintenance_requests', 'contractor_viewed_at')
    op.drop_column('lease_renewals', 'landlord_viewed_at')
    op.drop_column('portal_messages', 'read_at')
    op.drop_table('landlord_report_views')
