"""
Wendy & Mendy auto-knowledge refresh.

Runs daily at noon. Reads git changes since the last processed commit,
asks Claude to update each AI assistant's system prompt, and hot-swaps
them in memory — no restart required.

Managed prompts
───────────────
  wendy           — marketing site chat (propairty.co.uk)
  mendy_agent     — agent portal AI assistant
  mendy_tenant    — tenant portal AI assistant
  mendy_landlord  — landlord portal AI assistant
  mendy_contractor— contractor portal AI assistant
"""
import os
import json
import subprocess
from datetime import datetime

from app.config import settings

# ── Paths ─────────────────────────────────────────────────────────────────────
_HERE      = os.path.dirname(__file__)
_REPO_ROOT = os.path.abspath(os.path.join(_HERE, '..', '..'))
_DATA_DIR  = os.path.join(_HERE, '..')          # backend/

LAST_COMMIT_FILE = os.path.join(_DATA_DIR, 'wendy_last_commit.txt')
FAQ_FILE         = os.path.join(_DATA_DIR, 'wendy_faq.json')

# Per-prompt knowledge files
_FILES = {
    'wendy':            os.path.join(_DATA_DIR, 'wendy_knowledge.txt'),
    'mendy_agent':      os.path.join(_DATA_DIR, 'mendy_agent_knowledge.txt'),
    'mendy_tenant':     os.path.join(_DATA_DIR, 'mendy_tenant_knowledge.txt'),
    'mendy_landlord':   os.path.join(_DATA_DIR, 'mendy_landlord_knowledge.txt'),
    'mendy_contractor': os.path.join(_DATA_DIR, 'mendy_contractor_knowledge.txt'),
}

# Diff truncation — we only send added lines (+) to keep it focused and affordable
_MAX_DIFF_CHARS = 30_000

# Watched paths — changes here trigger prompt updates
_WATCHED_PATHS = [
    'frontend/src/pages',
    'frontend/src/components',
    'backend/app/routers',
    'backend/app/main.py',
    'backend/app/wendy.py',
]

# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: dict[str, str] = {}
_faq: list[dict] = []          # [{"q": "...", "a": "...", "category": "..."}]


def get_faq() -> list[dict]:
    """Return the current FAQ list (loads from file if cache is empty)."""
    global _faq
    if not _faq:
        try:
            with open(FAQ_FILE) as f:
                _faq = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass
    return _faq


def load():
    """Load all prompts from disk at startup. Falls back to built-in defaults."""
    from app.routers.ai import (
        SYSTEM_PROMPT        as _AGENT,
        TENANT_AI_SYSTEM     as _TENANT,
        LANDLORD_AI_SYSTEM   as _LANDLORD,
        CONTRACTOR_AI_SYSTEM as _CONTRACTOR,
    )

    defaults = {
        'wendy':            "You are Wendy, an AI assistant for PropAIrty — a UK property management platform. Help prospects understand the product.",
        'mendy_agent':      _AGENT,
        'mendy_tenant':     _TENANT,
        'mendy_landlord':   _LANDLORD,
        'mendy_contractor': _CONTRACTOR,
    }

    for key, path in _FILES.items():
        try:
            with open(path) as f:
                _cache[key] = f.read().strip()
            print(f"[wendy] Loaded {key} ({len(_cache[key]):,} chars)")
        except FileNotFoundError:
            _cache[key] = defaults[key]
            _save_file(key, _cache[key])
            print(f"[wendy] {key} — no file found, initialised from built-in default.")


def get(key: str = 'wendy') -> str:
    """Return the current in-memory prompt for the given key."""
    if key not in _cache:
        load()
    return _cache.get(key, '')


# ── Daily refresh ─────────────────────────────────────────────────────────────

# Role descriptions fed to the AI for each prompt
_ROLES = {
    'wendy': (
        "Wendy is the AI chat assistant on the PropAIrty *marketing website* (propairty.co.uk). "
        "She answers questions from prospects (letting agents, property managers) about what PropAIrty does as a product. "
        "Update her prompt when features are added or removed across any portal."
    ),
    'mendy_agent': (
        "Mendy is the AI assistant inside the *agent portal*. "
        "He helps letting agents manage their portfolio — properties, tenants, compliance, maintenance, etc. — using live data tools. "
        "Update his capabilities list when new agent-portal pages, routes, or tools are added or removed."
    ),
    'mendy_tenant': (
        "Mendy is the AI assistant inside the *tenant portal*. "
        "He helps tenants understand their lease, payments, maintenance requests, and documents. "
        "Update his capabilities when new tenant-portal tabs or features are added or removed."
    ),
    'mendy_landlord': (
        "Mendy is the AI assistant inside the *landlord portal*. "
        "He helps landlords understand their portfolio performance, rent, maintenance, and compliance. "
        "Update his capabilities when new landlord-portal tabs or features are added or removed."
    ),
    'mendy_contractor': (
        "Mendy is the AI assistant inside the *contractor portal*. "
        "He helps contractors understand their active jobs, priorities, and next steps. "
        "Update his capabilities when new contractor-portal features are added or removed."
    ),
}


