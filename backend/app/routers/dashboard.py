from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.property import Property
from app.models.unit import Unit
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.maintenance import MaintenanceRequest
from app.models.payment import RentPayment
from app.models.compliance import ComplianceCertificate
from app.models.deposit import TenancyDeposit
from app.models.inspection import Inspection
from app.models.applicant import Applicant
from app.models.ppm import PPMSchedule
from sqlalchemy import desc

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("")
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = current_user.organisation_id

    properties = db.query(Property).filter(Property.organisation_id == org_id).count()
    units = db.query(Unit).join(Property).filter(Property.organisation_id == org_id).count()
    occupied = db.query(Unit).join(Property).filter(Property.organisation_id == org_id, Unit.status == "occupied").count()
    tenants = db.query(Tenant).filter(Tenant.organisation_id == org_id).count()
    active_leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id, Lease.status == "active"
    ).count()
    open_maintenance = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == org_id, MaintenanceRequest.status.in_(["open", "in_progress"])
    ).count()

    monthly_income = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id, Lease.status == "active"
    ).all()
    total_rent = sum(l.monthly_rent for l in monthly_income)
    occupancy_rate = round((occupied / units * 100) if units > 0 else 0, 1)

    # Arrears
    arrears_payments = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        RentPayment.status.in_(["overdue", "partial"])
    ).all()
    arrears_count = len(arrears_payments)
    arrears_total = sum((p.amount_due - (p.amount_paid or 0)) for p in arrears_payments)

    # Leases expiring within 60 days
    today = date.today()
    from datetime import timedelta
    cutoff = today + timedelta(days=60)
    expiring_soon = db.query(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Lease.status == "active",
        Lease.end_date != None,
        Lease.end_date <= cutoff,
        Lease.end_date >= today
    ).count()

    # Applicants pipeline
    applicants_active = db.query(Applicant).filter(
        Applicant.organisation_id == org_id,
        Applicant.status.notin_(["rejected", "withdrawn", "tenancy_created"])
    ).count()
    applicants_referencing = db.query(Applicant).filter(
        Applicant.organisation_id == org_id,
        Applicant.referencing_status.in_(["in_progress", "not_started"]),
        Applicant.status.notin_(["rejected", "withdrawn", "tenancy_created"])
    ).count()

    # Deposits compliance
    deposits_unprotected = db.query(TenancyDeposit).filter(
        TenancyDeposit.organisation_id == org_id,
        TenancyDeposit.status == "unprotected"
    ).count()
    deposits_pi_outstanding = db.query(TenancyDeposit).filter(
        TenancyDeposit.organisation_id == org_id,
        TenancyDeposit.status == "protected"
    ).count()

    # Upcoming inspections (next 14 days)
    from datetime import timedelta as td2
    today_d = date.today()

    # PPM overdue / due soon
    ppm_overdue = db.query(PPMSchedule).join(Property).filter(
        Property.organisation_id == org_id,
        PPMSchedule.is_active == True,
        PPMSchedule.next_due < today_d
    ).count()
    ppm_due_soon = db.query(PPMSchedule).join(Property).filter(
        Property.organisation_id == org_id,
        PPMSchedule.is_active == True,
        PPMSchedule.next_due >= today_d,
        PPMSchedule.next_due <= today_d + td2(days=30)
    ).count()
    inspections_upcoming = db.query(Inspection).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Inspection.status == "scheduled",
        Inspection.scheduled_date >= today_d,
        Inspection.scheduled_date <= today_d + td2(days=14)
    ).count()
    inspections_overdue = db.query(Inspection).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        Inspection.status == "scheduled",
        Inspection.scheduled_date < today_d
    ).count()

    # Compliance alerts
    today = date.today()
    compliance_expired = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == org_id,
        ComplianceCertificate.expiry_date < today
    ).count()
    compliance_expiring = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == org_id,
        ComplianceCertificate.expiry_date >= today,
        ComplianceCertificate.expiry_date <= today + timedelta(days=60)
    ).count()

    # Recent open/in_progress maintenance requests (last 8)
    recent_maintenance = (
        db.query(MaintenanceRequest)
        .join(Unit)
        .join(Property)
        .filter(
            Property.organisation_id == org_id,
            MaintenanceRequest.status.in_(["open", "in_progress"])
        )
        .order_by(desc(MaintenanceRequest.created_at))
        .limit(8)
        .all()
    )
    recent_maintenance_list = []
    for m in recent_maintenance:
        unit = m.unit
        prop = unit.property if unit else None
        recent_maintenance_list.append({
            "id": m.id,
            "title": m.title,
            "status": m.status,
            "priority": m.priority,
            "property": prop.name if prop else "—",
            "unit": unit.name if unit else "—",
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {
        "properties": properties,
        "units": units,
        "occupied_units": occupied,
        "vacant_units": units - occupied,
        "occupancy_rate": occupancy_rate,
        "tenants": tenants,
        "active_leases": active_leases,
        "open_maintenance": open_maintenance,
        "monthly_rent_roll": round(total_rent, 2),
        "arrears_count": arrears_count,
        "arrears_total": round(arrears_total, 2),
        "leases_expiring_soon": expiring_soon,
        "compliance_expired": compliance_expired,
        "compliance_expiring_soon": compliance_expiring,
        "recent_maintenance": recent_maintenance_list,
        "applicants_active": applicants_active,
        "applicants_referencing": applicants_referencing,
        "deposits_unprotected": deposits_unprotected,
        "deposits_pi_outstanding": deposits_pi_outstanding,
        "inspections_upcoming": inspections_upcoming,
        "inspections_overdue": inspections_overdue,
        "ppm_overdue": ppm_overdue,
        "ppm_due_soon": ppm_due_soon,
    }
