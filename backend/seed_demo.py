"""
Comprehensive demo seed — fills all tables with realistic data for Tyne Lettings (org_id=1).
Safe to re-run: checks before inserting.
"""
from datetime import date, datetime, timezone, timedelta
import random, secrets as _secrets
from app.database import SessionLocal
from app.auth import hash_password
from app.models import *
from app.models.survey import MaintenanceSurvey
from app.models.ppm import PPMSchedule
from app.models.inventory import Inventory, InventoryRoom, InventoryItem
from app.models.payment import RentPayment
from app.models.deposit import TenancyDeposit

db = SessionLocal()
ORG = 1
NOW = datetime.now(timezone.utc)
TODAY = date.today()

def ago(days): return NOW - timedelta(days=days)
def dago(days): return TODAY - timedelta(days=days)
def dfwd(days): return TODAY + timedelta(days=days)

# ── Landlord portal password ──────────────────────────────────────────────────
landlord = db.query(Landlord).filter_by(organisation_id=ORG).first()
if landlord:
    landlord.hashed_password = hash_password("demo1234")
    landlord.phone = landlord.phone or "07700 900123"

# ── Contractors ───────────────────────────────────────────────────────────────
if db.query(Contractor).filter_by(organisation_id=ORG).count() == 0:
    for cd in [
        dict(organisation_id=ORG, full_name="NE Gas Services", company_name="NE Gas Services Ltd",
             trade="Gas Engineer", email="info@negasservices.co.uk", phone="0191 555 0101",
             hashed_password=hash_password("demo1234"), portal_enabled=True,
             notes="GasSafe registered. 24hr emergency callout available."),
        dict(organisation_id=ORG, full_name="Spark Electric", company_name="Spark Electric Ltd",
             trade="Electrician", email="jobs@sparkelectric.co.uk", phone="0191 555 0202",
             hashed_password=hash_password("demo1234"), portal_enabled=True,
             notes="NICEIC approved. Fast response times."),
        dict(organisation_id=ORG, full_name="Tyne Plumbing Co.", company_name="Tyne Plumbing Co.",
             trade="Plumber", email="tyneplumbing@gmail.com", phone="07911 555033"),
        dict(organisation_id=ORG, full_name="ClearView Windows", company_name="ClearView Windows",
             trade="Glazier", email="clearview@outlook.com", phone="07922 555044"),
        dict(organisation_id=ORG, full_name="North Locks", company_name="North Locks",
             trade="Locksmith", email="northlocks@gmail.com", phone="07933 555055"),
    ]:
        db.add(Contractor(**cd))
    db.flush()
    print("✅ Contractors added")

contractors = db.query(Contractor).filter_by(organisation_id=ORG).all()
gas_co  = next((c for c in contractors if "Gas"   in c.full_name), contractors[0])
elec_co = next((c for c in contractors if "Spark" in c.full_name), contractors[0])
plumb_co= next((c for c in contractors if "Plumb" in c.full_name), contractors[0])

