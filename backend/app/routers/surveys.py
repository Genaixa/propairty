"""
Tenant satisfaction surveys — auto-sent when a maintenance job is closed.
"""
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.maintenance import MaintenanceRequest
from app.models.survey import MaintenanceSurvey
from app.models.tenant import Tenant
from app.models.user import User
from app.routers.auth import get_current_user
from app import emails

router = APIRouter(prefix="/api/surveys", tags=["surveys"])

BASE_URL = "https://propairty.co.uk"


def send_survey(job_id: int, db: Session):
    """Called when a maintenance job is marked completed."""
    job = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == job_id).first()
    if not job or not job.reported_by_tenant_id:
        return

    tenant = db.query(Tenant).filter(Tenant.id == job.reported_by_tenant_id).first()
    if not tenant or not tenant.email:
        return

    # Don't send duplicate
    existing = db.query(MaintenanceSurvey).filter(MaintenanceSurvey.job_id == job_id).first()
    if existing:
        return

    token = secrets.token_urlsafe(32)
    survey = MaintenanceSurvey(
        organisation_id=job.organisation_id,
        job_id=job_id,
        tenant_id=tenant.id,
        token=token,
    )
    db.add(survey)
    db.commit()

    survey_url = f"{BASE_URL}/survey/{token}"
    body = f"""
    <h2>How did we do?</h2>
    <p>Hi {tenant.full_name.split()[0]},</p>
    <p>We've just closed your maintenance request: <strong>{job.title}</strong></p>
    <p>It would mean a lot if you could rate how it was handled — it only takes 10 seconds.</p>
    <div style="text-align:center;margin:24px 0;">
      {"".join(
        f'<a href="{survey_url}?rating={i}" style="display:inline-block;width:48px;height:48px;line-height:48px;'
        f'border-radius:50%;background:#f3f4f6;color:#374151;text-decoration:none;font-size:24px;'
        f'margin:0 4px;font-weight:bold;">{i}</a>'
        for i in range(1, 6)
      )}
      <p style="font-size:11px;color:#9ca3af;margin-top:6px;">1 = poor &nbsp;·&nbsp; 5 = excellent</p>
    </div>
    <p style="font-size:13px;color:#6b7280;">Or <a href="{survey_url}">click here to leave a comment too</a>.</p>
    """
    html = emails._base_template("How did we do?", body, "PropAIrty")
    emails._send_email(tenant.email, "Quick feedback on your maintenance request", html)


@router.get("/respond/{token}", response_class=HTMLResponse)
async def survey_page(token: str, rating: int | None = None, db: Session = Depends(get_db)):
    """Public survey page — no auth needed."""
    survey = db.query(MaintenanceSurvey).filter(MaintenanceSurvey.token == token).first()
    if not survey:
        return HTMLResponse("<h2>Survey not found or already completed.</h2>", status_code=404)

    job = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == survey.job_id).first()

    # If rating passed as query param, auto-submit
    if rating and 1 <= rating <= 5 and not survey.rating:
        survey.rating = rating
        survey.responded_at = datetime.now(timezone.utc)
        db.commit()

    stars = survey.rating or rating or 0

    return HTMLResponse(f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maintenance Feedback</title>
<style>
  body{{font-family:-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:20px;color:#111;}}
  h1{{font-size:22px;font-weight:700;}}
  .stars{{display:flex;gap:8px;justify-content:center;margin:24px 0;}}
  .star{{font-size:40px;cursor:pointer;transition:transform .1s;}}
  .star.selected{{transform:scale(1.2);}}
  textarea{{width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:14px;resize:none;box-sizing:border-box;}}
  button{{width:100%;background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px;}}
  .thanks{{text-align:center;padding:32px 0;}}
  .logo{{color:#4f46e5;font-weight:800;font-size:20px;margin-bottom:24px;}}
</style>
</head>
<body>
<div class="logo">Prop<span style="color:#111">AI</span>rty</div>
{"<div class='thanks'><div style='font-size:48px'>⭐</div><h2>Thank you for your feedback!</h2><p style='color:#6b7280;'>Your response has been recorded.</p></div>"
 if survey.responded_at else f"""
<h1>How did we handle your request?</h1>
<p style="color:#6b7280;font-size:14px;">{job.title if job else 'Maintenance request'}</p>
<form method="POST" action="/api/surveys/submit/{token}">
  <div class="stars" id="stars">
    {''.join(f'<span class="star {"selected" if i <= stars else ""}" data-v="{i}" onclick="pick({i})">{"⭐" if i <= stars else "☆"}</span>' for i in range(1,6))}
  </div>
  <input type="hidden" name="rating" id="ratingInput" value="{stars}">
  <textarea name="comment" rows="3" placeholder="Any comments? (optional)"></textarea>
  <button type="submit">Submit feedback</button>
</form>
<script>
function pick(v){{
  document.getElementById('ratingInput').value=v;
  document.querySelectorAll('.star').forEach((s,i)=>{{
    s.textContent=i<v?'⭐':'☆';
    s.classList.toggle('selected',i<v);
  }});
}}
</script>"""}
</body></html>""")


class SurveySubmit(BaseModel):
    rating: int
    comment: str = ""


@router.post("/submit/{token}")
async def submit_survey(token: str, request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    rating = int(form.get("rating", 0))
    comment = form.get("comment", "")

    survey = db.query(MaintenanceSurvey).filter(MaintenanceSurvey.token == token).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    if survey.responded_at:
        return HTMLResponse("<h2>Already submitted — thank you!</h2>")

    if rating and 1 <= rating <= 5:
        survey.rating = rating
        survey.comment = comment
        survey.responded_at = datetime.now(timezone.utc)
        db.commit()

    from fastapi.responses import RedirectResponse
    return RedirectResponse(f"/api/surveys/respond/{token}", status_code=303)


@router.get("")
def list_surveys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    surveys = db.query(MaintenanceSurvey).filter(
        MaintenanceSurvey.organisation_id == current_user.organisation_id,
        MaintenanceSurvey.responded_at != None,
    ).order_by(MaintenanceSurvey.responded_at.desc()).all()

    result = []
    for s in surveys:
        job = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == s.job_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == s.tenant_id).first()
        result.append({
            "id": s.id,
            "rating": s.rating,
            "comment": s.comment,
            "responded_at": s.responded_at.isoformat() if s.responded_at else None,
            "job_title": job.title if job else "",
            "tenant_name": tenant.full_name if tenant else "",
        })

    ratings = [s["rating"] for s in result if s["rating"]]
    avg = round(sum(ratings) / len(ratings), 1) if ratings else None

    return {
        "average_rating": avg,
        "total_responses": len(ratings),
        "total_sent": db.query(MaintenanceSurvey).filter(
            MaintenanceSurvey.organisation_id == current_user.organisation_id
        ).count(),
        "surveys": result,
    }
