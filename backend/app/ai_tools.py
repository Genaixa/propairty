"""
Tool implementations for the PropAIrty AI assistant.
Each function takes (db, org_id, **kwargs) and returns a dict.
"""
from sqlalchemy.orm import Session, joinedload
from datetime import date, timedelta
from app.models.property import Property
from app.models.unit import Unit
from app.models.tenant import Tenant
from app.models.lease import Lease
from app.models.maintenance import MaintenanceRequest
from app.models.payment import RentPayment
from app.models.compliance import ComplianceCertificate, CERT_TYPES


def get_dashboard_stats(db: Session, org_id: int, **_):
    properties = db.query(Property).filter(Property.organisation_id == org_id).count()
    units = db.query(Unit).join(Property).filter(Property.organisation_id == org_id).count()
    occupied = db.query(Unit).join(Property).filter(Property.organisation_id == org_id, Unit.status == "occupied").count()
    tenants = db.query(Tenant).filter(Tenant.organisation_id == org_id).count()
    active_leases = db.query(Lease).join(Unit).join(Property).filter(Property.organisation_id == org_id, Lease.status == "active").all()
    open_maint = db.query(MaintenanceRequest).join(Unit).join(Property).filter(
        Property.organisation_id == org_id, MaintenanceRequest.status.in_(["open", "in_progress"])
    ).count()
    rent_roll = sum(l.monthly_rent for l in active_leases)
    return {
        "properties": properties, "units": units, "occupied": occupied,
        "vacant": units - occupied, "occupancy_rate": f"{round(occupied/units*100,1)}%" if units else "0%",
        "tenants": tenants, "active_leases": len(active_leases),
        "open_maintenance": open_maint, "monthly_rent_roll": f"£{rent_roll:,.2f}"
    }


def list_properties(db: Session, org_id: int, **_):
    props = db.query(Property).options(joinedload(Property.units)).filter(Property.organisation_id == org_id).all()
    return [
        {
            "id": p.id, "name": p.name,
            "address": f"{p.address_line1}, {p.city}, {p.postcode}",
            "type": p.property_type,
            "units": [{"id": u.id, "name": u.name, "rent": f"£{u.monthly_rent}/mo", "status": u.status, "bedrooms": u.bedrooms} for u in p.units]
        }
        for p in props
    ]


def list_tenants(db: Session, org_id: int, search: str = "", **_):
    q = db.query(Tenant).filter(Tenant.organisation_id == org_id)
    if search:
        q = q.filter(Tenant.full_name.ilike(f"%{search}%"))
    tenants = q.all()
    result = []
    for t in tenants:
        active = db.query(Lease).filter(Lease.tenant_id == t.id, Lease.status == "active").first()
        unit_info = None
        if active:
            unit = db.query(Unit).join(Property).filter(Unit.id == active.unit_id).first()
            if unit:
                unit_info = f"{unit.property.name} · {unit.name}"
        result.append({
            "id": t.id, "name": t.full_name, "email": t.email, "phone": t.phone,
            "current_unit": unit_info, "active_lease_id": active.id if active else None
        })
    return result


def list_leases(db: Session, org_id: int, status: str = "active", expiring_within_days: int = None, **_):
    q = db.query(Lease).join(Unit).join(Property).filter(Property.organisation_id == org_id)
    if status:
        q = q.filter(Lease.status == status)
    if expiring_within_days:
        cutoff = date.today() + timedelta(days=expiring_within_days)
        q = q.filter(Lease.end_date <= cutoff, Lease.end_date >= date.today())
    leases = q.all()
    result = []
    for l in leases:
        tenant = db.query(Tenant).filter(Tenant.id == l.tenant_id).first()
        unit = db.query(Unit).join(Property).filter(Unit.id == l.unit_id).first()
        result.append({
            "id": l.id,
            "tenant": tenant.full_name if tenant else "Unknown",
            "tenant_email": tenant.email if tenant else None,
            "unit": f"{unit.property.name} · {unit.name}" if unit else "Unknown",
            "start": str(l.start_date), "end": str(l.end_date) if l.end_date else "Periodic",
            "rent": f"£{l.monthly_rent}/mo", "deposit": f"£{l.deposit}" if l.deposit else None,
            "status": l.status, "periodic": l.is_periodic
        })
    return result