# ── Maintenance requests ──────────────────────────────────────────────────────
if db.query(MaintenanceRequest).filter_by(organisation_id=ORG).count() == 0:
    for j in [
        dict(organisation_id=ORG, unit_id=1, title="Boiler not heating",
             description="Tenant reports no hot water since Monday morning. Boiler showing F22 fault code.",
             priority="high", status="completed", reported_by="James Thornton",
             assigned_to=gas_co.full_name, contractor_id=gas_co.id,
             reported_by_tenant_id=1, created_at=ago(30), completed_at=ago(27)),
        dict(organisation_id=ORG, unit_id=2, title="Kitchen tap dripping",
             description="Cold tap in kitchen dripping constantly. Been like this for 2 weeks.",
             priority="medium", status="completed", reported_by="Priya Sharma",
             assigned_to=plumb_co.full_name, contractor_id=plumb_co.id,
             reported_by_tenant_id=2, created_at=ago(45), completed_at=ago(40)),
        dict(organisation_id=ORG, unit_id=4, title="Bathroom extractor fan broken",
             description="Fan making loud noise then stopped working. Condensation building up.",
             priority="medium", status="in_progress", reported_by="Daniel Walsh",
             assigned_to=elec_co.full_name, contractor_id=elec_co.id,
             reported_by_tenant_id=3, created_at=ago(7)),
        dict(organisation_id=ORG, unit_id=5, title="Front door lock stiff",
             description="Lock very difficult to open, tenant had to force it. Security concern.",
             priority="high", status="open", reported_by="Sophie Clarke",
             reported_by_tenant_id=4, created_at=ago(2)),
        dict(organisation_id=ORG, unit_id=6, title="Damp patch on bedroom ceiling",
             description="Water stain appeared after heavy rain. Approximately 30cm across.",
             priority="high", status="open", reported_by="Mohammed Ali",
             reported_by_tenant_id=5, created_at=ago(1)),
        dict(organisation_id=ORG, unit_id=7, title="Oven not working",
             description="Electric oven stopped heating. Hob still works fine.",
             priority="medium", status="completed", reported_by="Rebecca Hughes",
             assigned_to=elec_co.full_name, contractor_id=elec_co.id,
             reported_by_tenant_id=6, created_at=ago(60), completed_at=ago(55)),
        dict(organisation_id=ORG, unit_id=1, title="Bedroom window latch broken",
             description="Latch on main bedroom window snapped off. Can't secure window.",
             priority="medium", status="completed", reported_by="James Thornton",
             assigned_to="ClearView Windows", reported_by_tenant_id=1,
             created_at=ago(90), completed_at=ago(85)),
        dict(organisation_id=ORG, unit_id=4, title="Radiator in living room cold",
             description="One radiator not heating. Others fine. May need bleeding.",
             priority="low", status="completed", reported_by="Daniel Walsh",
             assigned_to=gas_co.full_name, contractor_id=gas_co.id,
             reported_by_tenant_id=3, created_at=ago(120), completed_at=ago(118)),
        dict(organisation_id=ORG, unit_id=2, title="Washing machine vibrating loudly",
             description="Machine shaking the whole floor on spin cycle. Getting worse.",
             priority="low", status="open", reported_by="Priya Sharma",
             reported_by_tenant_id=2, created_at=ago(3)),
        dict(organisation_id=ORG, unit_id=5, title="Smoke alarm beeping",
             description="Smoke alarm in hallway beeping every 30 seconds — low battery.",
             priority="medium", status="completed", reported_by="Sophie Clarke",
             reported_by_tenant_id=4, created_at=ago(14), completed_at=ago(13)),
    ]:
        db.add(MaintenanceRequest(**j))
    db.flush()
    print("✅ Maintenance jobs added")

# ── Rent payments (12 months history per lease) ───────────────────────────────
if db.query(RentPayment).count() == 0:
    lease_rents = [(1, 850.0), (2, 650.0), (3, 1200.0), (4, 950.0), (5, 450.0), (6, 450.0)]
    for lease_id, rent in lease_rents:
        for m in range(1, 13):
            mo = (TODAY.month - m - 1) % 12 + 1
            yr = TODAY.year if TODAY.month - m > 0 else TODAY.year - 1
            due = date(yr, mo, 1)
            is_missing = (lease_id == 3 and m == 2)
            is_late    = (not is_missing) and random.random() < 0.08
            db.add(RentPayment(
                lease_id=lease_id,
                amount_due=rent,
                amount_paid=None if is_missing else rent,
                due_date=due,
                paid_date=None if is_missing else due + timedelta(days=random.randint(10,18) if is_late else random.randint(0,3)),
                status="overdue" if is_missing else "paid",
                notes="Late payment" if is_late else None,
            ))
    db.flush()
    print("✅ Rent payments added")