def refresh():
    """
    Called daily at noon by APScheduler.

    1. Fetches git log + diff since last processed commit.
    2. If no changes → skips (no AI calls, no cost).
    3. For each prompt, asks Claude to produce an updated version.
    4. Saves to disk and hot-swaps in memory.
    """
    print(f"[wendy] Starting knowledge refresh at {datetime.now().isoformat()}")

    last_commit = _read_last_commit()
    log, diff   = _get_changes(last_commit)

    if not log.strip() and not diff.strip():
        print("[wendy] No relevant changes since last refresh — skipping all prompts.")
        _write_last_commit(_current_head())
        return

    n_commits = log.count('\n') + 1 if log.strip() else 0
    print(f"[wendy] {n_commits} new commit(s), {len(diff):,} diff chars — updating all prompts.")

    updated = 0
    for key in _FILES:
        new_prompt = _ask_ai_to_update(key, _cache.get(key, ''), log, diff)
        if new_prompt:
            _save_file(key, new_prompt)
            _cache[key] = new_prompt
            updated += 1
            print(f"[wendy] {key} hot-swapped ({len(new_prompt):,} chars).")
        else:
            print(f"[wendy] {key} — AI returned empty, keeping existing prompt.")

    _write_last_commit(_current_head())
    print(f"[wendy] Refresh complete — {updated}/{len(_FILES)} prompts updated.")

    # Regenerate FAQ from updated Wendy knowledge
    _generate_faq(_cache.get('wendy', ''))


# ── Git helpers ───────────────────────────────────────────────────────────────

