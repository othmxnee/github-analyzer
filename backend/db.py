"""Database plumbing (SQLAlchemy 2 + Alembic).

Persistence is optional. With no DATABASE_URL the website keeps results in
memory only, exactly as before, and the desktop / VS Code engine bridge never
touches a database (it has its own on-disk cache).

    DATABASE_URL=postgresql://user:pass@host/db    # Render / production
    DATABASE_URL=sqlite:////abs/path/analyzer.db   # local development
"""
import logging
import os
import threading

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Base(DeclarativeBase):
    pass


_lock = threading.Lock()
_engine = None
_Session = None
_url = None
_explicit = False   # configure() was called (tests) -> ignore the environment


def normalize_url(url):
    """Render gives postgres://... ; SQLAlchemy needs a driver (psycopg 3)."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def _env_url():
    return os.environ.get("DATABASE_URL") or None


def enabled():
    return bool(_url) if _explicit else bool(_env_url())


def configure(url=None, explicit=True):
    """(Re)bind to a database. configure(None) disables persistence."""
    global _engine, _Session, _url, _explicit
    with _lock:
        if _engine is not None:
            _engine.dispose()
        _engine = _Session = None
        _explicit = explicit
        _url = normalize_url(url) if url else None
        if not _url:
            return None
        kwargs = {"pool_pre_ping": True}
        if _url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        _engine = create_engine(_url, **kwargs)
        _Session = sessionmaker(bind=_engine, expire_on_commit=False)
        return _engine


def engine():
    if _engine is None and not _explicit and _env_url():
        configure(_env_url(), explicit=False)
    if _engine is None:
        raise RuntimeError("database not configured")
    return _engine


def session():
    engine()
    return _Session()


def upgrade():
    """Apply Alembic migrations up to head (safe with several processes on Postgres)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", os.path.join(BASE_DIR, "migrations"))
    eng = engine()
    with eng.begin() as conn:
        if eng.dialect.name == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(724117)"))   # one migrator at a time
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
    logger.info("database schema at head")


def init_from_env():
    """Called at web start-up: bind to DATABASE_URL (if any) and migrate."""
    if not _env_url():
        logger.info("DATABASE_URL not set: results are kept in memory only")
        return False
    configure(_env_url(), explicit=False)
    upgrade()
    return True
