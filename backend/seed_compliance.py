import sys
sys.path.insert(0, "/root/propairty/backend")
from app.database import SessionLocal, engine, Base
from app.models.compliance import ComplianceCertificate
from app.models.property import Property
from datetime import date

Base.metadata.create_all(bind=engine)
db = SessionLocal()

props = db.query(Property).all()
p1, p2, p3 = props[0], props[1], props[2]

certs = [
    # Park View Court (p1)
    ComplianceCertificate(property_id=p1.id, cert_type="gas_safety",  issue_date=date(2025,3,10),  expiry_date=date(2026,3,10),  contractor="NE Gas Services Ltd",      reference="GS-2025-001"),
    ComplianceCertificate(property_id=p1.id, cert_type="epc",         issue_date=date(2020,6,1),   expiry_date=date(2030,6,1),   reference="EPC-NE8-001",               notes="EPC Rating: C"),
    ComplianceCertificate(property_id=p1.id, cert_type="eicr",        issue_date=date(2022,4,15),  expiry_date=date(2027,4,15),  contractor="Tyne Electrical Ltd"),
    ComplianceCertificate(property_id=p1.id, cert_type="fire_risk",   issue_date=date(2025,1,20),  expiry_date=date(2026,1,20),  notes="Low risk — no issues found"),

    # Riverside House (p2) — gas safety expiring in 40 days
    ComplianceCertificate(property_id=p2.id, cert_type="gas_safety",  issue_date=date(2025,2,10),  expiry_date=date(2026, 2, 10),contractor="NE Gas Services Ltd",      reference="GS-2025-002"),
    ComplianceCertificate(property_id=p2.id, cert_type="epc",         issue_date=date(2019,3,1),   expiry_date=date(2029,3,1),   reference="EPC-NE1-001",               notes="EPC Rating: D — consider improvement"),
    ComplianceCertificate(property_id=p2.id, cert_type="eicr",        issue_date=date(2021,7,1),   expiry_date=date(2026,7,1),   contractor="Tyne Electrical Ltd"),

    # The Old Mill HMO (p3) — EICR expired, fire risk expiring soon
    ComplianceCertificate(property_id=p3.id, cert_type="gas_safety",  issue_date=date(2025,6,1),   expiry_date=date(2026,6,1),   contractor="NE Gas Services Ltd"),
    ComplianceCertificate(property_id=p3.id, cert_type="epc",         issue_date=date(2018,1,1),   expiry_date=date(2028,1,1),   notes="EPC Rating: E — minimum legal rating"),
    ComplianceCertificate(property_id=p3.id, cert_type="eicr",        issue_date=date(2020,11,1),  expiry_date=date(2025,11,1),  contractor="Sparks Electrical NE",     notes="EXPIRED — renewal required urgently"),
    ComplianceCertificate(property_id=p3.id, cert_type="fire_risk",   issue_date=date(2025,2,28),  expiry_date=date(2026,2,28),  notes="HMO — annual review required"),
    ComplianceCertificate(property_id=p3.id, cert_type="legionella",  issue_date=date(2024,4,1),   expiry_date=date(2026,4,1),   contractor="Water Safety NE"),
]

db.add_all(certs)
db.commit()
print(f"Seeded {len(certs)} compliance certificates.")
db.close()
