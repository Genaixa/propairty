# PropAIrty User Manual

_Last updated: 2026-05-01_

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
- **Financial Summary** — a mini CFO panel showing monthly rent roll, annual rent roll, average rent per unit, deposits held, void cost, and any leases expiring within 90 days
- Units (each rentable unit with current tenant and lease)
- Compliance certificates (gas safety, EPC, EICR etc.)
- Documents uploaded to this property
- Photos and floorplan

[SCREENSHOT: Property detail — Financial Summary card with 5 coloured metric tiles]

---

### Leases

[SCREENSHOT: Leases page — properties grouped with CFO strip and per-group filters]

The Leases page shows all tenancy agreements grouped by property. Each property group includes:

- **Status filter pills** — filter that group's leases by All / Active / Expired / Terminated independently of other properties
- **Mini CFO strip** — shows at a glance: monthly rent roll, annual rent roll, deposits held, void cost, and leases expiring within 90 days
- A table of leases with unit, tenant, start date, end date, rent, deposit and status — all sortable

Use the **property dropdown** at the top to jump straight to one property (useful when you have many).

Click **+ New Lease** to create a tenancy agreement manually.

---

### Tenants

[SCREENSHOT: Tenants page — table of tenants with name, property, lease status]

The Tenants page lists all current and former tenants. From here you can:
- Add a new tenant
- Search by name, email or phone
- Filter by portal status or click the **Expiring ≤ 90d** tile to see tenants whose lease ends soon
- Click a tenant to open their full profile

The tenant table shows each tenant's **current monthly rent** and a colour-coded **Tenancy** chip:
- 🟢 Active — lease running normally
- 🟡 Expires Xd — lease expiring within 90 days (shows exact days)
- 🔵 Periodic — rolling month-to-month tenancy
- ⚪ No lease — no active lease found

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

[SCREENSHOT: Maintenance page — jobs list with Jobs / Payments tab toggle]

The Maintenance page has two views: **Jobs** and **Payments**.

#### Jobs view

Shows all maintenance requests. You can:
- Log a new job manually
- Assign a job to a contractor
- Update job status (open → in progress → completed)
- Filter by status (Open, In Progress, Done, Cancelled, All) or by KPI cards
- Search by job title, unit, or tenant name
- **Edit** a job (title, description, priority) in the drawer
- Approve or reject a contractor's quote
- Accept or reject a contractor's proposed reschedule date

Opening a job shows a two-column drawer: **Details / Contractor / Financials** on the left, **Messages / Notes** on the right.

**Quote workflow** — when a contractor submits a quote with a proposed date and optional PDF, you see it under the Contractor section. Click **Approve quote & confirm date** to accept both the price and the visit date in one step. Quotes can also be rejected.

**Payments (Financials section)** — once a contractor has submitted an invoice amount, the Financials section shows:
- Invoice amount and any attached invoice file
- A list of all payments made so far, with amount, date, and reference
- The outstanding balance
- An **Add payment** inline form — enter the amount (pre-filled with the balance), date, and optional reference, then click **Record payment**
- Payments auto-mark the job as **Paid in full** when the total reaches the invoice amount
- Individual payments can be deleted (balance and paid status update automatically)

#### Payments view

[SCREENSHOT: Payments tab — table of outstanding invoices with checkboxes]

The **Payments** tab shows all jobs with an unpaid invoice. It is the central place to run a payment batch:

1. Tick one or more jobs (or **select all**)
2. Click **Pay N selected — £X.XX**
3. Enter a payment date and an optional bank reference (BACS ref, cheque number, etc.)
4. Click **Confirm** — each selected job receives a payment entry for its full remaining balance

Jobs that reach zero balance are automatically moved to the **Paid** section below. If a job is only partially paid (e.g. you can only afford half), record a partial amount from the job drawer — the balance stays in the outstanding list until cleared.

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
- Record a payment received against a rent charge
- Generate a rent statement for a tenant

**Recording a payment:** Click the **Record Payment** button on any unpaid or partially paid row. A modal opens where you enter:
- **Amount Received** — can be less than the full amount (partial payments are flagged)
- **Payment Date** — the actual date the funds arrived
- **Method** — Bank Transfer, Standing Order, Cash, Cheque, Card, or Other
- **Reference / Notes** — optional, e.g. tenant name or bank reference

The row updates immediately to reflect the payment. If the amount is less than the amount due, the status shows as **Partial** and you can record further payments later.

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
- **Management Agreement** — between landlord and agency
- **Deed of Surrender** — mutual agreement to end a tenancy early, including deposit settlement and deductions
- **Notice of Seeking Possession (NOSP)** — formal notice before possession proceedings; Ground 8 (mandatory) is auto-selected if arrears exceed two months' rent

