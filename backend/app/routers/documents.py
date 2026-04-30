from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.lease import Lease
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app.models.landlord import Landlord
from app import docgen

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOCUMENT_TYPES = {
    "ast":               "Assured Shorthold Tenancy Agreement",
    "section_21":        "Section 21 Notice",
    "section_8":         "Section 8 Notice",
    "rent_increase":     "Rent Increase Notice",
    "deposit_receipt":   "Deposit Receipt",
    "deed_of_surrender": "Deed of Surrender",
    "nosp":              "Notice of Seeking Possession (NOSP)",
}


def _get_lease_context(lease_id: int, org_id: int, db: Session):
    lease = db.query(Lease).join(Unit).join(Property).filter(
        Lease.id == lease_id,
        Property.organisation_id == org_id
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
    unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    return lease, tenant, unit, org


class GenerateRequest(BaseModel):
    lease_id: int
    doc_type: str
    new_rent: Optional[float] = None
    effective_date: Optional[date] = None
    arrears_amount: Optional[float] = None
    custom_notes: Optional[str] = None
    surrender_date: Optional[date] = None


@router.get("/types")
def list_types():
    return [{"key": k, "label": v} for k, v in DOCUMENT_TYPES.items()]


@router.post("/generate")
def generate_document(req: GenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lease, tenant, unit, org = _get_lease_context(req.lease_id, current_user.organisation_id, db)

    if req.doc_type == "ast":
        from app.models.deposit import TenancyDeposit
        dep = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
        pdf = docgen.generate_ast(lease, tenant, unit, org, deposit_override=dep.amount if dep else None)
        filename = f"AST_{tenant.full_name.replace(' ', '_')}_{lease.start_date}.pdf"

    elif req.doc_type == "section_21":
        pdf = docgen.generate_section21(lease, tenant, unit, org)
        filename = f"Section21_{tenant.full_name.replace(' ', '_')}.pdf"

    elif req.doc_type == "section_8":
        arrears = req.arrears_amount or 0
        pdf = docgen.generate_section8(lease, tenant, unit, org, arrears, req.custom_notes or "")
        filename = f"Section8_{tenant.full_name.replace(' ', '_')}.pdf"

    elif req.doc_type == "rent_increase":
        if not req.new_rent or not req.effective_date:
            raise HTTPException(status_code=400, detail="new_rent and effective_date required for rent increase notice")
        pdf = docgen.generate_rent_increase(lease, tenant, unit, org, req.new_rent, req.effective_date, req.custom_notes or "")
        filename = f"RentIncrease_{tenant.full_name.replace(' ', '_')}.pdf"

    elif req.doc_type == "deposit_receipt":
        pdf = docgen.generate_deposit_receipt(lease, tenant, unit, org)
        filename = f"DepositReceipt_{tenant.full_name.replace(' ', '_')}.pdf"

    elif req.doc_type == "deed_of_surrender":
        from app.models.deposit import TenancyDeposit
        dep = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
        pdf = docgen.generate_deed_of_surrender(
            lease, tenant, unit, org,
            surrender_date=req.surrender_date,
            deposit=dep,
            condition_notes=req.custom_notes or "",
        )
        filename = f"DeedOfSurrender_{tenant.full_name.replace(' ', '_')}.pdf"

    elif req.doc_type == "nosp":
        arrears = req.arrears_amount or 0.0
        pdf = docgen.generate_nosp(
            lease, tenant, unit, org,
            arrears_amount=arrears,
            ground_8=arrears >= (lease.monthly_rent * 2),
            ground_10=arrears > 0,
            particulars=req.custom_notes or "",
        )
        filename = f"NOSP_{tenant.full_name.replace(' ', '_')}.pdf"

    else:
        raise HTTPException(status_code=400, detail=f"Unknown document type: {req.doc_type}")

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/deposit-dispute/{deposit_id}")
def generate_deposit_dispute_doc(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.deposit import TenancyDeposit
    from app.models.inspection import Inspection
    from app.models.payment import RentPayment
    dep = db.query(TenancyDeposit).filter(TenancyDeposit.id == deposit_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deposit not found")
    lease, tenant, unit, org = _get_lease_context(dep.lease_id, current_user.organisation_id, db)

    # Pull overdue payments for rent arrears figure
    overdue = db.query(RentPayment).filter(
        RentPayment.lease_id == lease.id, RentPayment.status == "overdue"
    ).all()
    rent_arrears = sum((r.amount or 0) - (r.amount_paid or 0) for r in overdue)

    # Latest inspection as checkout evidence
    inspection = db.query(Inspection).filter(
        Inspection.unit_id == unit.id
    ).order_by(Inspection.scheduled_date.desc()).first()
    checkout_notes = inspection.notes if (inspection and inspection.notes) else ""

    pdf = docgen.generate_deposit_dispute(
        lease, tenant, unit, org,
        deposit=dep,
        checkout_notes=checkout_notes,
        rent_arrears=rent_arrears,
    )
    filename = f"DepositDispute_{tenant.full_name.replace(' ', '_')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/hmo-guidance/{property_id}")
def generate_hmo_guidance_doc(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.compliance import ComplianceCertificate
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    from app.models.unit import Unit as UnitModel
    units = db.query(UnitModel).filter(UnitModel.property_id == prop.id).all()
    certs = db.query(ComplianceCertificate).filter(ComplianceCertificate.property_id == prop.id).all()
    pdf = docgen.generate_hmo_guidance(prop, org, units=units, compliance_certs=certs)
    filename = f"HMO_Guidance_{prop.name.replace(' ', '_')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


class ManagementAgreementRequest(BaseModel):
    landlord_id: int
    management_fee_pct: float = 10.0
    tenant_find_fee: str = "One month's rent (inc. VAT)"
    renewal_fee: str = "£150 + VAT"
    maintenance_limit: int = 250
    notice_period: int = 60
    inspection_frequency: str = "twice per year"


@router.post("/generate-management-agreement")
def generate_management_agreement(
    req: ManagementAgreementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    landlord = db.query(Landlord).filter(
        Landlord.id == req.landlord_id,
        Landlord.organisation_id == current_user.organisation_id,
    ).first()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")

    org = db.query(Organisation).filter(Organisation.id == current_user.organisation_id).first()
    properties = db.query(Property).filter(
        Property.landlord_id == req.landlord_id,
        Property.organisation_id == current_user.organisation_id,
    ).all()

    pdf = docgen.generate_management_agreement(
        landlord=landlord,
        org=org,
        properties=properties,
        management_fee_pct=req.management_fee_pct,
        tenant_find_fee=req.tenant_find_fee,
        renewal_fee=req.renewal_fee,
        maintenance_limit=req.maintenance_limit,
        notice_period=req.notice_period,
        inspection_frequency=req.inspection_frequency,
    )
    filename = f"ManagementAgreement_{landlord.full_name.replace(' ', '_')}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
