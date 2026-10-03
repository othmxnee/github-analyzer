"""Alembic environment. Run via db.upgrade() (the app does it at start-up), or:

    cd backend && DATABASE_URL=... python -c "import db; db.init_from_env()"
"""
import os
import sys

from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models  # noqa: E402,F401  (registers tables on Base.metadata)
from db import Base  # noqa: E402

target_metadata = Base.metadata
connection = context.config.attributes.get("connection")
if connection is None:
    raise RuntimeError("Run migrations through db.upgrade(), which provides a connection.")

context.configure(connection=connection, target_metadata=target_metadata,
                  render_as_batch=connection.dialect.name == "sqlite")
with context.begin_transaction():
    context.run_migrations()
