import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from openai import OpenAI

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app import ai_tools

router = APIRouter(prefix="/api/ai", tags=["ai"])

SYSTEM_PROMPT = """You are PropAIrty Assistant, an expert AI built into PropAIrty — a UK property management platform.

You help letting agents and landlords manage their portfolio. You have live access to their data via tools.
Always call the relevant tool to get live data before answering. Never make up numbers.

Your capabilities:
- Answer questions about their portfolio, properties, tenants, leases, maintenance
- Create maintenance requests
- Find leases expiring soon and flag arrears risks
- Draft professional UK-standard letters (rent reminders, Section 8/21 notices, inspection notices, lease renewal offers)

When drafting letters, call draft_letter to get tenant context, then write the full letter.
Always address letters formally. Sign off as "PropAIrty Management".
Be concise and helpful.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_stats",
            "description": "Get portfolio overview: properties, units, occupancy rate, rent roll, open maintenance issues.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_properties",
            "description": "List all properties with their units, addresses, rents and occupancy status.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tenants",
            "description": "List tenants, optionally filtered by name. Returns current unit and active lease.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Name search filter"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_leases",
            "description": "List leases filtered by status or find leases expiring within N days.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["active", "expired", "terminated"]},
                    "expiring_within_days": {"type": "integer", "description": "Find leases expiring within this many days"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_maintenance",
            "description": "List maintenance requests, optionally filtered by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["open", "in_progress", "completed"]}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_maintenance_request",
            "description": "Create a new maintenance request for a unit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_id": {"type": "integer"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "reported_by": {"type": "string"}
                },
                "required": ["unit_id", "title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_compliance",
            "description": "List compliance certificates (Gas Safety, EPC, EICR, Fire Risk, Legionella). Filter by status: valid, expiring_soon, expired.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["valid", "expiring_soon", "expired"]}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_arrears",
            "description": "List all tenants in arrears — overdue or partial rent payments. Shows amount owed, days overdue, contact details.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draft_letter",
            "description": "Get tenant/lease context to draft a letter. Types: rent_reminder, section_8, section_21, inspection_notice, lease_renewal, welcome_letter, arrears_warning.",
            "parameters": {
                "type": "object",
                "properties": {
                    "letter_type": {"type": "string"},
                    "tenant_id": {"type": "integer"},
                    "lease_id": {"type": "integer"},
                    "custom_notes": {"type": "string"}
                },
                "required": ["letter_type"]
            }
        }
    }
]

def parse_text_tool_call(text: str):
    """Detect if the model output a tool call as JSON text and parse it."""
    import re
    text = text.strip()
    # Match {"name": "...", "parameters": {...}} or {"name": "...", "arguments": {...}}
    patterns = [
        r'\{"name"\s*:\s*"([^"]+)"\s*,\s*"(?:parameters|arguments)"\s*:\s*(\{[^}]*\})\}',
        r'\{"function"\s*:\s*\{"name"\s*:\s*"([^"]+)"',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            name = m.group(1)
            try:
                args = json.loads(m.group(2)) if len(m.groups()) > 1 else {}
            except Exception:
                args = {}
            return name, args
    return None, None


TOOL_FN_MAP = {
    "get_dashboard_stats": ai_tools.get_dashboard_stats,
    "list_properties": ai_tools.list_properties,
    "list_tenants": ai_tools.list_tenants,
    "list_leases": ai_tools.list_leases,
    "list_maintenance": ai_tools.list_maintenance,
    "create_maintenance_request": ai_tools.create_maintenance_request,
    "list_compliance": ai_tools.list_compliance,
    "list_arrears": ai_tools.list_arrears,
    "draft_letter": ai_tools.draft_letter,
}


def get_client():
    """Return OpenAI-compatible client: Ollama local first, Mistral fallback."""
    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    try:
        import httpx
        r = httpx.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            return OpenAI(base_url=ollama_url, api_key="ollama"), "llama3.2:3b"
    except Exception:
        pass

    mistral_key = os.environ.get("MISTRAL_API_KEY", "")
    if mistral_key:
        return OpenAI(base_url="https://api.mistral.ai/v1", api_key=mistral_key), "mistral-small-latest"

    raise HTTPException(status_code=500, detail="No AI provider available")


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client, model = get_client()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    # Agentic loop
    for _ in range(10):
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )

        choice = response.choices[0]
        msg = choice.message
        finish = choice.finish_reason

        # Add assistant turn to history
        asst = {"role": "assistant", "content": msg.content or ""}
        if msg.tool_calls:
            asst["tool_calls"] = [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ]
        messages.append(asst)

        if finish == "stop" or not msg.tool_calls:
            content = msg.content or ""
            # Fallback: detect if model output a tool call as text (small model quirk)
            tool_name, tool_args = parse_text_tool_call(content)
            if tool_name and tool_name in TOOL_FN_MAP:
                fn = TOOL_FN_MAP[tool_name]
                result = fn(db=db, org_id=current_user.organisation_id, **(tool_args or {}))
                messages.append({"role": "user", "content": f"Tool result for {tool_name}: {json.dumps(result)}\n\nNow answer the user's question using this data."})
                continue
            return {"reply": content, "model": model}

        # Execute tools
        for tc in msg.tool_calls:
            fn = TOOL_FN_MAP.get(tc.function.name)
            args = json.loads(tc.function.arguments) if tc.function.arguments else {}
            result = fn(db=db, org_id=current_user.organisation_id, **args) if fn else {"error": f"Unknown tool: {tc.function.name}"}
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result)
            })

    return {"reply": "I could not complete that request. Please try again.", "model": model}
