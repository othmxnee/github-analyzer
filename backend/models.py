"""Persistent records: one row per repository, one row per analysis run.

Headline numbers are real columns (cheap to sort, chart and compare across
repositories and over time). The full result, the roles result and the
cleaned dataframes are stored compressed, because they are only ever read
back whole.
"""
from datetime import datetime, timezone

from sqlalchemy import (Boolean, DateTime, Float, ForeignKey, Index, Integer, LargeBinary,
                        String, Text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


def utcnow():
    return datetime.now(timezone.utc)


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(20))
    full_name: Mapped[str | None] = mapped_column(String(300))
    # True when the repository needed a sign-in to clone: its results are
    # then only served to sessions that can read the repository themselves.
    private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_head_sha: Mapped[str | None] = mapped_column(String(64))

    runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="repository",
                                                     cascade="all, delete-orphan")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    __table_args__ = (Index("ix_runs_repo_started", "repository_id", "started_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"),
                                               nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")  # running|done|error
    trigger: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")  # manual|scheduled
    phase: Mapped[str | None] = mapped_column(String(32))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    head_sha: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)
    engine_version: Mapped[str | None] = mapped_column(String(16))

    health_score: Mapped[int | None] = mapped_column(Integer)
    risk_level: Mapped[str | None] = mapped_column(String(32))
    bus_factor: Mapped[int | None] = mapped_column(Integer)
    active_bus_factor: Mapped[int | None] = mapped_column(Integer)
    gini: Mapped[float | None] = mapped_column(Float)
    orphaned_pct: Mapped[float | None] = mapped_column(Float)
    total_commits: Mapped[int | None] = mapped_column(Integer)
    total_developers: Mapped[int | None] = mapped_column(Integer)
    total_files: Mapped[int | None] = mapped_column(Integer)

    result_gz: Mapped[bytes | None] = mapped_column(LargeBinary)
    skills_gz: Mapped[bytes | None] = mapped_column(LargeBinary)
    cleaned_gz: Mapped[bytes | None] = mapped_column(LargeBinary)

    repository: Mapped[Repository] = relationship(back_populates="runs")
