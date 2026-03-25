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
from app import docgen

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOCUMENT_TYPES = {
    "ast":            "Assured Shorthold Tenancy Agreement",
    "section_21":     "Section 21 Notice",
    "section_8":      "Section 8 Notice",
    "rent_increase":  "Rent Increase Notice",
    "deposit_receipt": "Deposit Receipt",
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


@router.get("/types")
def list_types():
    return [{"key": k, "label": v} for k, v in DOCUMENT_TYPES.items()]


@router.post("/generate")
def generate_document(req: GenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lease, tenant, unit, org = _get_lease_context(req.lease_id, current_user.organisation_id, db)

    if req.doc_type == "ast":
        pdf = docgen.generate_ast(lease, tenant, unit, org)
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

    else:
        raise HTTPException(status_code=400, detail=f"Unknown document type: {req.doc_type}")

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
