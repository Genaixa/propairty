# PropAIrty Golem Test Suite

Four simulated users that interact with the live system to catch cross-portal bugs.

## Setup (run once)

```bash
cd /root/propairty/backend
source venv/bin/activate
python /root/propairty/tests/golems/seed_golems.py
```

This creates 4 test users in the production DB:

| Golem | Email | Portal |
|-------|-------|--------|
| AgentGoilem | agentgoilem@propairty.co.uk | Agent |
| TenantGoilem | tenantgoilem@propairty.co.uk | Tenant |
| LandlordGoilem | landlordgoilem@propairty.co.uk | Landlord |
| ContractorGoilem | contractorgoilem@propairty.co.uk | Contractor |

Password: `Golem_Test_2024!`

## Running tests

```bash
cd /root/propairty/tests/golems
source /root/propairty/backend/venv/bin/activate
export PYTHONPATH=/root/propairty/backend

# Deterministic lifecycle scenario (52 checks)
python scenarios/full_lifecycle.py

# LLM chaos mode — Groq picks actions autonomously
export GROQ_API_KEY=gsk_...
python llm_golem.py --role agent --turns 8
python llm_golem.py --role tenant --turns 5
python llm_golem.py --role contractor --turns 6
python llm_golem.py --all --turns 6   # all 4 portals
```

## What the lifecycle scenario tests

1. Tenant submits a maintenance request
2. Tenant can see it in their portal
3. Agent sees it and assigns ContractorGoilem
4. Contractor sees their assigned job with tenant contact
5. Contractor accepts the job and submits a quote (£320)
6. Agent sees the acceptance + quote, approves it
7. Agent sets a scheduled date
8. Contractor adds a note and marks job complete (£295 actual)
9. Agent sees actual cost + contractor's note
10. Agent marks invoice paid
11. Landlord sees the job with cost and contractor name
12. Tenant sees completed status + who was assigned
13. Messaging endpoints work on all 3 portals
14. Cleanup

## Bugs found and fixed by golems

| Bug | Found by | Fixed |
|-----|----------|-------|
| `contractor_id` missing from `MaintenanceCreate` schema — assigning a contractor via PUT silently did nothing | Lifecycle run #1 | Added to schema |
| PUT handler obliterated `reported_by_tenant_id` — tenants lost their jobs after agent edits | Lifecycle run #1 | Preserve existing value if not in payload |
| `POST /quote-decision` accepted approval with no quote submitted | LLM chaos (agent, turn 6) | Guard added |

## Adding new scenarios

Create a file in `scenarios/` following the pattern of `full_lifecycle.py`.
Import the golem classes, call `.login()`, then use their action methods.
Use `.check(description, condition, detail)` to assert expected state.
