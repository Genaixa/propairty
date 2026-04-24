# PropAIrty User Manual

_Last updated: 2026-04-23_

---

## What is PropAIrty?

PropAIrty is a property management platform for letting agencies. It brings together everything you need to manage a residential portfolio — tenants, landlords, contractors, maintenance, compliance, payments, documents, and more — in one place.

There are four separate portals, each tailored to a different audience:

| Portal | Who it's for | Login URL |
|--------|-------------|-----------|
| **Agent portal** | Letting agency staff | propairty.co.uk (main app) |
| **Tenant portal** | Tenants | propairty.co.uk/tenant/login |
| **Landlord portal** | Landlords | propairty.co.uk/landlord/login |
| **Contractor portal** | Maintenance contractors | propairty.co.uk/contractor/login |

---

## Part 1 — Agent Portal

The agent portal is the main application used by your letting agency team. It is accessible at propairty.co.uk after logging in with your agency account.

### Navigation

The left sidebar groups all features into sections. Which sections you can see depends on your role:

- **Admin / Manager** — full access to all sections
- **Negotiator** — no access to Finance or Intelligence sections
- **Accounts** — no access to Operations or Intelligence sections
- **Read-only** — can view everything but cannot make changes

The sections are:

**Portfolio** — Properties, Tenants, Landlords, Units
**Operations** — Maintenance, Compliance, Inspections, Contractors, Dispatch, PPM, Inventory, Notices
**Finance** — Payments, Deposits, Rent Risk, Accounting, Withdrawals
**Intelligence** — Analytics, Dashboard, AI, Risk, Valuation
**Admin** — Documents, Files, Settings, Workflows, Audit Log

---

### Properties

[SCREENSHOT: Properties page — list of all properties with address, type, and unit count]

The Properties page lists every property in your portfolio. You can:
- Add a new property using the **+ Add Property** button
- Click any property to open its full profile
- See the number of occupied and vacant units at a glance

**Property profile** contains:
- Overview (address, property type, key dates, EPC rating)
- Units (each rentable unit with current tenant and lease)
- Compliance certificates (gas safety, EPC, EICR etc.)
- Documents uploaded to this property
- Notes

---

### Tenants

[SCREENSHOT: Tenants page — table of tenants with name, property, lease status]

The Tenants page lists all current and former tenants. From here you can:
- Add a new tenant
- Filter by active/former status
- Click a tenant to open their full profile

**Tenant profile** contains:
- Personal details (name, email, phone, DOB, NI number)
- Lease information (property, unit, start/end dates, rent)
- Payment history
- Documents
- Right to Rent check
- Referencing status
- Deposit record
- Meter readings
- Notices served

---

### Landlords

[SCREENSHOT: Landlords page — list of landlords with portfolio summary]

The Landlords page shows all landlords whose properties you manage. Each landlord has a profile with:
- Contact details
- Properties assigned to them
- Financial summary
- Documents

---

### Maintenance

[SCREENSHOT: Maintenance page — kanban or list of jobs by status]

The Maintenance page shows all open and historical maintenance requests. You can:
- Log a new job manually
- Assign a job to a contractor
- Update job status (open → in progress → completed)
- Filter by property, contractor, or status

Each job shows the tenant who reported it, the property and unit, priority level, description, and any photos uploaded.

---

### Compliance

[SCREENSHOT: Compliance page — certificates per property with expiry dates and traffic-light status]

Compliance tracks mandatory safety certificates for each property:
- **Gas Safety** (annual)
- **EPC** (every 10 years)
- **EICR** (Electrical Installation Condition Report — every 5 years)
- **Fire alarm / emergency lighting**
- **Legionella risk assessment**

Each certificate shows its expiry date. Certificates within 30 days of expiry show amber; expired certificates show red.

---

### Inspections

[SCREENSHOT: Inspections page — list with type, property, date, and status]

Log and track property inspections. Types include:
- **Routine** — periodic checks (usually every 6 months)
- **Check-in** — at the start of a new tenancy
- **Check-out** — at the end of a tenancy

Each inspection record can include photos, condition notes by room, and an overall condition rating.

---

### Payments

[SCREENSHOT: Payments page — table of rent due and paid, with status badges]

