# PropAIrty

AI-powered property management platform for letting agents, landlords, contractors and tenants.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy · Alembic |
| Database | PostgreSQL (production) · SQLite (local dev) |
| Frontend | React 18 · Vite · Tailwind CSS |
| Auth | JWT (separate tokens per portal type) |
| Payments | Stripe |
| Email | SMTP (configurable) |
| WhatsApp / SMS | Twilio |
| Notifications | Telegram Bot API |
| PDF generation | WeasyPrint · Jinja2 |
| AI | Anthropic Claude API |
| Scheduling | APScheduler (daily 8am cron) |

---

## Local development

### Prerequisites

- Python 3.12+
- Node 18+
- PostgreSQL (or use SQLite for quick local dev — see config)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in credentials
cp .env.example .env.production

# Apply database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:5173
```

---

## Environment variables

Copy `backend/.env.example` to `backend/.env.production` and set:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Long random string — change before going live |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Email sending |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY` | Stripe payments |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | WhatsApp + SMS via Twilio |
| `TWILIO_WHATSAPP_FROM` | e.g. `whatsapp:+14155238886` |
| `TWILIO_SMS_FROM` | e.g. `+14155238886` |
| `APP_BASE_URL` | e.g. `https://propairty.co.uk` |

> **Never commit `.env.production` to version control.**

---

## Database migrations (Alembic)

Schema changes are managed with Alembic — do not use `create_all()`.

```bash
# After editing a model, generate a migration
alembic revision --autogenerate -m "describe your change"

# Review the generated file in alembic/versions/, then apply
alembic upgrade head

# Roll back one migration if something goes wrong
alembic downgrade -1

# Check current state
alembic current
```

---

## Portals

| Portal | URL | Auth |
|---|---|---|
| Agent (main app) | `/dashboard` | Email + password |
| Tenant | `/tenant/login` | Email + password (agent-enabled) |
| Landlord | `/landlord/login` | Email + password (agent-created) |
| Contractor | `/contractor/login` | Email + password (agent-created) |

---

## Key features

- **Properties & units** — full portfolio management
- **Tenants & leases** — onboarding, lease lifecycle, renewals
- **Rent & payments** — Stripe online payments, arrears tracking, escalation
- **Compliance** — certificate tracking with expiry alerts
- **Maintenance** — job management, contractor dispatch, AI intake via WhatsApp
- **PPM** — planned preventative maintenance with auto-scheduling
- **Inspections** — room-by-room reports with photos
- **Legal notices** — Section 21, Section 8, rent increase — auto-generated PDF
- **Landlord portal** — arrears breakdown, statements, documents, renewals, messages
- **Tenant portal** — balance, maintenance requests, in-portal notifications
- **Contractor portal** — assigned jobs, status updates
- **Analytics & accounting** — income/expenditure, occupancy trends
- **AI assistant** — chat interface for agents, rent risk scoring
- **Multi-channel comms** — email → WhatsApp → SMS cascade, Telegram agent alerts
- **i18n** — multi-language support (planned: 10 agent languages, 50+ tenant languages)

---

## Daily automation (8am cron)

- Rent reminders (email → WhatsApp → SMS → in-portal notification)
- Lease renewal reminders to agents
- Compliance certificate expiry alerts
- 7-day arrears escalation (Telegram alert + arrears letter PDF + Section 8 if applicable)
- PPM schedule trigger (auto-creates maintenance jobs when due)
- Contractor auto-dispatch

---

## Deployment

The app is designed to run on a single Linux server:

```
nginx (reverse proxy + SSL)
  → frontend (static build via `npm run build`)
  → backend (uvicorn on port 8000)
postgresql (local or managed)
```

Before going live:
1. Set a strong `SECRET_KEY` in `.env.production`
2. Configure real SMTP credentials
3. Run `alembic upgrade head` on the production database
4. Set up daily database backups
5. Register with ICO (UK GDPR — you process personal data)
6. Add privacy policy and terms of service pages

---

## Security notes

- All auth token endpoints are rate-limited (10 req/minute)
- JWTs include a `type` claim — tokens from one portal cannot be used in another
- File uploads validate MIME type (not just extension)
- User-controlled content is HTML-escaped in email templates
- Stripe webhook endpoint requires `STRIPE_WEBHOOK_SECRET` to be set

---

## Contributing

```bash
git checkout -b feature/your-feature
# make changes
git add -p
git commit -m "feat: describe your change"
git push origin feature/your-feature
# open a pull request
```
