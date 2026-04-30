"""renewal responded_via column

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'q2r3s4t5u6v7'
down_revision = ('p1q2r3s4t5u6', '30d1c9bc7c91')
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('lease_renewals', sa.Column('responded_via', sa.String(), nullable=True))

def downgrade():
    op.drop_column('lease_renewals', 'responded_via')
