import sys
sys.path.insert(0, "/root/propairty/backend")

from app.database import SessionLocal, engine, Base
from app.models import Organisation, User, Property, Unit, Tenant, Lease, MaintenanceRequest
from app.auth import hash_password
from datetime import date

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Orgs
org1 = Organisation(name="Tyne Lettings Ltd", slug="tyne-lettings", email="info@tynelettings.co.uk", phone="0191 123 4567")
org2 = Organisation(name="Quayside Properties", slug="quayside-properties", email="hello@quaysideprop.co.uk")
db.add_all([org1, org2])
db.flush()

# Users
u1 = User(organisation_id=org1.id, email="admin@tynelettings.co.uk", full_name="Naphtoli Cohen", hashed_password=hash_password("demo1234"), role="admin")
u2 = User(organisation_id=org2.id, email="admin@quaysideprop.co.uk", full_name="Sarah Quayside", hashed_password=hash_password("demo1234"), role="admin")
db.add_all([u1, u2])
db.flush()

# Properties for org1
p1 = Property(organisation_id=org1.id, name="Park View Court", address_line1="14 Park View", city="Gateshead", postcode="NE8 1AB", property_type="residential")
p2 = Property(organisation_id=org1.id, name="Riverside House", address_line1="7 Riverside Walk", city="Newcastle", postcode="NE1 3QP", property_type="residential")
p3 = Property(organisation_id=org1.id, name="The Old Mill HMO", address_line1="32 Mill Lane", city="Gateshead", postcode="NE9 5TT", property_type="HMO")
db.add_all([p1, p2, p3])
db.flush()

# Units
units = [
    Unit(property_id=p1.id, name="Flat 1", bedrooms=2, bathrooms=1, monthly_rent=850, status="occupied"),
    Unit(property_id=p1.id, name="Flat 2", bedrooms=1, bathrooms=1, monthly_rent=650, status="occupied"),
    Unit(property_id=p1.id, name="Flat 3", bedrooms=2, bathrooms=1, monthly_rent=875, status="vacant"),
    Unit(property_id=p2.id, name="Ground Floor", bedrooms=3, bathrooms=2, monthly_rent=1200, status="occupied"),
    Unit(property_id=p2.id, name="First Floor", bedrooms=2, bathrooms=1, monthly_rent=950, status="occupied"),
    Unit(property_id=p3.id, name="Room 1", bedrooms=1, bathrooms=1, monthly_rent=450, status="occupied"),
    Unit(property_id=p3.id, name="Room 2", bedrooms=1, bathrooms=1, monthly_rent=450, status="occupied"),
    Unit(property_id=p3.id, name="Room 3", bedrooms=1, bathrooms=1, monthly_rent=450, status="vacant"),
]
db.add_all(units)
db.flush()

# Tenants
tenants = [
    Tenant(organisation_id=org1.id, full_name="James Thornton", email="j.thornton@gmail.com", phone="07911 123456", date_of_birth=date(1990, 4, 15)),
    Tenant(organisation_id=org1.id, full_name="Priya Sharma", email="priya.sharma@outlook.com", phone="07922 234567", date_of_birth=date(1988, 9, 22)),
    Tenant(organisation_id=org1.id, full_name="Daniel Walsh", email="d.walsh@yahoo.co.uk", phone="07933 345678"),
    Tenant(organisation_id=org1.id, full_name="Sophie Clarke", email="sophie.c@gmail.com", phone="07944 456789", date_of_birth=date(1995, 1, 7)),
    Tenant(organisation_id=org1.id, full_name="Mohammed Ali", email="m.ali@hotmail.com", phone="07955 567890"),
    Tenant(organisation_id=org1.id, full_name="Rebecca Hughes", email="rebeccah@gmail.com", phone="07966 678901"),
]
db.add_all(tenants)
db.flush()

# Leases
leases = [
    Lease(unit_id=units[0].id, tenant_id=tenants[0].id, start_date=date(2024, 3, 1), end_date=date(2025, 2, 28), monthly_rent=850, deposit=1700, status="active"),
    Lease(unit_id=units[1].id, tenant_id=tenants[1].id, start_date=date(2023, 9, 1), end_date=date(2025, 8, 31), monthly_rent=650, deposit=1300, status="active"),
    Lease(unit_id=units[3].id, tenant_id=tenants[2].id, start_date=date(2024, 1, 15), end_date=date(2025, 1, 14), monthly_rent=1200, deposit=2400, status="active"),
    Lease(unit_id=units[4].id, tenant_id=tenants[3].id, start_date=date(2024, 6, 1), monthly_rent=950, deposit=1900, status="active", is_periodic=True),
    Lease(unit_id=units[5].id, tenant_id=tenants[4].id, start_date=date(2024, 11, 1), end_date=date(2025, 10, 31), monthly_rent=450, deposit=900, status="active"),
    Lease(unit_id=units[6].id, tenant_id=tenants[5].id, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31), monthly_rent=450, deposit=900, status="active"),
]
db.add_all(leases)
db.flush()

# Maintenance
maintenance = [
    MaintenanceRequest(unit_id=units[0].id, title="Boiler not heating", description="Tenant reports no hot water since Monday", priority="high", status="in_progress", reported_by="James Thornton", assigned_to="NE Gas Services"),
    MaintenanceRequest(unit_id=units[3].id, title="Broken window latch", description="Kitchen window latch broken, won't lock", priority="medium", status="open", reported_by="Daniel Walsh"),
    MaintenanceRequest(unit_id=units[1].id, title="Damp patch in bedroom", description="Small damp patch on ceiling, appears after rain", priority="medium", status="open", reported_by="Priya Sharma"),
]
db.add_all(maintenance)
db.commit()

print("Seed complete.")
print(f"Login: admin@tynelettings.co.uk / demo1234")
db.close()
