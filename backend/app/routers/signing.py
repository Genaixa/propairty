"""
E-Signature Router
==================
Allows agents to send documents for electronic signing.
Signers get a secure link — no login required.
Signed PDFs are regenerated with the signature embedded.
"""
import uuid, json, os, base64
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.signing_request import SigningRequest
from app.models.lease import Lease
from app.models.tenant import Tenant
from app.models.unit import Unit
from app.models.property import Property
from app.models.organisation import Organisation
from app import docgen, emails
from app.config import settings

router = APIRouter(prefix="/api/signing", tags=["signing"])

SIGNED_PDF_DIR = Path("/root/propairty/backend/uploads/signed_docs")
SIGNED_PDF_DIR.mkdir(parents=True, exist_ok=True)

DOC_LABELS = {
    "ast":             "Assured Shorthold Tenancy Agreement",
    "section_21":      "Section 21 Notice",
    "section_8":       "Section 8 Notice",
    "rent_increase":   "Rent Increase Notice",
    "deposit_receipt": "Deposit Receipt",
    "renewal_offer":   "Lease Renewal Offer",
}

EXPIRY_DAYS = 14


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SendSigningRequest(BaseModel):
    lease_id: int
    doc_type: str
    signer_name: str
    signer_email: str
    signer_type: str = "tenant"  # tenant | landlord | other
    # Extra doc params
    new_rent: Optional[float] = None
    effective_date: Optional[str] = None  # ISO date
    arrears_amount: Optional[float] = None
    custom_notes: Optional[str] = None