def list_maintenance(db: Session, org_id: int, status: str = None, **_):
    q = db.query(MaintenanceRequest).join(Unit).join(Property).filter(Property.organisation_id == org_id)
    if status:
        q = q.filter(MaintenanceRequest.status == status)
    reqs = q.order_by(MaintenanceRequest.created_at.desc()).all()
    result = []
    for r in reqs:
        unit = db.query(Unit).join(Property).filter(Unit.id == r.unit_id).first()
        result.append({
            "id": r.id, "title": r.title, "description": r.description,
            "unit": f"{unit.property.name} · {unit.name}" if unit else "Unknown",
            "priority": r.priority, "status": r.status,
            "reported_by": r.reported_by, "assigned_to": r.assigned_to
        })
    return result


def create_maintenance_request(db: Session, org_id: int, unit_id: int, title: str,
                                description: str = "", priority: str = "medium",
                                reported_by: str = "", **_):
    unit = db.query(Unit).join(Property).filter(Unit.id == unit_id, Property.organisation_id == org_id).first()
    if not unit:
        return {"error": "Unit not found or not in your organisation"}
    req = MaintenanceRequest(unit_id=unit_id, title=title, description=description,
                             priority=priority, reported_by=reported_by, status="open")
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"created": True, "id": req.id, "title": title, "unit": f"{unit.property.name} · {unit.name}", "priority": priority}


def list_compliance(db: Session, org_id: int, status: str = None, **_):
    """List compliance certificates, optionally filtered by status: valid, expiring_soon, expired, missing."""
    from datetime import date, timedelta
    today = date.today()
    warn = today + timedelta(days=60)

    certs = db.query(ComplianceCertificate).join(Property).filter(
        Property.organisation_id == org_id
    ).order_by(ComplianceCertificate.expiry_date).all()

    result = []
    for c in certs:
        if c.expiry_date < today:
            s = "expired"
        elif c.expiry_date <= warn:
            s = "expiring_soon"
        else:
            s = "valid"
        if status and s != status:
            continue
        result.append({
            "property": c.property.name if c.property else "Unknown",
            "cert_type": CERT_TYPES.get(c.cert_type, {}).get("label", c.cert_type),
            "expiry_date": str(c.expiry_date),
            "days_until_expiry": (c.expiry_date - today).days,
            "status": s,
            "contractor": c.contractor,
        })

    total_expired = sum(1 for r in result if r["status"] == "expired")
    total_expiring = sum(1 for r in result if r["status"] == "expiring_soon")
    return {"certificates": result, "expired": total_expired, "expiring_soon": total_expiring}


def list_arrears(db: Session, org_id: int, **_):
    """List all overdue/partial rent payments with tenant and unit info."""
    payments = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        Property.organisation_id == org_id,
        RentPayment.status.in_(["overdue", "partial"])
    ).order_by(RentPayment.due_date).all()
    result = []
    total_owed = 0
    for p in payments:
        lease = db.query(Lease).filter(Lease.id == p.lease_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == lease.tenant_id).first() if lease else None
        unit = db.query(Unit).join(Property).filter(Unit.id == lease.unit_id).first() if lease else None
        owed = p.amount_due - (p.amount_paid or 0)
        total_owed += owed
        result.append({
            "tenant": tenant.full_name if tenant else "Unknown",
            "tenant_phone": tenant.phone if tenant else None,
            "unit": f"{unit.property.name} · {unit.name}" if unit else "Unknown",
            "due_date": str(p.due_date),
            "amount_due": f"£{p.amount_due}",
            "amount_owed": f"£{owed:.2f}",
            "status": p.status,
            "days_overdue": (date.today() - p.due_date).days
        })
    return {"arrears": result, "total_owed": f"£{total_owed:.2f}", "count": len(result)}


