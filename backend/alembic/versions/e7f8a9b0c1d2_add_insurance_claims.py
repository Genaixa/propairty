"""add_insurance_claims

Revision ID: e7f8a9b0c1d2
Revises: 52607dda4def
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = '52607dda4def'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'insurance_claims',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('property_id', sa.Integer(), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('units.id'), nullable=True),
        sa.Column('claim_reference', sa.String(), nullable=True),
        sa.Column('claim_type', sa.String(), nullable=False),
        sa.Column('incident_date', sa.String(), nullable=False),
        sa.Column('incident_description', sa.Text(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('damage_description', sa.Text(), nullable=True),
        sa.Column('estimated_claim_min', sa.Integer(), nullable=True),
        sa.Column('estimated_claim_max', sa.Integer(), nullable=True),
        sa.Column('timeline', sa.JSON(), nullable=True),
        sa.Column('next_steps', sa.JSON(), nullable=True),
        sa.Column('supporting_documents_checklist', sa.JSON(), nullable=True),
        sa.Column('pdf_filename', sa.String(), nullable=True),
        sa.Column('status', sa.String(), server_default='draft'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_insurance_claims_org', 'insurance_claims', ['organisation_id'])
    op.create_index('ix_insurance_claims_property', 'insurance_claims', ['property_id'])


def downgrade() -> None:
    op.drop_index('ix_insurance_claims_property', table_name='insurance_claims')
    op.drop_index('ix_insurance_claims_org', table_name='insurance_claims')
    op.drop_table('insurance_claims')
