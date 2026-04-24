"""Add applicant preferences, follow-up fields, and checklists table

Revision ID: l7m8n9o0p1q2
Revises: k6l7m8n9o0p1
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'l7m8n9o0p1q2'
down_revision = 'k6l7m8n9o0p1'
branch_labels = None
depends_on = None


def upgrade():
    # Applicant preferences & follow-up
    op.add_column('applicants', sa.Column('preferred_areas', sa.Text(), nullable=True))
    op.add_column('applicants', sa.Column('must_haves', sa.Text(), nullable=True))
    op.add_column('applicants', sa.Column('dislikes', sa.Text(), nullable=True))
    op.add_column('applicants', sa.Column('min_bedrooms', sa.Integer(), nullable=True))
    op.add_column('applicants', sa.Column('max_bedrooms', sa.Integer(), nullable=True))
    op.add_column('applicants', sa.Column('follow_up_date', sa.Date(), nullable=True))
    op.add_column('applicants', sa.Column('follow_up_note', sa.Text(), nullable=True))
    op.add_column('applicants', sa.Column('assigned_agent', sa.String(), nullable=True))

    # Checklists table
    op.create_table(
        'checklists',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('checklist_type', sa.String(), nullable=False),  # pre_showing | pre_move_in | inspection | custom
        sa.Column('property_id', sa.Integer(), sa.ForeignKey('properties.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'checklist_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('checklist_id', sa.Integer(), sa.ForeignKey('checklists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('checked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('checked_by', sa.String(), nullable=True),
    )


def downgrade():
    op.drop_table('checklist_items')
    op.drop_table('checklists')
    op.drop_column('applicants', 'assigned_agent')
    op.drop_column('applicants', 'follow_up_note')
    op.drop_column('applicants', 'follow_up_date')
    op.drop_column('applicants', 'max_bedrooms')
    op.drop_column('applicants', 'min_bedrooms')
    op.drop_column('applicants', 'dislikes')
    op.drop_column('applicants', 'must_haves')
    op.drop_column('applicants', 'preferred_areas')
