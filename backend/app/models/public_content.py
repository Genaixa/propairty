"""Models for public-facing agency content: reviews, blog posts, valuation requests."""
import uuid
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base


class PublicReview(Base):
    __tablename__ = "public_reviews"
    id           = Column(Integer, primary_key=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    reviewer_name   = Column(String, nullable=False)
    reviewer_type   = Column(String, default="tenant")   # tenant | landlord
    rating          = Column(Integer, nullable=False)     # 1-5
    body            = Column(Text, nullable=False)
    property_name   = Column(String, nullable=True)
    approved        = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class BlogPost(Base):
    __tablename__ = "public_blog_posts"
    id           = Column(Integer, primary_key=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    title        = Column(String, nullable=False)
    slug         = Column(String, nullable=False)
    excerpt      = Column(Text, nullable=True)
    body         = Column(Text, nullable=True)           # HTML / markdown
    cover_url    = Column(String, nullable=True)
    category     = Column(String, nullable=True)         # market | tips | area | landlord | tenant
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


class ValuationRequest(Base):
    __tablename__ = "public_valuation_requests"
    id           = Column(Integer, primary_key=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    full_name    = Column(String, nullable=False)
    email        = Column(String, nullable=False)
    phone        = Column(String, nullable=True)
    address      = Column(String, nullable=False)
    property_type = Column(String, nullable=True)
    bedrooms     = Column(Integer, nullable=True)
    message      = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
