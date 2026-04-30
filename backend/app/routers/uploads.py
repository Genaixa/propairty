import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.upload import UploadedFile
from app import notifications

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path("/root/propairty/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB (videos)

ALLOWED_MIME_PREFIXES = [
    "image/", "video/", "audio/",
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument",
    "text/plain", "application/zip",
]

CATEGORIES = ["certificate", "agreement", "photo", "invoice", "correspondence", "other"]
ENTITY_TYPES = ["property", "unit", "tenant", "lease", "inspection", "maintenance", "landlord", "contractor", "insurance_claim", "inventory_room", "compliance_certificate"]


def _is_allowed(mime: str) -> bool:
    if not mime:
        return False
    return any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES)


def _file_out(f: UploadedFile) -> dict:
    return {
        "id": f.id,
        "entity_type": f.entity_type,
        "entity_id": f.entity_id,
        "original_name": f.original_name,
        "mime_type": f.mime_type,
        "file_size": f.file_size,
        "category": f.category,
        "description": f.description,
        "url": f"/uploads/{f.filename}",
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.post("")
async def upload_file(
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    category: str = Form("other"),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if entity_type not in ENTITY_TYPES:
        raise HTTPException(status_code=400, detail=f"entity_type must be one of {ENTITY_TYPES}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")

    if not _is_allowed(file.content_type):
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Store with uuid filename to avoid collisions
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / stored_name
    dest.write_bytes(content)

    record = UploadedFile(
        organisation_id=current_user.organisation_id,
        entity_type=entity_type,
        entity_id=entity_id,
        filename=stored_name,
        original_name=file.filename or stored_name,
        mime_type=file.content_type,
        file_size=len(content),
        category=category,
        description=description,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Invalidate brochure cache when property photos/files change
    if entity_type == "property":
        from app.brochure import invalidate_brochure_cache
        invalidate_brochure_cache(entity_id)

    # Forward maintenance attachments to Telegram
    if entity_type == "maintenance":
        from app.models.maintenance import MaintenanceRequest
        req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == entity_id).first()
        caption = f"📎 <b>Attachment</b> — {file.filename or 'file'}"
        if req:
            caption = f"📎 <b>{req.title}</b>\n{file.filename or 'file'}"
        file_path = str(UPLOAD_DIR / stored_name)
        mime = file.content_type or ""
        if mime.startswith("image/"):
            notifications.send_photo(file_path, caption)
        elif mime.startswith("video/"):
            notifications.send_video(file_path, caption)
        elif mime.startswith("audio/"):
            notifications.send_audio(file_path, caption)

    return _file_out(record)


@router.get("")
def list_files(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    files = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.organisation_id == current_user.organisation_id,
            UploadedFile.entity_type == entity_type,
            UploadedFile.entity_id == entity_id,
        )
        .order_by(UploadedFile.created_at.desc())
        .all()
    )
    return [_file_out(f) for f in files]


@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Download a file. Accepts auth via Bearer header OR ?token= query param (needed for <a href> links)."""
    from app.config import settings
    from jose import jwt, JWTError

    org_id = None

    from fastapi import Request
    if token:
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            token_type = payload.get("type")
            if token_type == "tenant":
                from app.models.tenant import Tenant as TenantModel
                tenant_id = int(payload.get("sub"))
                tenant = db.query(TenantModel).filter(TenantModel.id == tenant_id).first()
                if tenant:
                    org_id = tenant.organisation_id
            elif token_type == "landlord":
                from app.models.landlord import Landlord
                landlord_id = int(payload.get("sub"))
                landlord = db.query(Landlord).filter(Landlord.id == landlord_id).first()
                if landlord:
                    org_id = landlord.organisation_id
            else:
                user_id = int(payload.get("sub"))
                user = db.query(User).filter(User.id == user_id).first()
                if user and user.is_active:
                    org_id = user.organisation_id
        except (JWTError, Exception):
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if org_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    record = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organisation_id == org_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    path = UPLOAD_DIR / record.filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(path),
        media_type=record.mime_type or "application/octet-stream",
        filename=record.original_name,
    )


@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(UploadedFile).filter(
        UploadedFile.id == file_id,
        UploadedFile.organisation_id == current_user.organisation_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    # Invalidate brochure cache when property file is removed
    if record.entity_type == "property":
        from app.brochure import invalidate_brochure_cache
        invalidate_brochure_cache(record.entity_id)

    path = UPLOAD_DIR / record.filename
    if path.exists():
        path.unlink()

    db.delete(record)
    db.commit()
    return {"ok": True}