# ── Deposits ──────────────────────────────────────────────────────────────────
if db.query(TenancyDeposit).filter_by(organisation_id=ORG).count() == 0:
    for d in [
        dict(organisation_id=ORG, lease_id=1, amount=1275.0, scheme="DPS",
             scheme_reference="DPS-2024-001847", received_date=date(2024,3,1),
             protected_date=date(2024,3,5), status="protected"),
        dict(organisation_id=ORG, lease_id=2, amount=975.0, scheme="TDS",
             scheme_reference="TDS-2023-009234", received_date=date(2023,9,1),
             protected_date=date(2023,9,8), status="protected"),
        dict(organisation_id=ORG, lease_id=3, amount=1800.0, scheme="MyDeposits",
             scheme_reference="MD-2024-003341", received_date=date(2024,1,15),
             protected_date=date(2024,1,22), status="protected"),
        dict(organisation_id=ORG, lease_id=4, amount=1425.0, scheme="DPS",
             scheme_reference="DPS-2024-007821", received_date=date(2024,6,1),
             protected_date=date(2024,6,5), status="protected"),
        dict(organisation_id=ORG, lease_id=5, amount=675.0, scheme="TDS",
             scheme_reference="TDS-2024-012445", received_date=date(2024,11,1),
             protected_date=date(2024,11,8), status="protected"),
        dict(organisation_id=ORG, lease_id=6, amount=675.0, scheme="DPS",
             scheme_reference="DPS-2025-000192", received_date=date(2025,1,1),
             protected_date=date(2025,1,6), status="protected"),
    ]:
        db.add(TenancyDeposit(**d))
    db.flush()
    print("✅ Deposits added")

# ── Applicants ────────────────────────────────────────────────────────────────
if db.query(Applicant).filter_by(organisation_id=ORG).count() == 0:
    for a in [
        dict(organisation_id=ORG, property_id=1, unit_id=3, full_name="Hannah Patel",
             email="hannah.p@gmail.com", phone="07811 223344", source="Rightmove",
             status="viewing_scheduled", desired_move_date=dfwd(14), monthly_budget=900,
             notes="Viewing Saturday 10am. NHS nurse, employed 3yrs."),
        dict(organisation_id=ORG, property_id=1, unit_id=3, full_name="Tom Bradshaw",
             email="t.bradshaw@outlook.com", phone="07922 334455", source="Rightmove",
             status="enquiry", desired_move_date=dfwd(30), monthly_budget=875,
             notes="Relocating from Leeds for work."),
        dict(organisation_id=ORG, property_id=3, unit_id=8, full_name="Aisha Okonkwo",
             email="aisha.o@yahoo.co.uk", phone="07733 445566", source="SpareRoom",
             status="referencing", desired_move_date=dfwd(7), monthly_budget=450,
             notes="Student at Newcastle Uni. Referencing in progress."),
        dict(organisation_id=ORG, property_id=1, unit_id=3, full_name="Chris Milligan",
             email="cmilligan@gmail.com", phone="07844 556677", source="Zoopla",
             status="offer_made", desired_move_date=dfwd(21), monthly_budget=900,
             notes="Offered £875/mo. Reference check underway."),
        dict(organisation_id=ORG, property_id=2, full_name="Laura Bennett",
             email="laurab@hotmail.com", phone="07955 667788", source="Direct",
             status="enquiry", desired_move_date=dfwd(45), monthly_budget=1000,
             notes="Wants 2-bed. Flexible on location."),
    ]:
        db.add(Applicant(**a))
    db.flush()
    print("✅ Applicants added")

# ── Inspections ───────────────────────────────────────────────────────────────
if db.query(Inspection).filter_by(organisation_id=ORG).count() == 0:
    for i in [
        dict(organisation_id=ORG, unit_id=1, type="routine", status="completed",
             scheduled_date=dago(60), completed_date=dago(60), inspector_name="Sarah Quayside",
             overall_condition="good",
             notes="Good condition. Minor scuff marks in hallway — tenant to address."),
        dict(organisation_id=ORG, unit_id=4, type="routine", status="completed",
             scheduled_date=dago(30), completed_date=dago(30), inspector_name="Naphtoli Cohen",
             overall_condition="excellent",
             notes="Immaculate. Tenant clearly looks after the property well."),
        dict(organisation_id=ORG, unit_id=6, type="routine", status="completed",
             scheduled_date=dago(14), completed_date=dago(14), inspector_name="Sarah Quayside",
             overall_condition="fair",
             notes="Some damp in bathroom — contractor arranged. Communal areas need attention."),
        dict(organisation_id=ORG, unit_id=1, type="routine", status="scheduled",
             scheduled_date=dfwd(30), inspector_name="Naphtoli Cohen",
             notes="6-month routine inspection."),
        dict(organisation_id=ORG, unit_id=5, type="routine", status="scheduled",
             scheduled_date=dfwd(14), inspector_name="Sarah Quayside"),
    ]:
        db.add(Inspection(**i))
    db.flush()
    print("✅ Inspections added")

