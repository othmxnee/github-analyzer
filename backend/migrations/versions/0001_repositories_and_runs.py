"""repositories and analysis runs

Revision ID: 0001
Revises:
Create Date: 2026-10-03
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "repositories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("url", sa.String(length=500), nullable=False, unique=True),
        sa.Column("provider", sa.String(length=20)),
        sa.Column("full_name", sa.String(length=300)),
        sa.Column("private", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_analyzed_at", sa.DateTime(timezone=True)),
        sa.Column("last_head_sha", sa.String(length=64)),
    )
    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repository_id", sa.Integer(),
                  sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("trigger", sa.String(length=16), nullable=False),
        sa.Column("phase", sa.String(length=32)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("head_sha", sa.String(length=64)),
        sa.Column("error", sa.Text()),
        sa.Column("engine_version", sa.String(length=16)),
        sa.Column("health_score", sa.Integer()),
        sa.Column("risk_level", sa.String(length=32)),
        sa.Column("bus_factor", sa.Integer()),
        sa.Column("active_bus_factor", sa.Integer()),
        sa.Column("gini", sa.Float()),
        sa.Column("orphaned_pct", sa.Float()),
        sa.Column("total_commits", sa.Integer()),
        sa.Column("total_developers", sa.Integer()),
        sa.Column("total_files", sa.Integer()),
        sa.Column("result_gz", sa.LargeBinary()),
        sa.Column("skills_gz", sa.LargeBinary()),
        sa.Column("cleaned_gz", sa.LargeBinary()),
    )
    op.create_index("ix_analysis_runs_repository_id", "analysis_runs", ["repository_id"])
    op.create_index("ix_runs_repo_started", "analysis_runs", ["repository_id", "started_at"])


def downgrade():
    op.drop_index("ix_runs_repo_started", table_name="analysis_runs")
    op.drop_index("ix_analysis_runs_repository_id", table_name="analysis_runs")
    op.drop_table("analysis_runs")
    op.drop_table("repositories")
