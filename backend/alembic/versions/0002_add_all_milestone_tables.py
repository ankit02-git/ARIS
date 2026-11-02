"""Add all post-initial tables: documents, collections, conversations, embeddings,
reports, saved_searches, paper_tags.

Revision ID: 0002_add_all_milestone_tables
Revises: 0001_initial_schema
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_add_all_milestone_tables"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # uploaded_documents                                                   #
    # ------------------------------------------------------------------ #
    op.create_table(
        "uploaded_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("paper_id", sa.Integer(), nullable=True),
        sa.Column("extracted_title", sa.String(length=500), nullable=True),
        sa.Column("extracted_authors", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["paper_id"], ["research_papers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_uploaded_documents_id", "uploaded_documents", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # collections                                                          #
    # ------------------------------------------------------------------ #
    op.create_table(
        "collections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_collections_id", "collections", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # collection_papers                                                    #
    # ------------------------------------------------------------------ #
    op.create_table(
        "collection_papers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.Column("paper_id", sa.Integer(), nullable=False),
        sa.Column("added_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["paper_id"], ["research_papers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("collection_id", "paper_id", name="uq_collection_papers"),
    )
    op.create_index("ix_collection_papers_id", "collection_papers", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # ai_conversations                                                     #
    # ------------------------------------------------------------------ #
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False, server_default="New conversation"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_conversations_id", "ai_conversations", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # ai_messages                                                          #
    # ------------------------------------------------------------------ #
    op.create_table(
        "ai_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["ai_conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_messages_id", "ai_messages", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # paper_embeddings                                                     #
    # ------------------------------------------------------------------ #
    op.create_table(
        "paper_embeddings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("paper_id", sa.Integer(), nullable=False),
        sa.Column("model_name", sa.String(length=200), nullable=False),
        sa.Column("vector_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("vector_dim", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["paper_id"], ["research_papers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("paper_id", name="uq_paper_embeddings_paper_id"),
    )
    op.create_index("ix_paper_embeddings_id", "paper_embeddings", ["id"], unique=False)
    op.create_index("ix_paper_embeddings_paper_id", "paper_embeddings", ["paper_id"], unique=True)

    # ------------------------------------------------------------------ #
    # document_chunks                                                      #
    # ------------------------------------------------------------------ #
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("paper_id", sa.Integer(), nullable=True),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("section_heading", sa.String(length=300), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="abstract"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["uploaded_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["paper_id"], ["research_papers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_chunks_id", "document_chunks", ["id"], unique=False)
    op.create_index("ix_document_chunks_paper_id", "document_chunks", ["paper_id"], unique=False)
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"], unique=False)

    # ------------------------------------------------------------------ #
    # reports                                                              #
    # ------------------------------------------------------------------ #
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("report_type", sa.String(length=100), nullable=False),
        sa.Column("format", sa.String(length=20), nullable=False, server_default="pdf"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("file_path", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_id", "reports", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # saved_searches                                                       #
    # ------------------------------------------------------------------ #
    op.create_table(
        "saved_searches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("query", sa.String(length=500), nullable=False),
        sa.Column("mode", sa.String(length=50), nullable=False, server_default="hybrid"),
        sa.Column("result_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_searches_id", "saved_searches", ["id"], unique=False)

    # ------------------------------------------------------------------ #
    # paper_tags                                                           #
    # ------------------------------------------------------------------ #
    op.create_table(
        "paper_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("paper_id", sa.Integer(), nullable=False),
        sa.Column("tag", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["paper_id"], ["research_papers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "paper_id", "tag", name="uq_paper_tags_user_paper_tag"),
    )
    op.create_index("ix_paper_tags_id", "paper_tags", ["id"], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index("ix_paper_tags_id", table_name="paper_tags")
    op.drop_table("paper_tags")

    op.drop_index("ix_saved_searches_id", table_name="saved_searches")
    op.drop_table("saved_searches")

    op.drop_index("ix_reports_id", table_name="reports")
    op.drop_table("reports")

    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_paper_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_id", table_name="document_chunks")
    op.drop_table("document_chunks")

    op.drop_index("ix_paper_embeddings_paper_id", table_name="paper_embeddings")
    op.drop_index("ix_paper_embeddings_id", table_name="paper_embeddings")
    op.drop_table("paper_embeddings")

    op.drop_index("ix_ai_messages_id", table_name="ai_messages")
    op.drop_table("ai_messages")

    op.drop_index("ix_ai_conversations_id", table_name="ai_conversations")
    op.drop_table("ai_conversations")

    op.drop_index("ix_collection_papers_id", table_name="collection_papers")
    op.drop_table("collection_papers")

    op.drop_index("ix_collections_id", table_name="collections")
    op.drop_table("collections")

    op.drop_index("ix_uploaded_documents_id", table_name="uploaded_documents")
    op.drop_table("uploaded_documents")