The Payments page shows the rent ledger for every active tenancy. You can:
- See which payments are paid, overdue, or upcoming
- Log a manual payment
- Generate a rent statement for a tenant

---

### Deposits

[SCREENSHOT: Deposits page — list of deposits with scheme, amount, and protection status]

Tracks deposit records for each tenancy:
- Deposit amount and scheme (TDS, DPS, myDeposits)
- Protection status
- Dispute case tracking

---

### Documents

[SCREENSHOT: Documents page — document generator with template selector]

Generate standard tenancy documents:
- Assured Shorthold Tenancy (AST) Agreement
- Deposit Receipt
- Section 21 Notice
- Section 8 Notice
- Check-in / Check-out Report

Select the tenant and property, then click **Generate** to produce a PDF.

---

### Files

[SCREENSHOT: Files page — sidebar with entity types, entity list, and file panel]

The Files page is a central document store. Use the left sidebar to browse:
- **Properties** — documents attached to a property
- **Landlords** — documents attached to a landlord
- **Tenants** — documents attached to a tenant
- **Contractors** — documents attached to a contractor

Click any name to see their uploaded files. You can upload new files or download existing ones.

---

### Contractors

[SCREENSHOT: Contractors page — list of contractors with trade and contact details]

The Contractors page lists all maintenance contractors and tradespeople you work with. Each contractor record includes:
- Company name and contact details
- Trade(s) they cover
- Jobs assigned to them
- Performance rating

Contractors can also log in to their own portal (see Part 3).

---

### Dispatch

[SCREENSHOT: Dispatch page — queue of maintenance jobs awaiting assignment]

The Dispatch queue shows maintenance jobs that have not yet been assigned to a contractor. From here you can:
- Review the job details
- Select a contractor from the dropdown
- Dispatch the job — this notifies the contractor automatically

---

### PPM (Planned Preventative Maintenance)

[SCREENSHOT: PPM page — scheduled recurring tasks]

PPM lets you schedule recurring maintenance tasks so nothing gets forgotten:
- Boiler services
- Gutter cleans
- Fire alarm tests
- Any other regular task

Each task has a property, frequency, and next-due date. The system reminds you when items are coming up.

---

### Notices

[SCREENSHOT: Notices page — list of legal notices with served date and type]

Log Section 21 (no-fault eviction) and Section 8 (fault-based eviction) notices:
- Served date and possession date
- Which tenant and property
- PDF generation

---

### Rent Risk

[SCREENSHOT: Rent Risk page — tenants scored by risk level]

The Rent Risk tool uses payment history and lease data to score each tenant's likelihood of going into arrears. Tenants are flagged as low, medium, or high risk.

---

### Analytics

[SCREENSHOT: Analytics page — charts for occupancy, rent collection, and arrears]

High-level portfolio statistics and trends:
- Occupancy rate
- Rent collection rate
- Maintenance volume
- Void periods

---

### Dashboard

[SCREENSHOT: Dashboard — KPI cards with monthly summary]

A quick snapshot of the portfolio's current state: active tenancies, total monthly rent, outstanding arrears, open maintenance jobs, and upcoming compliance renewals.

---

### AI Features

[SCREENSHOT: AI page — tabs for different AI tools]

The AI section includes several intelligent tools:

- **AI Chat** — ask questions about your portfolio in plain English
- **Listing Generator** — write a rental listing description from property details
- **Lease Analyser** — upload a lease document and ask questions about it
- **Valuation** — AI-estimated rental value based on market data
- **Rent Optimisation** — suggested rent adjustments across the portfolio
- **Churn Risk** — tenants likely to leave at renewal
- **Void Minimiser** — tips to reduce void periods
- **Phone Agent** — AI voice assistant for tenant calls
- **Email Triage** — automatically categorise incoming emails

---

### Workflows

[SCREENSHOT: Workflows page — list of automation rules]

Workflows are rules that run automatically each day and send emails or alerts when conditions are met. Examples:

- Rent overdue by 3 days → email tenant
- Lease expiring in 60 days → email landlord
- Maintenance job not updated in 7 days → alert agent

You can toggle each rule on/off, adjust the number of days, and add your own rules. Click **Load defaults** to get started quickly.