def _git(*args) -> str:
    try:
        return subprocess.check_output(
            ['git', *args],
            cwd=_REPO_ROOT,
            text=True,
            timeout=20,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception as e:
        print(f"[wendy] git {' '.join(str(a) for a in args)} failed: {e}")
        return ""


def _current_head() -> str:
    return _git('rev-parse', 'HEAD')


def _read_last_commit() -> str:
    try:
        with open(LAST_COMMIT_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def _write_last_commit(sha: str):
    if sha:
        with open(LAST_COMMIT_FILE, 'w') as f:
            f.write(sha)


def _get_changes(since_commit: str) -> tuple[str, str]:
    """Return (log, diff) since since_commit, or last 24 h as fallback."""
    base = since_commit if since_commit and _git('cat-file', '-t', since_commit) == 'commit' else None

    if base:
        log  = _git('log', f'{base}..HEAD', '--oneline', '--no-merges')
        diff = _git('diff', f'{base}..HEAD', '--', *_WATCHED_PATHS)
    else:
        log  = _git('log', '--since=24 hours ago', '--oneline', '--no-merges')
        diff = _git('diff', 'HEAD~1..HEAD', '--', *_WATCHED_PATHS)

    # Filter to only added lines — removals matter less for knowledge updates,
    # and this cuts typical diff size by ~60% on heavy days
    added_lines = [l for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++')]
    diff = "\n".join(added_lines)

    if len(diff) > _MAX_DIFF_CHARS:
        diff = diff[:_MAX_DIFF_CHARS] + "\n\n... (diff truncated — only additions shown)"

    return log, diff


# ── AI call ───────────────────────────────────────────────────────────────────

def _build_request(key: str, current_prompt: str, log: str, diff: str) -> str:
    role = _ROLES[key]
    return f"""You are updating the system prompt for an AI assistant inside the PropAIrty platform.

ASSISTANT ROLE:
{role}

CURRENT SYSTEM PROMPT:
---
{current_prompt}
---

RECENT GIT COMMITS (since last update):
---
{log or '(none)'}
---

CODE CHANGES (git diff of relevant files):
---
{diff or '(none)'}
---

TASK:
Study the commits and diff carefully, focusing on changes relevant to this assistant's role.
- Add new capabilities/features evidenced in the diff.
- Remove or update capabilities that have been deleted or changed.
- Do NOT invent anything not evidenced in the diff.
- Keep the same tone, structure, and British English style.
- Leave unchanged sections exactly as they are.

Return ONLY the updated system prompt. No preamble, no explanation, no markdown fences."""


def _ask_ai_to_update(key: str, current_prompt: str, log: str, diff: str) -> str:
    request = _build_request(key, current_prompt, log, diff)

    if settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[{"role": "user", "content": request}],
            )
            return resp.content[0].text.strip() if resp.content else ""
        except Exception as e:
            print(f"[wendy refresh:{key}] Anthropic error: {e}")

    if settings.groq_api_key:
        try:
            from openai import OpenAI as _OAI
            oai = _OAI(base_url="https://api.groq.com/openai/v1", api_key=settings.groq_api_key)
            resp = oai.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": request}],
                timeout=60,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[wendy refresh:{key}] Groq error: {e}")

    if settings.mistral_api_key:
        try:
            from openai import OpenAI as _OAI
            oai = _OAI(base_url="https://api.mistral.ai/v1", api_key=settings.mistral_api_key)
            resp = oai.chat.completions.create(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": request}],
                timeout=60,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[wendy refresh:{key}] Mistral error: {e}")

    return ""


# ── FAQ generation ────────────────────────────────────────────────────────────

_FAQ_PROMPT = """You are generating a FAQ for the PropAIrty marketing website based on the AI assistant's knowledge base.

KNOWLEDGE BASE:
---
{knowledge}
---

Generate a comprehensive FAQ with 25–30 questions that prospects (letting agents, estate agencies, property managers)
commonly ask when evaluating a property management platform.

Structure the FAQ by portal/product area using EXACTLY these category names:
- "General" — what PropAIrty is, who it's for, pricing, getting started
- "Agent Portal" — features for letting agents: properties, tenants, compliance, AI tools, workflows, dispatch, etc.
- "Landlord Portal" — features for property owners: financials, statements, inspections, renewals, messages
- "Tenant Portal" — features for renters: payments, maintenance, documents, deposit, lease, move-out
- "Contractor Portal" — features for tradespeople: jobs, quotes, invoices, calendar, messaging
- "Agency Website" — the public property listings site each agency gets
- "AI & Automation" — Wendy, automated workflows, AI tools (do NOT include a question specifically about "Mendy")

Aim for 4–5 questions per category. Write in British English. Answers should be 1–3 sentences.

TONE GUIDELINES:
- Be warm, confident and specific — not vague or corporate
- Pricing answers: acknowledge it's portfolio-based, emphasise value and that the demo is the fastest way to get a number — make it sound inviting, not evasive
- Never say "please contact us" — always say "book a demo" instead
- Answers should feel like a knowledgeable colleague talking, not a brochure

Return ONLY a valid JSON array. Each item must have exactly three fields:
  "category" — one of the category names listed above (exact match)
  "q"        — the question (plain text, no markdown)
  "a"        — the answer (plain text, British English)

Example:
[
  {{"category": "General", "q": "What is PropAIrty?", "a": "PropAIrty is an all-in-one UK property management platform..."}}
]

Return only the JSON array. No preamble, no explanation, no markdown fences."""


def _generate_faq(knowledge: str):
    """Ask the AI to generate a FAQ from Wendy's current knowledge and save it."""
    global _faq
    if not knowledge:
        return

    request = _FAQ_PROMPT.format(knowledge=knowledge)

    raw = ""
    if settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[{"role": "user", "content": request}],
            )
            raw = resp.content[0].text.strip() if resp.content else ""
        except Exception as e:
            print(f"[wendy faq] Anthropic error: {e}")

    if not raw and settings.groq_api_key:
        try:
            from openai import OpenAI as _OAI
            oai = _OAI(base_url="https://api.groq.com/openai/v1", api_key=settings.groq_api_key)
            resp = oai.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": request}],
                timeout=60,
            )
            raw = (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[wendy faq] Groq error: {e}")

    if not raw:
        print("[wendy faq] No AI available — skipping FAQ generation.")
        return

    # Strip any accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        items = json.loads(raw)
        assert isinstance(items, list)
        with open(FAQ_FILE, 'w') as f:
            json.dump(items, f, indent=2)
        _faq = items
        print(f"[wendy faq] Generated {len(items)} FAQ items → {FAQ_FILE}")
    except Exception as e:
        print(f"[wendy faq] Failed to parse FAQ JSON: {e}\nRaw: {raw[:200]}")


# ── File persistence ──────────────────────────────────────────────────────────

def _save_file(key: str, prompt: str):
    path = _FILES[key]
    with open(path, 'w') as f:
        f.write(prompt)
    print(f"[wendy] Saved {key} ({len(prompt):,} chars) → {path}")
