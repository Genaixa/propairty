import calendar
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ppm import PPMSchedule
from app.models.property import Property
from app.models.unit import Unit
from app.models.maintenance import MaintenanceRequest
from app.models.contractor import Contractor

router = APIRouter(prefix="/api/ppm", tags=["ppm"])

FREQUENCIES = {"weekly", "monthly", "quarterly", "biannual", "annual"}


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _advance(d: date, frequency: str) -> date:
    if frequency == "weekly":
        return d + timedelta(weeks=1)
    elif frequency == "monthly":
        return _add_months(d, 1)
    elif frequency == "quarterly":
        return _add_months(d, 3)
    elif frequency == "biannual":
        return _add_months(d, 6)
    elif frequency == "annual":
        return _add_months(d, 12)
    return _add_months(d, 1)


def run_ppm_check(db: Session):
    """Run from the daily cron job. Fires due PPM schedules as maintenance requests."""
    today = date.today()
    schedules = (
        db.query(PPMSchedule)
        .filter(PPMSchedule.is_active == True, PPMSchedule.next_due <= today)
        .all()
    )
    for s in schedules:
        # Idempotency: skip if already triggered for this due date
        if s.last_triggered and s.last_triggered >= s.next_due:
            continue

        # Resolve unit — fall back to first unit of the property
        unit_id = s.unit_id
        property_id = s.property_id
        if not unit_id:
            unit = db.query(Unit).filter(Unit.property_id == property_id).first()
            unit_id = unit.id if unit else None

        if unit_id:
            job = MaintenanceRequest(
                organisation_id=s.organisation_id,
                property_id=property_id,
                unit_id=unit_id,
                title=f"[PPM] {s.title}",
                description=s.description or f"Planned preventative maintenance: {s.title}",
                priority="medium",
                status="open",
                reported_by="PPM Scheduler",
                contractor_id=s.contractor_id,
            )
            db.add(job)

        s.last_triggered = today
        s.next_due = _advance(s.next_due, s.frequency)

    db.commit()


# --- CRUD ---

def _get_agent_org(token: str, db: Session) -> int:
    """Reuse agent auth pattern — returns organisation_id."""
    from app.config import settings
    from app.models.user import User
    from jose import JWTError, jwt
    from fastapi.security import OAuth2PasswordBearer
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.organisation_id


from fastapi.security import OAuth2PasswordBearer
_agent_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_org(token: str = Depends(_agent_oauth2), db: Session = Depends(get_db)) -> int:
    return _get_agent_org(token, db)


class PPMIn(BaseModel):
    property_id: int
    unit_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    frequency: str
    next_due: date
    contractor_id: Optional[int] = None
    is_active: bool = True


class PPMOut(BaseModel):
    id: int
    property_id: int
    property_name: Optional[str] = None
    unit_id: Optional[int] = None
    unit_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    frequency: str
    next_due: date
    last_triggered: Optional[date] = None
    contractor_id: Optional[int] = None
    contractor_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


@router.get("", response_model=list[PPMOut])
def list_schedules(org_id: int = Depends(get_org), db: Session = Depends(get_db)):
    schedules = db.query(PPMSchedule).filter(PPMSchedule.organisation_id == org_id).order_by(PPMSchedule.next_due.asc()).all()
    result = []
    for s in schedules:
        prop = db.query(Property).filter(Property.id == s.property_id).first()
        unit = db.query(Unit).filter(Unit.id == s.unit_id).first() if s.unit_id else None
        contractor = db.query(Contractor).filter(Contractor.id == s.contractor_id).first() if s.contractor_id else None
        result.append(PPMOut(
            id=s.id,
            property_id=s.property_id,
            property_name=prop.name if prop else None,
            unit_id=s.unit_id,
            unit_name=unit.name if unit else None,
            title=s.title,
            description=s.description,
            frequency=s.frequency,
            next_due=s.next_due,
            last_triggered=s.last_triggered,
            contractor_id=s.contractor_id,
            contractor_name=contractor.name if contractor else None,
            is_active=s.is_active,
        ))
    return result


@router.post("", response_model=PPMOut, status_code=201)
def create_schedule(req: PPMIn, org_id: int = Depends(get_org), db: Session = Depends(get_db)):
    if req.frequency not in FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"frequency must be one of {sorted(FREQUENCIES)}")
    prop = db.query(Property).filter(Property.id == req.property_id, Property.organisation_id == org_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    s = PPMSchedule(
        organisation_id=org_id,
        property_id=req.property_id,
        unit_id=req.unit_id,
        title=req.title,
        description=req.description,
        frequency=req.frequency,
        next_due=req.next_due,
        contractor_id=req.contractor_id,
        is_active=req.is_active,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    contractor = db.query(Contractor).filter(Contractor.id == s.contractor_id).first() if s.contractor_id else None
    unit = db.query(Unit).filter(Unit.id == s.unit_id).first() if s.unit_id else None
    return PPMOut(
        id=s.id, property_id=s.property_id, property_name=prop.name,
        unit_id=s.unit_id, unit_name=unit.name if unit else None,
        title=s.title, description=s.description, frequency=s.frequency,
        next_due=s.next_due, last_triggered=s.last_triggered,
        contractor_id=s.contractor_id, contractor_name=contractor.name if contractor else None,
        is_active=s.is_active,
    )


@router.put("/{schedule_id}", response_model=PPMOut)
def update_schedule(schedule_id: int, req: PPMIn, org_id: int = Depends(get_org), db: Session = Depends(get_db)):
    s = db.query(PPMSchedule).filter(PPMSchedule.id == schedule_id, PPMSchedule.organisation_id == org_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if req.frequency not in FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"frequency must be one of {sorted(FREQUENCIES)}")
    s.property_id = req.property_id
    s.unit_id = req.unit_id
    s.title = req.title
    s.description = req.description
    s.frequency = req.frequency
    s.next_due = req.next_due
    s.contractor_id = req.contractor_id
    s.is_active = req.is_active
    db.commit()
    db.refresh(s)
    prop = db.query(Property).filter(Property.id == s.property_id).first()
    unit = db.query(Unit).filter(Unit.id == s.unit_id).first() if s.unit_id else None
    contractor = db.query(Contractor).filter(Contractor.id == s.contractor_id).first() if s.contractor_id else None
    return PPMOut(
        id=s.id, property_id=s.property_id, property_name=prop.name if prop else None,
        unit_id=s.unit_id, unit_name=unit.name if unit else None,
        title=s.title, description=s.description, frequency=s.frequency,
        next_due=s.next_due, last_triggered=s.last_triggered,
        contractor_id=s.contractor_id, contractor_name=contractor.name if contractor else None,
        is_active=s.is_active,
    )


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, org_id: int = Depends(get_org), db: Session = Depends(get_db)):
    s = db.query(PPMSchedule).filter(PPMSchedule.id == schedule_id, PPMSchedule.organisation_id == org_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(s)
    db.commit()