# ── PPM Schedules ─────────────────────────────────────────────────────────────
if db.query(PPMSchedule).filter_by(organisation_id=ORG).count() == 0:
    for p in [
        dict(organisation_id=ORG, property_id=1, title="Annual Gas Safety Check",
             description="CP12 for all units at Park View Court", frequency="annual",
             next_due=dfwd(45), contractor_id=gas_co.id, estimated_cost=120.0, last_completed=dago(320)),
        dict(organisation_id=ORG, property_id=2, title="Annual Gas Safety Check",
             description="CP12 for Riverside House", frequency="annual",
             next_due=dfwd(92), contractor_id=gas_co.id, estimated_cost=120.0, last_completed=dago(273)),
        dict(organisation_id=ORG, property_id=1, title="EICR Electrical Inspection",
             description="5-year electrical installation condition report", frequency="5_years",
             next_due=dfwd(730), contractor_id=elec_co.id, estimated_cost=350.0, last_completed=dago(1095)),
        dict(organisation_id=ORG, property_id=3, title="Annual Gas Safety Check",
             description="HMO requires annual gas safety certificate", frequency="annual",
             next_due=dfwd(21), contractor_id=gas_co.id, estimated_cost=180.0, last_completed=dago(344)),
        dict(organisation_id=ORG, property_id=3, title="HMO Licence Renewal",
             description="Mandatory HMO licence renewal — Newcastle City Council", frequency="5_years",
             next_due=dfwd(182), estimated_cost=850.0),
        dict(organisation_id=ORG, property_id=2, title="Legionella Risk Assessment",
             description="Biennial assessment required", frequency="2_years",
             next_due=dfwd(365), estimated_cost=200.0, last_completed=dago(365)),
        dict(organisation_id=ORG, property_id=1, title="Gutter & Roof Inspection",
             description="Annual external maintenance check before winter", frequency="annual",
             next_due=dfwd(210), estimated_cost=150.0, last_completed=dago(155)),
    ]:
        db.add(PPMSchedule(**p))
    db.flush()
    print("✅ PPM schedules added")

# ── Legal Notices ─────────────────────────────────────────────────────────────
if db.query(LegalNotice).filter_by(organisation_id=ORG).count() == 0:
    for n in [
        dict(organisation_id=ORG, lease_id=3, notice_type="section_21",
             served_date=dago(90), possession_date=dago(28),
             custom_notes="Landlord wishes to sell Riverside House. S21 served correctly with all documents.",
             check_gas_cert="pass", check_epc="pass", check_deposit="pass", check_how_to_rent="pass"),
        dict(organisation_id=ORG, lease_id=1, notice_type="section_8",
             served_date=None, possession_date=None,
             custom_notes="Draft S8 prepared — persistent late payment. Not yet served."),
    ]:
        db.add(LegalNotice(**n))
    db.flush()
    print("✅ Legal notices added")

# ── Tenant Satisfaction Surveys ───────────────────────────────────────────────
if db.query(MaintenanceSurvey).filter_by(organisation_id=ORG).count() == 0:
    completed = db.query(MaintenanceRequest).filter_by(organisation_id=ORG, status="completed").all()
    responses = [
        (5, "Fixed really quickly! Very professional engineer, couldn't be happier."),
        (4, "Good service overall. Took a couple of days but resolved well."),
        (5, "Excellent — same day response. Couldn't ask for more."),
        (3, "Took longer than expected but did a good job in the end."),
        (5, ""),
        (4, "Happy with the outcome, just wish it had been dealt with a bit quicker."),
    ]
    for i, job in enumerate(completed[:len(responses)]):
        rating, comment = responses[i]
        db.add(MaintenanceSurvey(
            organisation_id=ORG, job_id=job.id,
            tenant_id=job.reported_by_tenant_id,
            token=_secrets.token_urlsafe(32),
            rating=rating, comment=comment,
            responded_at=ago(random.randint(2, 25)),
        ))
    db.flush()
    print("✅ Surveys added")

