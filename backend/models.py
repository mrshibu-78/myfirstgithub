from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    plan = Column(String(40), default="free")
    created_at = Column(DateTime, default=datetime.utcnow)


class RenderJob(Base):
    __tablename__ = "render_jobs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    filename = Column(String(255), nullable=False)
    status = Column(String(40), default="completed")
    consent_confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