class SubmitSignature(BaseModel):
    signature_data: str  # base64 PNG data URL
    signer_name_confirm: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_lease(lease_id: int, org_id: int, db: Session):
    lease = db.query(Lease).join(Unit).join(Property).filter(
        Lease.id == lease_id,
        Property.organisation_id == org_id,
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
    unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    return lease, tenant, unit, org


def _generate_signed_pdf(sr: SigningRequest, db: Session) -> bytes:
    """Regenerate the document PDF with the signature block embedded."""
    from datetime import date as _date

    lease = db.query(Lease).get(sr.lease_id)
    if not lease:
        raise ValueError("Lease not found")
    tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first()
    unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first()
    org = db.query(Organisation).filter(Organisation.id == sr.organisation_id).first()

    params = json.loads(sr.doc_params or "{}")

    sig_block = f"""
    <div style="margin-top:40px;padding:20px;border:2px solid #4f46e5;border-radius:8px;background:#f8f9ff;page-break-inside:avoid;">
      <p style="margin:0 0 8px 0;font-size:11px;color:#666;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">
        Electronic Signature — Legally Binding
      </p>
      <img src="{sr.signature_data}" style="max-width:260px;height:80px;object-fit:contain;border-bottom:1px solid #ccc;display:block;margin-bottom:8px;" />
      <p style="margin:0;font-size:11px;color:#333;"><strong>Signed by:</strong> {sr.signer_name}</p>
      <p style="margin:2px 0;font-size:11px;color:#333;"><strong>Email:</strong> {sr.signer_email}</p>
      <p style="margin:2px 0;font-size:11px;color:#333;"><strong>Date:</strong> {sr.signed_at.strftime("%-d %B %Y at %H:%M UTC") if sr.signed_at else "—"}</p>
      <p style="margin:2px 0;font-size:11px;color:#333;"><strong>IP Address:</strong> {sr.ip_address or "—"}</p>
      <p style="margin:6px 0 0 0;font-size:10px;color:#999;">This document was signed electronically via PropAIrty. Reference: {sr.token[:8].upper()}</p>
    </div>
    """

    if sr.doc_type == "ast":
        from app.models.deposit import TenancyDeposit
        dep = db.query(TenancyDeposit).filter(TenancyDeposit.lease_id == lease.id).first()
        pdf_bytes = docgen.generate_ast(lease, tenant, unit, org,
                                        deposit_override=dep.amount if dep else None,
                                        signature_block=sig_block)
    elif sr.doc_type == "section_21":
        pdf_bytes = docgen.generate_section21(lease, tenant, unit, org,
                                               signature_block=sig_block)
    elif sr.doc_type == "section_8":
        pdf_bytes = docgen.generate_section8(lease, tenant, unit, org,
                                              params.get("arrears_amount", 0),
                                              params.get("custom_notes", ""),
                                              signature_block=sig_block)
    elif sr.doc_type == "rent_increase":
        from datetime import date as _d
        eff = _d.fromisoformat(params["effective_date"]) if params.get("effective_date") else _d.today()
        pdf_bytes = docgen.generate_rent_increase(lease, tenant, unit, org,
                                                   params.get("new_rent", 0), eff,
                                                   params.get("custom_notes", ""),
                                                   signature_block=sig_block)
    elif sr.doc_type == "deposit_receipt":
        pdf_bytes = docgen.generate_deposit_receipt(lease, tenant, unit, org,
                                                     signature_block=sig_block)
    else:
        raise ValueError(f"Unknown doc_type: {sr.doc_type}")

    return pdf_bytes


def _send_signing_email(signer_email: str, signer_name: str, doc_label: str,
                         org_name: str, token: str, expires_at: datetime):
    signing_url = f"{settings.app_base_url}/sign/{token}"
    expiry_str = expires_at.strftime("%-d %B %Y")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:#4f46e5;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:white;margin:0;font-size:20px;">PropAIrty — Document Ready to Sign</h2>
      </div>
      <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
        <p style="margin:0 0 16px 0;color:#374151;">Dear {signer_name},</p>
        <p style="color:#374151;">{org_name} has sent you a document for electronic signature:</p>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;text-align:center;">
          <p style="margin:0;font-size:16px;font-weight:bold;color:#1f2937;">📄 {doc_label}</p>
        </div>
        <p style="text-align:center;margin:24px 0;">
          <a href="{signing_url}"
             style="background:#4f46e5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
            Review &amp; Sign Document
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">This link is unique to you and expires on <strong>{expiry_str}</strong>.</p>
        <p style="color:#6b7280;font-size:13px;">By signing, you agree to use electronic signatures for this document. Your signature is legally binding under UK law.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          If you did not expect this document, please contact {org_name} directly.<br/>
          Signing link: {signing_url}
        </p>
      </div>
    </div>
    """
    emails._send_email(signer_email, f"Document ready to sign: {doc_label}", html)


def _send_signed_confirmation(sr: SigningRequest, org_name: str):
    """Notify the agent's org that signing is complete."""
    # We'll just log it — in production you'd email the agent
    print(f"[signing] {sr.doc_label} signed by {sr.signer_name} ({sr.signer_email}) token={sr.token[:8]}")


# ── Agent endpoints (auth required) ──────────────────────────────────────────

@router.post("/send")
def send_for_signing(
    req: SendSigningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agent creates a signing request and emails the signer."""
    if req.doc_type not in DOC_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown doc_type: {req.doc_type}")

    lease, tenant, unit, org = _get_lease(req.lease_id, current_user.organisation_id, db)

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=EXPIRY_DAYS)

    params = {}
    if req.new_rent:        params["new_rent"] = req.new_rent
    if req.effective_date:  params["effective_date"] = req.effective_date
    if req.arrears_amount:  params["arrears_amount"] = req.arrears_amount
    if req.custom_notes:    params["custom_notes"] = req.custom_notes

    sr = SigningRequest(
        organisation_id=current_user.organisation_id,
        token=token,
        doc_type=req.doc_type,
        doc_label=DOC_LABELS[req.doc_type],
        lease_id=req.lease_id,
        signer_name=req.signer_name,
        signer_email=req.signer_email,
        signer_type=req.signer_type,
        status="pending",
        expires_at=expires_at,
        doc_params=json.dumps(params) if params else "{}",
        created_by_user_id=current_user.id,
    )
    db.add(sr)
    db.commit()
    db.refresh(sr)

    _send_signing_email(
        req.signer_email, req.signer_name, DOC_LABELS[req.doc_type],
        org.name, token, expires_at,
    )

    return {
        "ok": True,
        "signing_id": sr.id,
        "token": token,
        "signing_url": f"{settings.app_base_url}/sign/{token}",
        "expires_at": expires_at.isoformat(),
    }


@router.get("/requests")
def list_signing_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all signing requests for this organisation."""
    reqs = db.query(SigningRequest).filter(
        SigningRequest.organisation_id == current_user.organisation_id,
    ).order_by(SigningRequest.created_at.desc()).all()

    now = datetime.now(timezone.utc)
    results = []
    for sr in reqs:
        # Auto-expire
        if sr.status == "pending" and sr.expires_at and sr.expires_at < now:
            sr.status = "expired"
            db.commit()
        results.append({
            "id": sr.id,
            "token": sr.token,
            "doc_type": sr.doc_type,
            "doc_label": sr.doc_label,
            "signer_name": sr.signer_name,
            "signer_email": sr.signer_email,
            "signer_type": sr.signer_type,
            "status": sr.status,
            "created_at": sr.created_at.isoformat() if sr.created_at else None,
            "expires_at": sr.expires_at.isoformat() if sr.expires_at else None,
            "signed_at": sr.signed_at.isoformat() if sr.signed_at else None,
            "signing_url": f"{settings.app_base_url}/sign/{sr.token}",
            "has_signed_pdf": bool(sr.signed_pdf_path),
        })
    return results


@router.delete("/requests/{signing_id}")
def delete_signing_request(
    signing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sr = db.query(SigningRequest).filter(
        SigningRequest.id == signing_id,
        SigningRequest.organisation_id == current_user.organisation_id,
    ).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Not found")
    if sr.signed_pdf_path and os.path.exists(sr.signed_pdf_path):
        os.remove(sr.signed_pdf_path)
    db.delete(sr)
    db.commit()
    return {"ok": True}


@router.get("/requests/{signing_id}/download")
def download_signed_pdf_agent(
    signing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sr = db.query(SigningRequest).filter(
        SigningRequest.id == signing_id,
        SigningRequest.organisation_id == current_user.organisation_id,
    ).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Not found")
    if sr.status != "signed" or not sr.signed_pdf_path:
        raise HTTPException(status_code=400, detail="Document not yet signed")
    if not os.path.exists(sr.signed_pdf_path):
        raise HTTPException(status_code=404, detail="Signed PDF file not found")
    return FileResponse(
        sr.signed_pdf_path,
        media_type="application/pdf",
        filename=f"Signed_{sr.doc_label.replace(' ', '_')}_{sr.signer_name.replace(' ', '_')}.pdf",
    )


# ── Public endpoints (no auth — token is the key) ────────────────────────────

@router.get("/{token}")
def get_signing_request(token: str, db: Session = Depends(get_db)):
    """Public: return document info for the signing page."""
    sr = db.query(SigningRequest).filter(SigningRequest.token == token).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Signing request not found")

    now = datetime.now(timezone.utc)
    if sr.status == "pending" and sr.expires_at and sr.expires_at.replace(tzinfo=timezone.utc) < now:
        sr.status = "expired"
        db.commit()

    org = db.query(Organisation).filter(Organisation.id == sr.organisation_id).first()

    return {
        "id": sr.id,
        "token": sr.token,
        "doc_type": sr.doc_type,
        "doc_label": sr.doc_label,
        "signer_name": sr.signer_name,
        "signer_email": sr.signer_email,
        "status": sr.status,
        "expires_at": sr.expires_at.isoformat() if sr.expires_at else None,
        "signed_at": sr.signed_at.isoformat() if sr.signed_at else None,
        "org_name": org.name if org else "Your agent",
    }


@router.post("/{token}/sign")
async def submit_signature(
    token: str,
    data: SubmitSignature,
    request: Request,
    db: Session = Depends(get_db),
):
    """Public: submit a signature for a pending document."""
    sr = db.query(SigningRequest).filter(SigningRequest.token == token).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Signing request not found")

    now = datetime.now(timezone.utc)

    if sr.status == "signed":
        raise HTTPException(status_code=400, detail="Document has already been signed")
    if sr.status == "declined":
        raise HTTPException(status_code=400, detail="Document was declined")
    if sr.status == "expired" or (sr.expires_at and sr.expires_at.replace(tzinfo=timezone.utc) < now):
        sr.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="This signing link has expired")

    if not data.signature_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid signature data")

    # Capture IP + user agent for audit trail
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    ua = request.headers.get("User-Agent", "unknown")[:500]

    sr.signature_data = data.signature_data
    sr.signed_at = now
    sr.ip_address = ip
    sr.user_agent = ua
    sr.status = "signed"
    db.commit()

    # Generate signed PDF in background
    try:
        pdf_bytes = _generate_signed_pdf(sr, db)
        pdf_path = SIGNED_PDF_DIR / f"{sr.token}.pdf"
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        sr.signed_pdf_path = str(pdf_path)
        db.commit()
        _send_signed_confirmation(sr, "PropAIrty")
    except Exception as e:
        print(f"[signing] PDF generation failed for {sr.token}: {e}")
        # Don't fail the signing — PDF can be regenerated later

    return {
        "ok": True,
        "signed_at": sr.signed_at.isoformat(),
        "download_url": f"{settings.app_base_url}/api/signing/{token}/download",
    }


@router.post("/{token}/decline")
async def decline_signing(token: str, db: Session = Depends(get_db)):
    sr = db.query(SigningRequest).filter(SigningRequest.token == token).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Not found")
    if sr.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot decline — status is {sr.status}")
    sr.status = "declined"
    sr.declined_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.get("/{token}/download")
def download_signed_pdf_public(token: str, db: Session = Depends(get_db)):
    """Public download of signed PDF — token is the auth."""
    sr = db.query(SigningRequest).filter(SigningRequest.token == token).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Not found")
    if sr.status != "signed" or not sr.signed_pdf_path:
        raise HTTPException(status_code=400, detail="Document not yet signed")
    if not os.path.exists(sr.signed_pdf_path):
        raise HTTPException(status_code=404, detail="Signed PDF not found")
    return FileResponse(
        sr.signed_pdf_path,
        media_type="application/pdf",
        filename=f"Signed_{sr.doc_label.replace(' ', '_')}.pdf",
    )