# ── Inventory (Flat 1 check-in) ───────────────────────────────────────────────
if db.query(Inventory).filter_by(organisation_id=ORG).count() == 0:
    inv = Inventory(
        organisation_id=ORG, lease_id=1,
        inv_type="check_in", inv_date=date(2024,3,1),
        conducted_by="Naphtoli Cohen", tenant_present=True,
        overall_notes="Check-in completed with tenant present and signed.",
        meter_electric="14823 kWh", meter_gas="4521 m³",
        keys_handed="2x front door, 1x postbox, 1x car park fob",
    )
    db.add(inv)
    db.flush()
    for room_name, items in [
        ("Living Room", [("Sofa (2-seat grey fabric)","good","Light use"),("Coffee table (oak)","good","Minor surface scratch"),("Carpet","good","Clean, no stains"),("Curtains (grey)","good","Clean and hanging correctly")]),
        ("Kitchen",     [("Fridge freezer","good","Working, clean"),("Oven & hob","good","Clean, all burners working"),("Dishwasher","good","Working"),("Kitchen units","good","All doors and hinges intact"),("Vinyl floor","good","Clean, no damage")]),
        ("Bedroom 1",   [("Double bed frame","good","Solid, no damage"),("Mattress (double)","good","Clean, no stains"),("Wardrobe (double)","good","All doors working"),("Chest of drawers","good","All drawers slide freely")]),
        ("Bedroom 2",   [("Single bed frame","good","Solid"),("Mattress (single)","good","Clean"),("Wardrobe (single)","fair","Door slightly stiff")]),
        ("Bathroom",    [("Bath","good","Clean, no chips"),("Shower","good","Working, clean"),("WC","good","Working, no issues"),("Basin","good","Clean, no cracks"),("Tiles","good","All present, grouting good")]),
    ]:
        room = InventoryRoom(inventory_id=inv.id, room_name=room_name)
        db.add(room)
        db.flush()
        for name, cond, notes in items:
            db.add(InventoryItem(room_id=room.id, item_name=name, condition=cond, notes=notes))
    db.flush()
    print("✅ Inventory added")

# ── Property Valuations ───────────────────────────────────────────────────────
if db.query(PropertyValuation).filter_by(organisation_id=ORG).count() == 0:
    for v in [
        dict(organisation_id=ORG, property_id=1, valuation_date=dago(90), estimated_value=285000,
             source="surveyor", notes="Strong demand in Gateshead. 2-bed flats selling well. Yield 7.2%."),
        dict(organisation_id=ORG, property_id=2, valuation_date=dago(45), estimated_value=420000,
             source="surveyor", notes="Newcastle city centre premium. River views add ~5%."),
        dict(organisation_id=ORG, property_id=3, valuation_date=dago(30), estimated_value=195000,
             source="manual", notes="HMO premium. Running as HMO significantly boosts yield vs single let."),
    ]:
        db.add(PropertyValuation(**v))
    db.flush()
    print("✅ Valuations added")

# ── Right to Rent ─────────────────────────────────────────────────────────────
for tid, doc, chk, exp in [
    (1, "british_passport", dago(320), None),
    (2, "euss_settled",     dago(180), None),
    (3, "british_passport", dago(450), None),
    (4, "brp",              dago(90),  dfwd(275)),
    (5, "visa",             dago(60),  dfwd(35)),   # expiring soon!
    (6, "british_passport", dago(200), None),
]:
    t = db.query(Tenant).filter_by(id=tid).first()
    if t and not t.rtr_check_date:
        t.rtr_document_type = doc
        t.rtr_check_date = chk
        t.rtr_expiry_date = exp

db.flush()
print("✅ Right to Rent updated (Mohammed Ali expiring in 35 days)")

db.commit()
db.close()
print("\n🎉 Demo seed complete! All portals now have rich test data.")