Two additional documents are generated from a specific record rather than the tenant selector:

- **Deposit Dispute Pack** — open via the Deposits page, generates a ready-to-submit claim pack with chronology table, condition notes, and supporting evidence list
- **HMO Guidance Report** — open via a property's profile, assesses HMO licensing eligibility and produces a checklist of management regulations and application steps

Select the tenant, property and document type, then click **Generate** to produce a PDF. For Deed of Surrender, enter the agreed surrender date and any notes. For NOSP, confirm the arrears figure.

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
- Jobs assigned to them and total spend
- Performance rating (from tenant and agent reviews)

Switch to the **Jobs & Costs** tab to see all maintenance jobs with estimated vs actual cost, invoice references, and totals. Click **Assign** or **Update** on any job row to assign a contractor and log costs — the panel saves and closes automatically on success.

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

[SCREENSHOT: Rent Risk page — tenants scored by risk level with action buttons]

The Rent Risk tool scores each tenant 1–5 (Low to Critical) based on their full payment history — late payments, partial payments, arrears, and payment trend over time.

Each tenant card shows:
- Risk score and label (Low / Low-Medium / Medium / High / Critical)
- Payment breakdown — on time, late, overdue, partial counts
- Current arrears amount
- Recommended action — a plain-English instruction matched to the risk level

**Action buttons** appear alongside each recommendation, taking you directly to the right place without hunting:
- *Message tenant* → opens the messaging thread with that tenant pre-selected
- *Issue notice / Serve Section 8* → opens the legal notices page filtered to that tenant
- *View tenant* → opens the tenant's full profile

[SCREENSHOT: Rent Risk — recommended action card with direct action button]

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

- **AI Chat (Mendy)** — ask questions about your portfolio in plain English. Mendy has access to live portfolio data including tenants, leases, compliance certificates, maintenance jobs, arrears, deposits, legal notices, right-to-rent checks, and 30 days of metric history. Ask things like "which leases expire in the next 60 days?", "any compliance expiring this month?", or "summarise open maintenance jobs". Charts appear inline for trend questions. Mendy only answers from your real data — it will say so clearly if something isn't in your records rather than guessing.
- **Listing Generator** — write a rental listing description from property details. Upload photos to include them in the PDF; the generated listing is ready to paste into Rightmove, Zoopla, or OnTheMarket.
- **Lease Analyser** — upload a lease document and ask questions about it
- **Valuation** — AI-estimated rental value based on market data
- **Rent Optimisation** — suggested rent adjustments across the portfolio
- **Churn Risk** — tenants likely to leave at renewal
- **Void Minimiser** — shows at-risk leases grouped by how close they are to expiry (0–30 days through 120+ days). For each lease you can draft a listing or send the tenant a renewal chaser email. Clicking **Email tenant** opens a preview of the email with editable subject and body before it is sent. Emails are sent from the agency's noreply address with your personal email set as the Reply-To, so the tenant's response comes directly back to you.
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

Each job shows the property address, description, priority, and status. Clicking a job opens an update panel.

**Quote flow** — for a newly assigned job:
1. Click the job and fill in the **Quote amount (£)**, **Proposed visit date**, and optional notes
2. Optionally attach a quote PDF (drag or click the paperclip area)
3. Click **Submit quote** — the agent reviews and approves or rejects it

Once the quote is approved, the visit date is confirmed and the job enters the **work phase**.

**Work phase** — while the job is in progress:
- Set the visit status: In Progress / Completed / Cancelled
- Optionally propose a new date if the confirmed date no longer works
- Fill in the **Invoice amount (£)** and **Invoice ref** once the work is done
- Attach the invoice PDF using the **Attach invoice** file picker
- Click **Save** — the agent can then record payments against the invoice

**Invoice status** — at the bottom of the work phase panel:
- Shows **Awaiting payment from agent** while the invoice is unpaid
- Shows **Paid in full by agent** once the agent has fully paid it

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

## Appendix — Recent Changes (2026-04-24)

### Feature #33 — Applicant Matching Engine
A new **Matches** tab has been added to the Applicants pipeline view. When you have vacant units, it shows a ranked list of applicants per unit scored across four dimensions: budget, bedrooms, area, and must-haves. Each row shows a score percentage (e.g. 78%) and colour-coded indicators — green tick for a match, amber tilde for partial, grey dash for not stated. Partial matches count; a 100% match is not required to appear.

The AI Autopilot has a matching check: when a vacant unit has an applicant scoring 50% or above, the agent receives an alert.

