"""add google_id and avatar_url to users, make password_hash nullable

Revision ID: 0003_add_google_oauth
Revises: 0002_add_all_milestone_tables
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_add_google_oauth"
down_revision = "0002_add_all_milestone_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make password_hash nullable (Google users have no password)
    op.alter_column("users", "password_hash", nullable=True)
    # Add google_id column
    op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])
    op.create_index("ix_users_google_id", "users", ["google_id"])
    # Add avatar_url column
    op.add_column("users", sa.Column("avatar_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_index("ix_users_google_id", "users")
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_column("users", "google_id")
    op.drop_column("users", "avatar_url")
    op.alter_column("users", "password_hash", nullable=False)
