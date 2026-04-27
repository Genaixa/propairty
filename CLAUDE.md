# PropAIrty — Claude Code Instructions

## At the start of every session

Check the golem test log for recent failures:

```bash
tail -20 /var/log/propairty_tests.log 2>/dev/null
```

If the log shows any failures (lines containing "FAIL" or "failed"), investigate and report to the user before doing anything else:
1. Read the failing test detail from the log
2. Check `git log --oneline -10` to see what changed recently
3. Read the relevant backend router in `/root/propairty/backend/app/routers/`
4. Diagnose: real regression vs test that needs updating
5. Tell the user what broke and suggest the fix — wait for their go-ahead before changing anything

If all suites passed, say nothing and proceed normally.

## Deploy rule

ALWAYS run `./deploy.sh` after any frontend change. nginx serves `/var/www/propairty`, not the dev build output.

## Project

UK property management SaaS — landlords, tenants, contractors, maintenance, leases, AI autopilot.
Stack: FastAPI (Python) backend, React + Tailwind frontend, PostgreSQL, nginx.