To use: open **Applicants**, click the **Matches** tab in the top-right view switcher. [SCREENSHOT: Matches view showing vacant units with ranked applicant cards]

Applicant preferences (budget, areas, bedrooms, must-haves) are captured in the **Preferences** tab of the Add/Edit Applicant modal.

### New Lease form — labels and grouped unit dropdown
The **New Lease** form (found on the Leases page) now has proper field labels on every input so you know exactly what each field is for. The unit dropdown is now grouped by property, making it easy to find the right unit when you manage multiple properties.

### AI Autopilot — 10 new checks (from this session)
Ten new automated checks were added to the Autopilot engine:
- **Applicant follow-up overdue** — applicant has a follow-up date that has passed
- **Applicant stage stalled** — applicant hasn't moved stage in too long
- **Referencing stalled** — applicant stuck in referencing with no progress
- **Deposit not registered** — active lease past N days with no deposit record
- **Inventory missing** — active lease past N days with no move-in inventory
- **Tenant portal inactive** — tenant portal not enabled for an active tenant
- **Survey unsent** — active tenant with no satisfaction survey sent
- **Landlord message unread** — landlord has sent a message that hasn't been replied to
- **Renewal pending too long** — renewal offer sent but no response for too many days
- **No inspection** — active tenancy with no inspection in the last N months
- **Applicant matches** — vacant unit has a high-scoring applicant match (50%+)

All new checks appear in the Autopilot configuration screen and can be individually enabled/disabled with custom thresholds.

---

### Compliance matrix — clickable "No Record" cells and per-unit rows

The compliance matrix (Compliance page) has two significant improvements:

**Clickable No Record cells** — previously, clicking a grey "No Record" cell did nothing. Now clicking any cell opens the appropriate form:
- If a certificate exists → opens the detail/edit modal for that cert
- If no certificate → opens the Add Certificate form pre-filled with the correct property, certificate type, and unit (for multi-unit properties)

**Per-unit rows for multi-unit properties** — for HMO and multi-unit buildings, the matrix now shows a separate row for each unit rather than a single property row. Each unit's compliance status is tracked independently. Property-level certificates (those without a unit assigned) count as a fallback for all units.

[SCREENSHOT: Compliance matrix showing Riverside House with one row per flat, each with its own gas safety / EICR / EPC status cells]

### Landlord portal — Compliance certificates now include download links

The **Compliance** tab in the landlord portal now shows the property name for each certificate, and includes a **View →** download link when a PDF or image has been attached to the certificate. Landlords can now view their own compliance documents directly from their portal.

### Landlord portal — new Deposits tab

A new **Deposits** tab has been added to the landlord portal. It shows:
- Which unit and tenant each deposit relates to
- The deposit amount
- The protection scheme (TDS / DPS / myDeposits)
- The scheme reference number
- The date the deposit was protected
- The current status

[SCREENSHOT: Landlord portal Deposits tab showing table with property, tenant, amount, scheme, reference, protected date, and status columns]

### Certificate PDF downloads — all portal types now work

Downloading compliance certificate PDFs now works from all three portals (agent, tenant, landlord). Previously the download link returned 401 for landlord tokens. Fixed.

---

---

## Appendix — Recent Changes (2026-04-30)

### Mendy AI — trend charts and 30-day metric history

Mendy (the AI Chat assistant) can now answer questions about how your portfolio metrics have changed over time, and can display the results as inline charts.

Ask things like:
- "Show me the rent collection rate over the last month"
- "Chart occupancy this week"
- "How has average rent changed recently?"

Mendy automatically selects the best chart type (bar, line, or pie) and renders it directly in the conversation. The underlying data is a rolling 30-day log of 10 portfolio metrics captured each night.

[SCREENSHOT: Mendy chat window with a bar chart showing rent collection rate over the last 30 days]

### Four new legal documents

The Documents page now includes four additional document types:

**Deed of Surrender**
A mutual agreement to end a tenancy before the lease expiry date. Select the tenant, enter the agreed surrender date and any condition notes, and the system generates a formal deed covering deposit settlement (with optional deductions), outstanding rent, and key return confirmation. Both parties sign the output.

**Notice of Seeking Possession (NOSP)**
Required before commencing possession proceedings. Ground 8 (mandatory, rent ≥ 2 months overdue) is automatically included if the arrears amount exceeds two months' rent. Grounds 10 and 11 are included by default. The notice includes service method checkboxes and a witness signature block.

**Deposit Dispute Pack**
Generated from the Deposits page rather than the Documents page. Opens a complete submission pack for your deposit scheme adjudicator: claim summary table, chronology of events, check-in and check-out condition notes, and a supporting evidence list. Includes a statement of truth.

