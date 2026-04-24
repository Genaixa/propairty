"""Add current_room_db_id to telegram_inventory_sessions

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-04-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'h3i4j5k6l7m8'
down_revision = 'g2h3i4j5k6l7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'telegram_inventory_sessions',
        sa.Column('current_room_db_id', sa.Integer(),
                  sa.ForeignKey('inventory_rooms.id'), nullable=True),
    )


def downgrade():
    op.drop_column('telegram_inventory_sessions', 'current_room_db_id')
