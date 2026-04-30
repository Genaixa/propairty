from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.valuation import PropertyValuation
from app.models.property import Property
from app.models.unit import Unit
from app.models.lease import Lease
from app.models.maintenance import MaintenanceRequest

router = APIRouter(prefix="/api/valuation", tags=["valuation"])


class ValuationIn(BaseModel):
    estimated_value: float
    valuation_date: date
    source: Optional[str] = "manual"
    notes: Optional[str] = None


def _property_rent(prop_id: int, db: Session) -> float:
    """Sum monthly_rent of all active leases for units in this property."""
    units = db.query(Unit).filter(Unit.property_id == prop_id).all()
    unit_ids = [u.id for u in units]
    if not unit_ids:
        return 0.0
    leases = db.query(Lease).filter(
        Lease.unit_id.in_(unit_ids),
        Lease.status == "active",
    ).all()
    return sum(l.monthly_rent for l in leases)


def _annual_maintenance(prop_id: int, db: Session) -> float:
    """Sum actual_cost of maintenance jobs in last 12 months for this property."""
    cutoff = date.today() - timedelta(days=365)
    rows = db.query(func.coalesce(func.sum(MaintenanceRequest.actual_cost), 0)).filter(
        MaintenanceRequest.property_id == prop_id,
        MaintenanceRequest.actual_cost.isnot(None),
        MaintenanceRequest.created_at >= cutoff,
    ).scalar()
    return float(rows or 0)


def _yield(annual_rent: float, annual_cost: float, value: float, net: bool = False) -> Optional[float]:
    if not value:
        return None
    income = annual_rent - annual_cost if net else annual_rent
    return round((income / value) * 100, 2)


@router.get("")
def portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.organisation_id
    properties = db.query(Property).filter(Property.organisation_id == org_id).all()

    items = []
    total_value = 0.0
    total_annual_rent = 0.0
    total_annual_maintenance = 0.0

    for prop in properties:
        # Latest valuation
        latest = (
            db.query(PropertyValuation)
            .filter(
                PropertyValuation.property_id == prop.id,
                PropertyValuation.organisation_id == org_id,
            )
            .order_by(PropertyValuation.valuation_date.desc())
            .first()
        )

        monthly_rent = _property_rent(prop.id, db)
        annual_rent = monthly_rent * 12
        annual_maintenance = _annual_maintenance(prop.id, db)

        value = latest.estimated_value if latest else None
        gross_yield = _yield(annual_rent, 0, value) if value else None
        net_yield = _yield(annual_rent, annual_maintenance, value, net=True) if value else None

        # Unit counts
        units = db.query(Unit).filter(Unit.property_id == prop.id).all()
        occupied = sum(1 for u in units if u.status == "occupied")

        items.append({
            "property_id": prop.id,
            "name": prop.name,
            "address": f"{prop.address_line1}, {prop.city}",
            "postcode": prop.postcode,
            "property_type": prop.property_type,
            "unit_count": len(units),
            "occupied_count": occupied,
            "monthly_rent": round(monthly_rent, 2),
            "annual_rent": round(annual_rent, 2),
            "annual_maintenance": round(annual_maintenance, 2),
            "estimated_value": value,
            "gross_yield": gross_yield,
            "net_yield": net_yield,
            "valuation_date": latest.valuation_date.isoformat() if latest else None,
            "valuation_source": latest.source if latest else None,
            "valuation_notes": latest.notes if latest else None,
            "latest_valuation_id": latest.id if latest else None,
        })

        if value:
            total_value += value
            total_annual_rent += annual_rent
            total_annual_maintenance += annual_maintenance

    valued_count = sum(1 for i in items if i["estimated_value"])
    # Weighted by value rather than a simple average of per-property yields
    avg_gross = (
        round((total_annual_rent / total_value) * 100, 2)
        if total_value else None
    )
    avg_net = (
        round(((total_annual_rent - total_annual_maintenance) / total_value) * 100, 2)
        if total_value else None
    )

    return {
        "summary": {
            "total_value": round(total_value, 2),
            "total_annual_rent": round(total_annual_rent, 2),
            "total_annual_maintenance": round(total_annual_maintenance, 2),
            "total_net_income": round(total_annual_rent - total_annual_maintenance, 2),
            "avg_gross_yield": avg_gross,
            "avg_net_yield": avg_net,
            "property_count": len(properties),
            "valued_count": valued_count,
        },
        "properties": items,
    }


@router.get("/history/{property_id}")
def valuation_history(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    rows = (
        db.query(PropertyValuation)
        .filter(
            PropertyValuation.property_id == property_id,
            PropertyValuation.organisation_id == current_user.organisation_id,
        )
        .order_by(PropertyValuation.valuation_date.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "estimated_value": r.estimated_value,
            "valuation_date": r.valuation_date.isoformat(),
            "source": r.source,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/{property_id}")
def add_valuation(
    property_id: int,
    data: ValuationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organisation_id == current_user.organisation_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    v = PropertyValuation(
        organisation_id=current_user.organisation_id,
        property_id=property_id,
        estimated_value=data.estimated_value,
        valuation_date=data.valuation_date,
        source=data.source,
        notes=data.notes,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": v.id, "ok": True}


@router.delete("/{valuation_id}")
def delete_valuation(
    valuation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    v = db.query(PropertyValuation).filter(
        PropertyValuation.id == valuation_id,
        PropertyValuation.organisation_id == current_user.organisation_id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(v)
    db.commit()
    return {"ok": True}
