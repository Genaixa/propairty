"""Add telegram_inventory_sessions table and inventory.status column

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'g2h3i4j5k6l7'
down_revision = ('f1a2b3c4d5e6', 'e7f8a9b0c1d2')
branch_labels = None
depends_on = None


def upgrade():
    # Add status column to inventories (existing rows become 'confirmed')
    op.add_column(
        'inventories',
        sa.Column('status', sa.String(), nullable=True, server_default='confirmed'),
    )
    op.execute("UPDATE inventories SET status = 'confirmed' WHERE status IS NULL")

    # Create telegram_inventory_sessions table
    op.create_table(
        'telegram_inventory_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('chat_id', sa.String(), nullable=False),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organisations.id'), nullable=False),
        sa.Column('lease_id', sa.Integer(), sa.ForeignKey('leases.id'), nullable=True),
        sa.Column('inv_type', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=False, server_default='awaiting_lease'),
        sa.Column('current_room_index', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('room_plan', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('rooms_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('conducted_by', sa.String(), nullable=True),
        sa.Column('meter_electric', sa.String(), nullable=True),
        sa.Column('meter_gas', sa.String(), nullable=True),
        sa.Column('meter_water', sa.String(), nullable=True),
        sa.Column('keys_handed', sa.String(), nullable=True),
        sa.Column('draft_inventory_id', sa.Integer(), sa.ForeignKey('inventories.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_telegram_inventory_sessions_chat_id', 'telegram_inventory_sessions', ['chat_id'])


def downgrade():
    op.drop_index('ix_telegram_inventory_sessions_chat_id', 'telegram_inventory_sessions')
    op.drop_table('telegram_inventory_sessions')
    op.drop_column('inventories', 'status')