---

### Settings

[SCREENSHOT: Settings page — agency info, portals config, and team tabs]

The Settings page has three sections:

**Agency** — your agency's name, email, phone, and logo. These appear on documents and portal pages.

**Portals** — configure which features are visible in the tenant, landlord, and contractor portals (e.g. hide the calendar from contractors, disable renewal offers).

**Team** — manage your staff accounts. For each team member you can:
- Set their role (Admin, Manager, Negotiator, Accounts, Read-only)
- Restrict them to specific properties only
- Select which properties they can access

---

### Audit Log

[SCREENSHOT: Audit Log page — timestamped list of user actions]

A full log of every action taken in the system: who did what and when. Useful for compliance and accountability.

---

## Part 2 — Tenant Portal

The tenant portal is a self-contained app at propairty.co.uk/tenant. Tenants log in with the email and password set up by your agency.

[SCREENSHOT: Tenant portal — sidebar navigation and main content area]

### My Property

Shows details about the property the tenant is renting: address, EPC rating, council tax band, and any notes added by the agent. Includes key contacts (agency phone/email).

### My Lease

Displays the tenant's current tenancy agreement details: start and end date, monthly rent, and any renewal offer if one is pending.

[SCREENSHOT: Tenant portal — My Lease tab with lease dates and renewal offer banner]

If a renewal offer has been sent, the tenant can **Accept** or **Decline** it directly from this tab.

### Payments

Shows the full rent schedule — due dates, amounts, paid dates, and status. Outstanding balances show in red.

### Messages

A direct chat channel between the tenant and their letting agent. Tenants can send a general enquiry at any time; agents respond from the agent portal.

### Maintenance

[SCREENSHOT: Tenant portal — Maintenance tab with report form and past requests]

Tenants can report a maintenance issue by filling in:
- Title (e.g. "Boiler not working")
- Category (plumbing, electrical, heating, etc.)
- Priority (low / medium / high / urgent)
- Description

Past requests and their current status are shown below the form.

### Documents

A list of all documents the agent has uploaded for this tenant — tenancy agreement, deposit certificate, compliance certificates, and any electronically signed documents.

### Deposit

Shows deposit amount, scheme, reference number, and protection status. Includes links to the three government-approved schemes (TDS, DPS, myDeposits).

### Rent Statement

A printable summary of all rent payments. The tenant can save this as a PDF for reference or proof of payment.

### Meters

[SCREENSHOT: Tenant portal — Meters tab with reading submission form]

Tenants can submit electricity, gas, and water meter readings. All readings are visible to the agent in the agent portal under Meter Readings.

### Inspections

Shows scheduled and completed inspection dates, the inspector's name, and any condition notes from the agent.

### Utilities & Move-in Info

Supplier names for electricity, gas, water, and broadband — plus bin collection days and meter locations. Agents fill this in during onboarding.

### Emergency Contacts

The agency's out-of-hours number, any additional emergency contacts set by the agent, and national emergency numbers (999, gas emergency 0800 111 999, etc.).

### Right to Rent (RTR)

Shows the tenant's Right to Rent check status and document expiry dates recorded by the agent.

### Move Out

A checklist of tasks to complete before leaving the property, with timelines. Shows a countdown to the lease end date.

### Referencing

Displays the status of the tenant's referencing application (pending, in progress, passed, failed).

### Notices

Any legal notices (Section 21, Section 8) served on the tenancy.

### Renewal

If a renewal offer is active, the full offer details (proposed rent, new dates, agent notes) appear here with Accept/Decline buttons.

---

## Part 3 — Landlord Portal

The landlord portal is at propairty.co.uk/landlord. Landlords log in with the email set up by your agency.

[SCREENSHOT: Landlord portal — sidebar navigation with emerald colour scheme]

### Overview

A summary dashboard showing total monthly rent, amount collected, and current arrears. Quick-access cards link to Properties, Maintenance, Compliance, and Documents.

### Properties

Lists every property owned by this landlord, with units, tenant names, rent amounts, and lease end dates.

### CFO — Portfolio P&L

[SCREENSHOT: Landlord portal — CFO tab with income/expense breakdown and yield scores]