def draft_letter(db: Session, org_id: int, letter_type: str, tenant_id: int = None,
                 lease_id: int = None, custom_notes: str = "", **_):
    """Returns a plain-text draft letter. Actual text generation done by Claude in the system prompt."""
    context = {"letter_type": letter_type, "custom_notes": custom_notes}
    if tenant_id:
        t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organisation_id == org_id).first()
        if t:
            context["tenant_name"] = t.full_name
            context["tenant_email"] = t.email
            active = db.query(Lease).filter(Lease.tenant_id == t.id, Lease.status == "active").first()
            if active:
                unit = db.query(Unit).join(Property).filter(Unit.id == active.unit_id).first()
                if unit:
                    context["unit"] = f"{unit.property.name} · {unit.name}"
                    context["address"] = f"{unit.property.address_line1}, {unit.property.city}, {unit.property.postcode}"
                    context["rent"] = f"£{active.monthly_rent}"
                    context["lease_start"] = str(active.start_date)
                    context["lease_end"] = str(active.end_date) if active.end_date else "Periodic"
    return context


def send_arrears_reminder(db: Session, org_id: int, tenant_name: str, **_):
    """Send a rent arrears reminder email to a named tenant."""
    from app.emails import _send_email, _base_template

    # Find tenant by name (case-insensitive)
    tenant = (db.query(Tenant)
              .filter(Tenant.organisation_id == org_id,
                      Tenant.full_name.ilike(f"%{tenant_name}%"))
              .first())
    if not tenant:
        return {"success": False, "error": f"Tenant '{tenant_name}' not found."}
    if not tenant.email:
        return {"success": False, "error": f"{tenant.full_name} has no email address on record."}

    # Find overdue payment
    lease = db.query(Lease).filter(Lease.tenant_id == tenant.id, Lease.status == "active").first()
    payment = (db.query(RentPayment)
               .filter(RentPayment.tenant_id == tenant.id, RentPayment.status == "overdue")
               .order_by(RentPayment.due_date)
               .first())
    if not payment:
        return {"success": False, "error": f"No overdue payments found for {tenant.full_name}."}

    from app.models.organisation import Organisation
    org = db.query(Organisation).filter_by(id=org_id).first()
    org_name = org.name if org else "Your Letting Agent"
    days_overdue = (date.today() - payment.due_date).days

    unit = db.query(Unit).filter(Unit.id == lease.unit_id).first() if lease else None
    prop = unit.property if unit else None
    prop_str = f"{prop.name}, {unit.name}" if prop and unit else "your property"

    body = f"""
    <h2>Rent payment overdue</h2>
    <p>Dear {tenant.full_name},</p>
    <p>We write to inform you that your rent payment of <strong>£{payment.amount_due:.2f}</strong>
    was due on <strong>{payment.due_date.strftime('%d %B %Y')}</strong> and remains outstanding
    ({days_overdue} day{'s' if days_overdue != 1 else ''} overdue).</p>
    <p>Please arrange payment immediately to avoid further action.</p>
    <p>If you have already made payment or are experiencing difficulties, please contact us as soon as possible.</p>
    <a href="https://propairty.co.uk/tenant/portal" class="cta">Pay via tenant portal</a>
    """
    subject = f"Overdue rent reminder — £{payment.amount_due:.0f} ({days_overdue} days overdue)"
    sent = _send_email(tenant.email, subject, _base_template(subject, body, org_name))
    if sent:
        return {"success": True, "message": f"Reminder sent to {tenant.full_name} at {tenant.email}."}
    return {"success": False, "error": "Email send failed — check SMTP settings."}
