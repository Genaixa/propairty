from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.schemas.tenant import TenantCreate, TenantOut

router = APIRouter(prefix="/api/tenants", tags=["tenants"])

@router.get("", response_model=List[TenantOut])
def list_tenants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Tenant).filter(Tenant.organisation_id == current_user.organisation_id).all()

@router.post("", response_model=TenantOut)
def create_tenant(data: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = Tenant(**data.model_dump(), organisation_id=current_user.organisation_id)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant

@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/{tenant_id}", response_model=TenantOut)
def update_tenant(tenant_id: int, data: TenantCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    for k, v in data.model_dump().items():
        setattr(tenant, k, v)
    db.commit()
    db.refresh(tenant)
    return tenant

@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == current_user.organisation_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    active = db.query(Lease).filter(Lease.tenant_id == tenant_id, Lease.status == "active").first()
    if active:
        raise HTTPException(status_code=400, detail="Cannot delete tenant with an active lease. End the lease first.")
    db.delete(tenant)
    db.commit()
    return {"ok": True}
