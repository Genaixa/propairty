"""Add EPC-relevant contractors to the demo data."""
from app.database import SessionLocal
from app.models.contractor import Contractor

db = SessionLocal()
ORG = 1

epc_contractors = [
    dict(organisation_id=ORG, full_name="NE Insulation Solutions", company_name="NE Insulation Solutions Ltd",
         trade="Insulation Specialist", email="info@neinsulation.co.uk", phone="0191 555 0301",
         notes="Loft and cavity wall insulation specialists. CIGA accredited. Can batch multiple properties.",
         is_active=True),
    dict(organisation_id=ORG, full_name="Green Energy North", company_name="Green Energy North Ltd",
         trade="Renewable Energy Installer", email="info@greenenergynorth.co.uk", phone="0191 555 0302",
         notes="Solar PV, solar thermal and heat pump installations. MCS certified.",
         is_active=True),
    dict(organisation_id=ORG, full_name="Tyne EPC Assessors", company_name="Tyne EPC Assessors",
         trade="EPC Assessor", email="assessments@tyneepc.co.uk", phone="07944 555066",
         notes="Domestic Energy Assessors. Can assess and re-certify after works. Discount for portfolio clients.",
         is_active=True),
    dict(organisation_id=ORG, full_name="DryShield NE", company_name="DryShield Damp Proofing NE",
         trade="Damp Proofing Specialist", email="info@dryshieldne.co.uk", phone="0191 555 0303",
         notes="Damp proofing, tanking, and ventilation specialists. Guaranteed work.",
         is_active=True),
    dict(organisation_id=ORG, full_name="Apex Roofing NE", company_name="Apex Roofing NE Ltd",
         trade="Roofer", email="jobs@apexroofingnе.co.uk", phone="0191 555 0304",
         notes="Residential roofing, repairs, and insulation. Emergency callout available.",
         is_active=True),
    dict(organisation_id=ORG, full_name="Heritage Build NE", company_name="Heritage Build NE",
         trade="Builder", email="info@heritagebuildne.co.uk", phone="07955 555077",
         notes="General building and refurbishment. Experienced with older properties and HMOs.",
         is_active=True),
    dict(organisation_id=ORG, full_name="Tyne Decorators", company_name="Tyne Decorators Ltd",
         trade="Painter/Decorator", email="info@tynedecorators.co.uk", phone="07966 555088",
         notes="Interior and exterior. Can turn around between tenancies quickly.",
         is_active=True),
]

added = 0
for cd in epc_contractors:
    exists = db.query(Contractor).filter_by(organisation_id=ORG, email=cd['email']).first()
    if not exists:
        db.add(Contractor(**cd))
        added += 1
        print(f"Added: {cd['full_name']} ({cd['trade']})")
    else:
        print(f"  Already exists: {cd['full_name']}")

db.commit()
db.close()
print(f"\nDone. {added} contractors added.")
