"""add public_users and saved_properties tables

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-04-14 09:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'j5k6l7m8n9o0'
down_revision = 'i4j5k6l7m8n9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'public_users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('organisation_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('email', sa.String(), nullable=False, index=True),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('organisation_id', 'email', name='uq_public_user_org_email'),
    )
    op.create_table(
        'saved_properties',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('public_user_id', sa.Integer(), sa.ForeignKey('public_users.id'), nullable=False),
        sa.Column('property_id', sa.Integer(), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('public_user_id', 'property_id', name='uq_saved_property'),
    )


def downgrade():
    op.drop_table('saved_properties')
    op.drop_table('public_users')