A financial breakdown of the landlord's portfolio:
- Net income over the last 12 months
- Gross rent vs. repairs and agency fees
- Yield score per property (Star / OK / Watch / Drop)
- 12-month gross rent forecast chart

The landlord can enter their agency fee percentage to see true net figures.

### Financials

Full payment history grouped by property and unit — every rent payment, the due date, paid date, and status.

### Arrears

Any tenants currently behind on rent, showing how many days overdue and the outstanding amount.

### Maintenance

A list of all maintenance jobs on the landlord's properties — open, in progress, and completed.

### Compliance

All compliance certificates across the landlord's properties, with issue dates, expiry dates, and status (valid / expiring soon / expired).

### Renewals

Lease renewals coming up in the next 90 days.

### Inspections

Scheduled and completed inspections with condition ratings.

### Documents

All documents uploaded against the landlord's properties, grouped by category.

### Rent Statements

Downloadable monthly statements showing expected rent, amounts collected, and balances. Statements are also emailed automatically on the 1st of each month.

### Legal Notices

Section 21 and Section 8 notices served on the landlord's properties.

### Messages

A direct message channel between the landlord and the agency.

---

## Part 4 — Contractor Portal

The contractor portal is at propairty.co.uk/contractor. Contractors log in with credentials set up by your agency.

[SCREENSHOT: Contractor portal — sidebar navigation with orange colour scheme]

### My Jobs

[SCREENSHOT: Contractor portal — jobs list with status filter tabs]

Shows all maintenance jobs assigned to this contractor. Filter by:
- **Active** — open or in progress
- **Completed**
- **Cancelled**
- **All**

Each job shows the property address, description, priority, and status. Clicking a job expands it to show notes and a form to add updates.

Contractors can mark a job as **Complete** once the work is done.

### Messages

Direct messaging with the letting agency — for questions about a job or general communication.

### My Profile

Update company name, trade, contact email, and phone number.

### Job Calendar

A monthly calendar view showing scheduled job dates.

### Notification Preferences

Choose whether to receive job alerts by email, SMS, or Telegram.

---

## Appendix — Roles & Permissions

| Role | Finance section | Operations section | Intelligence section | Can edit settings |
|------|-----------------|--------------------|----------------------|-------------------|
| Admin | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ | ✓ | ✓ | ✓ |
| Negotiator | ✗ | ✓ | ✗ | ✗ |
| Accounts | ✓ | ✗ | ✗ | ✗ |
| Read-only | ✓ | ✓ | ✓ | ✗ |

Agents with the **Restrict to assigned properties** toggle enabled can only see data for the specific properties assigned to them.

---

## Appendix — Demo Credentials

| Portal | Email | Password |
|--------|-------|----------|
| Agent | admin@propairty.co.uk | admin123 |
| Tenant | tenant@example.com | tenant123 |
| Landlord | landlord@example.com | landlord123 |
| Contractor | contractor@example.com | contractor123 |

---

---

## Appendix — Recent Changes (2026-04-23)

### UI improvements (this session)
- **Dashboard** — SVG icons throughout, Action Required strip for time-sensitive alerts, Quick Actions panel, Ask Mendy bar for instant AI queries
- **Portfolio Health Score** — all breakdown rows and issues are now clickable links to the relevant section
- **Landlord portal** — SVG icons, compliance rows highlight red/amber when expired or expiring, better empty states
- **Tenant portal** — SVG nav icons, unified ProfileDropdown component (same as agent)
- **Contractor portal** — SVG nav icons, unified ProfileDropdown component, consistent sign-out behaviour
- **Public site AI chat** — close button added; chat panel no longer covers the toggle button

### Demo data refresh
The demo portfolio data was refreshed to reflect a healthy, up-to-date portfolio (score 93/100, Grade A):
- All compliance certificates renewed with future expiry dates
- All lease end dates extended to 2026–2027
- 14 months of rent payment history added for all tenants — all paid on time
- Completed outstanding maintenance jobs; one minor open job retained for realism
- Added tenant Oliver Bennett to Flat 3 (was vacant), bringing occupancy to 7/8 units

---

_This manual is maintained alongside the codebase and updated at the end of each development session._
