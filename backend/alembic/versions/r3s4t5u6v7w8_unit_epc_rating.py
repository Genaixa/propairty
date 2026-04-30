"""unit epc rating and roadmap unit columns

Revision ID: r3s4t5u6v7w8
Revises: q2r3s4t5u6v7
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'r3s4t5u6v7w8'
down_revision = 'q2r3s4t5u6v7'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('units', sa.Column('epc_rating', sa.String(1), nullable=True))
    op.add_column('units', sa.Column('epc_potential', sa.String(1), nullable=True))
    op.add_column('property_epc_roadmaps', sa.Column('unit_id', sa.Integer(), sa.ForeignKey('units.id'), nullable=True))
    op.add_column('property_epc_roadmaps', sa.Column('unit_name', sa.String(), nullable=True))

def downgrade():
    op.drop_column('units', 'epc_rating')
    op.drop_column('units', 'epc_potential')
    op.drop_column('property_epc_roadmaps', 'unit_id')
    op.drop_column('property_epc_roadmaps', 'unit_name')
