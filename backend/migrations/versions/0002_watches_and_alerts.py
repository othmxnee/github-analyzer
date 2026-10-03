"""watches and alerts

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-03
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "watches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repository_id", sa.Integer(),
                  sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("login", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320)),
        sa.Column("email_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("slack_webhook_url", sa.String(length=500)),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_notified_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_watches_repository_id", "watches", ["repository_id"])
    op.create_index("ix_watches_owner", "watches", ["provider", "login"])
    op.create_index("ix_watches_token_hash", "watches", ["token_hash"], unique=True)
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repository_id", sa.Integer(),
                  sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", sa.Integer(),
                  sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=8), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_alerts_repo_created", "alerts", ["repository_id", "created_at"])


def downgrade():
    op.drop_index("ix_alerts_repo_created", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_watches_token_hash", table_name="watches")
    op.drop_index("ix_watches_owner", table_name="watches")
    op.drop_index("ix_watches_repository_id", table_name="watches")
    op.drop_table("watches")
