"""github app: credentials, installations, repository link

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-05
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "github_app",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("app_id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("html_url", sa.String(length=500), nullable=False),
        sa.Column("private_key", sa.Text(), nullable=False),
        sa.Column("webhook_secret", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "installations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("installation_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("account_login", sa.String(length=200), nullable=False),
        sa.Column("account_type", sa.String(length=20)),
        sa.Column("owner_login", sa.String(length=200)),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_installations_owner_login", "installations", ["owner_login"])
    with op.batch_alter_table("repositories") as b:
        b.add_column(sa.Column("installation_id", sa.BigInteger()))


def downgrade():
    with op.batch_alter_table("repositories") as b:
        b.drop_column("installation_id")
    op.drop_index("ix_installations_owner_login", table_name="installations")
    op.drop_table("installations")
    op.drop_table("github_app")