**HMO Guidance Report**
Generated from a property's profile page. Assesses whether the property meets the HMO licensing threshold, lists the applicable HMO Management Regulations, and produces a step-by-step application checklist. Pulls in any existing compliance certificates from the database.

[SCREENSHOT: Documents page showing new Deed of Surrender and NOSP cards alongside existing document types]

### Void Minimiser — editable email preview before sending

Clicking **Email tenant** on the Void Minimiser page now opens a preview modal before the email is sent. You can edit both the subject line and the message body before it goes out.

The email is pre-filled with:
- The tenant's first name
- Property name and unit
- Lease end date and monthly rent
- A link to the tenant portal Renewal tab
- Your name, email address, and agency name as the closing signature

Emails are sent from the agency's noreply address. Your personal email is set as the **Reply-To** address, so any reply from the tenant lands directly in your inbox.

[SCREENSHOT: Void Minimiser email preview modal showing editable subject and body with Send and Cancel buttons]

---

_This manual is maintained alongside the codebase and updated at the end of each development session._

### Navigation — Intelligence menu organised into sections

The **Intelligence** sidebar group is now divided into labelled sub-sections so it's easier to find the right tool:

- **Overview** — Analytics · CFO Dashboard · Market News
- **Property & Revenue** — Valuation · Rent Optimiser · EPC Roadmap
- **Tenant** — Renewals · Churn Risk · Void Minimiser
- **Risk & Compliance** — Risk · Insurance Claims
- **AI Tools** — Email Triage · AI Phone Agent · Lease Analyser · Listing Generator · Contractor Perf. · Surveys

Market News has also moved here from Admin — it's market context, not a settings page.

### Smart Inbox (Email Triage) — redesigned

The Email Triage page has been redesigned to reduce visual clutter:

- Channel configuration (Gmail, Outlook, SMS, WhatsApp, Telegram) is now hidden behind a small **Channels** button in the top-right — it only needs to be visited once during setup.
- Pending/Urgent counts appear quietly under the page title.
- The queue uses status tabs (Pending / Actioned / All) instead of dropdowns, with a coloured left stripe on each item indicating urgency at a glance.
- Clicking a maintenance-related message now shows an **Open maintenance** button that links directly to that specific job rather than the maintenance list.

### Email Triage → direct links to maintenance jobs

When a tenant emails about a maintenance issue and a job is auto-created, the triage panel now links directly to that job (`/maintenance?job=ID`). Clicking the link opens the job drawer immediately without needing to search.

If a linked job has since been deleted, the maintenance page shows a clear notice rather than silently doing nothing.

[SCREENSHOT: Email Triage showing "Open maintenance" button linking directly to a specific job]

---

## Appendix — Recent Changes (2026-04-30, session 2)

### Feature #57 — Making Tax Digital (HMRC MTD)

PropAIrty now connects directly to HMRC for Making Tax Digital for Income Tax (MTD ITSA) — the legal requirement for landlords with income over £50,000 to submit quarterly financial updates digitally from April 2026.

**Where to find it:** Accounting → Making Tax Digital tab (marked PREMIUM)

**What it does:**
- Connects to your HMRC Government Gateway account via a secure OAuth login
- Retrieves your quarterly obligation periods automatically
- Builds the correct HMRC-format submission from your existing rent and expense data — no double entry
- Submits quarterly updates directly to HMRC in one click
- Marks quarters as ✓ Submitted once accepted

**Setup (one-time):**
1. Go to Accounting → Making Tax Digital → click **Connect HMRC Account**
2. Log in with your HMRC Government Gateway credentials
3. Once connected, enter your **National Insurance Number (NINO)** and click Save
4. Click **Fetch** next to Property Business ID — it retrieves your HMRC business source ID automatically
5. You are now ready to submit

**Submitting a quarter:**
1. Find the quarter in the table (e.g. Q1 2026/27)
2. Click **Preview** to see the exact figures and JSON payload before sending
3. Click **Submit to HMRC** — you will see ✓ Submitted on success

Quarters before 2026-27 are labelled **Pre-MTD** and cannot be submitted (the mandate only applies from the 2026-27 tax year onwards).

Your HMRC connection persists across server restarts — you do not need to reconnect each session.

[SCREENSHOT: Making Tax Digital tab showing Connected status, NINO field, quarterly table with ✓ Submitted on Q1 2026/27]

### Landing page — feature count updated

The public marketing site now correctly reflects the full feature set: **57 features** (was 33). The Agent Portal tab shows 29 features including the new MTD entry.
