from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Billing
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status = Column(String, default="trialing")  # trialing, active, past_due, canceled
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)

    # Email triage inbound
    inbound_email_token = Column(String, nullable=True, unique=True)  # unique token for forwarding address
    gmail_access_token  = Column(Text, nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    gmail_email         = Column(String, nullable=True)
    outlook_access_token  = Column(Text, nullable=True)
    outlook_refresh_token = Column(Text, nullable=True)
    outlook_email         = Column(String, nullable=True)

    # Reminder preferences (JSON-encoded)
    # reminder_channels: e.g. '["email","whatsapp","sms","portal"]'
    # reminder_days: e.g. '[3,1,0,-1,-3,-7]'  positive=before due, negative=overdue
    reminder_channels = Column(Text, nullable=True)
    reminder_days = Column(Text, nullable=True)

    # Custom domain (e.g. lettings.smithproperty.co.uk)
    custom_domain = Column(String, nullable=True, unique=True)

    # Public website branding
    logo_url = Column(String, nullable=True)
    brand_color = Column(String, nullable=True)
    tagline = Column(String, nullable=True)
    address_text = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    # Extended public profile
    about_text = Column(Text, nullable=True)
    founded_year = Column(Integer, nullable=True)
    team_json = Column(Text, nullable=True)           # JSON [{name,role,photo_url,bio}]
    opening_hours_json = Column(Text, nullable=True)  # JSON [{day,hours}]
    areas_json = Column(Text, nullable=True)          # JSON [area strings]
    social_facebook = Column(String, nullable=True)
    social_instagram = Column(String, nullable=True)
    social_twitter = Column(String, nullable=True)

    users = relationship("User", back_populates="organisation")
    properties = relationship("Property", back_populates="organisation")
    landlords = relationship("Landlord", back_populates="organisation")
