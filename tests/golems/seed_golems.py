#!/usr/bin/env python3
"""
Seed test golem users into the PropAIrty database.
Run once:  python seed_golems.py
Safe to re-run — skips existing golems.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

os.environ.setdefault("ENV_FILE", "/root/propairty/backend/.env.production")

from app.database import SessionLocal
from app.auth import hash_password
from app.models.user import User
from app.models.tenant import Tenant
from app.models.landlord import Landlord
from app.models.contractor import Contractor
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from datetime import date

GOLEM_PASSWORD = "Golem_Test_2024!"

db = SessionLocal()

def upsert_agent():
    existing = db.query(User).filter(User.email == "agentgoilem@propairty.co.uk").first()
    if existing:
        print("  [skip] agentgoilem already exists")
        return existing
    # Use org 1 (Tyne Lettings)
    u = User(
        email="agentgoilem@propairty.co.uk",
        full_name="Agent Goilem",
        hashed_password=hash_password(GOLEM_PASSWORD),
        organisation_id=1,
        role="agent",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    print(f"  [created] agentgoilem id={u.id}")
    return u

def upsert_tenant():
    existing = db.query(Tenant).filter(Tenant.email == "tenantgoilem@propairty.co.uk").first()
    if existing:
        print("  [skip] tenantgoilem already exists")
        # Ensure portal enabled
        if not existing.portal_enabled:
            existing.portal_enabled = True
            db.commit()
        return existing
    t = Tenant(
        email="tenantgoilem@propairty.co.uk",
        full_name="Tenant Goilem",
        phone="07700000001",
        hashed_password=hash_password(GOLEM_PASSWORD),
        portal_enabled=True,
        organisation_id=1,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    # Assign to a vacant unit or create a dummy lease on unit 3 (if exists)
    unit = db.query(Unit).filter(
        Unit.property_id.in_(
            db.query(Property.id).filter(Property.organisation_id == 1)
        )
    ).first()
    if unit:
        lease = Lease(
            unit_id=unit.id,
            tenant_id=t.id,
            start_date=date(2025, 1, 1),
            end_date=date(2026, 12, 31),
            monthly_rent=1000.0,
            deposit=2000.0,
            status="active",
        )
        db.add(lease)
        db.commit()
        print(f"  [created] tenantgoilem id={t.id} with lease on unit {unit.id}")
    else:
        print(f"  [created] tenantgoilem id={t.id} (no unit found)")
    return t

def upsert_landlord():
    existing = db.query(Landlord).filter(Landlord.email == "landlordgoilem@propairty.co.uk").first()
    if existing:
        print("  [skip] landlordgoilem already exists")
        if not existing.portal_enabled:
            existing.portal_enabled = True
            db.commit()
        return existing
    prop = db.query(Property).filter(Property.organisation_id == 1).first()
    l = Landlord(
        email="landlordgoilem@propairty.co.uk",
        full_name="Landlord Goilem",
        phone="07700000002",
        hashed_password=hash_password(GOLEM_PASSWORD),
        portal_enabled=True,
        organisation_id=1,
    )
    db.add(l)
    db.commit()
    db.refresh(l)
    # Link to first property in org so agent can look them up via /api/landlords
    prop = db.query(Property).filter(Property.organisation_id == 1).first()
    if prop and not prop.landlord_id:
        prop.landlord_id = l.id
        db.commit()
    print(f"  [created] landlordgoilem id={l.id}")
    return l

def upsert_contractor():
    existing = db.query(Contractor).filter(Contractor.email == "contractorgoilem@propairty.co.uk").first()
    if existing:
        print("  [skip] contractorgoilem already exists")
        if not existing.portal_enabled:
            existing.portal_enabled = True
            db.commit()
        return existing
    c = Contractor(
        email="contractorgoilem@propairty.co.uk",
        full_name="Contractor Goilem",
        company_name="Goilem Trades Ltd",
        phone="07700000003",
        hashed_password=hash_password(GOLEM_PASSWORD),
        portal_enabled=True,
        trade="General",
        organisation_id=1,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    print(f"  [created] contractorgoilem id={c.id}")
    return c


print("Seeding golem test users...")
agent = upsert_agent()
tenant = upsert_tenant()
landlord = upsert_landlord()
contractor = upsert_contractor()
db.close()

print(f"""
Done! Golem credentials:
  Agent:      agentgoilem@propairty.co.uk   / {GOLEM_PASSWORD}
  Tenant:     tenantgoilem@propairty.co.uk  / {GOLEM_PASSWORD}
  Landlord:   landlordgoilem@propairty.co.uk / {GOLEM_PASSWORD}
  Contractor: contractorgoilem@propairty.co.uk / {GOLEM_PASSWORD}
""")
