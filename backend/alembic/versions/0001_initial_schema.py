"""Create the initial ARIS schema.

Revision ID: 0001_initial_schema
Revises:
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    op.create_table(
        "research_papers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("doi", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("authors", sa.String(length=1000), nullable=True),
        sa.Column("abstract", sa.String(), nullable=True),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column("publication_year", sa.Integer(), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("doi"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index("ix_research_papers_id", "research_papers", ["id"], unique=False)

    op.create_table(
        "saved_papers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("paper_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["paper_id"], ["research_papers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "paper_id", name="uq_saved_papers_user_paper"),
    )
    op.create_index("ix_saved_papers_id", "saved_papers", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_papers_id", table_name="saved_papers")
    op.drop_table("saved_papers")
    op.drop_index("ix_research_papers_id", table_name="research_papers")
    op.drop_table("research_papers")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")