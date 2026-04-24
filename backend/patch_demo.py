"""
Demo data patch — fixes existing records to make all features work properly.
- Sets EPC ratings on properties
- Moves lease end dates into the future across all void bands
- Adds actual_cost to maintenance jobs (for accurate net yield)
- Adds lease renewal records (sent/declined) for void minimiser
- Adds upcoming rent payments for active leases
- Adds compliance certificates spread across urgency bands
Safe to re-run.
"""
from datetime import date, timedelta
from app.database import SessionLocal
from app.models.property import Property
from app.models.lease import Lease
from app.models.maintenance import MaintenanceRequest
from app.models.renewal import LeaseRenewal
from app.models.payment import RentPayment
from app.models.compliance import ComplianceCertificate

db = SessionLocal()
TODAY = date.today()

def fwd(days): return TODAY + timedelta(days=days)
def ago(days): return TODAY - timedelta(days=days)

# ── 1. EPC ratings ────────────────────────────────────────────────────────────
epc_map = {1: 'E', 2: 'D', 3: 'F'}
for prop_id, rating in epc_map.items():
    p = db.query(Property).filter_by(id=prop_id).first()
    if p:
        p.epc_rating = rating
        print(f"✅ {p.name} → EPC {rating}")

# ── 2. Lease end dates — spread across all five void bands ────────────────────
# band 30:   0–30d   → lease ends in ~20 days
# band 60:  31–60d   → lease ends in ~45 days
# band 90:  61–90d   → lease ends in ~75 days
# band 120: 91–120d  → lease ends in ~105 days
# band 120+: 121–180d → lease ends in ~140 days

lease_ends = {
    1:  fwd(20),   # Flat 1, Park View Court      → band 30  (critical)
    2:  fwd(45),   # Flat 2, Park View Court      → band 60
    6:  fwd(75),   # Room 2, Old Mill HMO         → band 90
    11: fwd(105),  # Ground Floor, Riverside House → band 120
    5:  fwd(140),  # Room 1, Old Mill HMO         → band 120+
    8:  fwd(155),  # First Floor, Riverside       → band 120+
    10: fwd(85),   # Room 3, Old Mill HMO         → band 90
}
for lease_id, end_date in lease_ends.items():
    l = db.query(Lease).filter_by(id=lease_id).first()
    if l:
        l.end_date = end_date
        l.status = "active"
        print(f"✅ Lease {lease_id} (unit {l.unit_id}) end → {end_date} ({(end_date-TODAY).days}d)")

# ── 3. Maintenance actual costs (for net yield calculation) ───────────────────
cost_map = {
    "Boiler not heating":           450.0,
    "Kitchen tap dripping":          85.0,
    "Oven not working":             120.0,
    "Radiator in living room cold":  60.0,
    "Bedroom window latch broken":   45.0,
    "Smoke alarm beeping":           12.0,
}
for title, cost in cost_map.items():
    job = db.query(MaintenanceRequest).filter(MaintenanceRequest.title == title).first()
    if job and not job.actual_cost:
        job.actual_cost = cost
        print(f"✅ Maintenance cost: {title} → £{cost}")

# ── 4. Lease renewals — give some leases a renewal status ────────────────────
# Lease 1 (band 30): renewal sent but no response — most urgent
# Lease 2 (band 60): renewal declined — need to re-let
# Lease 6 (band 90): no renewal started (already handled by absence of record)
# Lease 10 (band 90): renewal sent

renewal_data = [
    dict(lease_id=1,  status="sent",     sent_at=ago(14), proposed_rent=875.0,  proposed_start=fwd(21),  proposed_end=fwd(385)),
    dict(lease_id=2,  status="declined", sent_at=ago(21), proposed_rent=680.0,  proposed_start=fwd(46),  proposed_end=fwd(410)),
    dict(lease_id=10, status="sent",     sent_at=ago(7),  proposed_rent=475.0,  proposed_start=fwd(86),  proposed_end=fwd(450)),
]
for rd in renewal_data:
    exists = db.query(LeaseRenewal).filter_by(lease_id=rd['lease_id']).first()
    if not exists:
        db.add(LeaseRenewal(**rd))
        print(f"✅ Renewal for lease {rd['lease_id']}: {rd['status']}")

# ── 5. Upcoming rent payments for active leases ───────────────────────────────
active_leases = db.query(Lease).filter_by(status="active").all()
for lease in active_leases:
    # Add next 3 months of upcoming payments if not already there
    for m in range(1, 4):
        due = fwd(m * 30)
        exists = db.query(RentPayment).filter_by(lease_id=lease.id, due_date=due).first()
        if not exists:
            db.add(RentPayment(
                lease_id=lease.id,
                amount_due=lease.monthly_rent,
                due_date=due,
                status="pending",
            ))
print("✅ Upcoming rent payments added")

# ── 6. Compliance certificates — spread across urgency bands ─────────────────
existing_certs = db.query(ComplianceCertificate).count()
if existing_certs < 5:
    new_certs = [
        dict(property_id=1, cert_type="gas_safety",   issue_date=ago(340), expiry_date=fwd(25),   issued_by="NE Gas Services"),
        dict(property_id=2, cert_type="eicr",         issue_date=ago(1700),expiry_date=fwd(55),   issued_by="Spark Electric"),
        dict(property_id=3, cert_type="gas_safety",   issue_date=ago(300), expiry_date=fwd(65),   issued_by="NE Gas Services"),
        dict(property_id=1, cert_type="epc",          issue_date=ago(730), expiry_date=fwd(2920), issued_by="EPC Assessors Ltd"),
        dict(property_id=3, cert_type="fire_risk",    issue_date=ago(200), expiry_date=fwd(95),   issued_by="FireSafe NE"),
        dict(property_id=2, cert_type="gas_safety",   issue_date=ago(310), expiry_date=fwd(55),   issued_by="NE Gas Services"),
    ]
    for cd in new_certs:
        db.add(ComplianceCertificate(**cd))
    print("✅ Compliance certificates added")

db.commit()
db.close()
print("\n🎉 Demo patch complete!")
