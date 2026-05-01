"""Shared AI utility — OpenRouter cascade: DeepSeek V3 → GPT-4o mini → Gemini Flash 2.5."""
from openai import OpenAI
from datetime import datetime

OPENROUTER_MODELS = [
    "deepseek/deepseek-chat-v3-0324",
    "openai/gpt-4o-mini",
    "google/gemini-flash-2.5",
]

DATA_BOUNDARY_FOOTER = (
    "\n\n=== ABSOLUTE DATA BOUNDARY ==="
    "\nThe data above was fetched live from the database at {ts}. It is complete and final."
    "\nRULES — no exceptions:"
    "\n1. If a name, date, number or fact is not explicitly listed above, it does not exist. Say: \"I don't have that information in your current data.\""
    "\n2. Never guess, estimate, interpolate or infer values not present."
    "\n3. Never invent tenant names, amounts, dates, certificate types, job numbers, or reference numbers."
    "\n4. If asked about a feature or capability not described in your instructions, say: \"I don't have details on that — please contact your agent.\""
    "\n=== END OF DATA ==="
)


def data_boundary() -> str:
    """Return a timestamped hard data boundary marker to append to every context."""
    return DATA_BOUNDARY_FOOTER.format(ts=datetime.now().strftime("%Y-%m-%d %H:%M"))


def openrouter_chat(messages: list, max_tokens: int = 1024) -> str:
    """Try OPENROUTER_MODELS in order, return reply text. Returns '' if all fail."""
    from app.config import settings
    if not settings.openrouter_api_key:
        return ""
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.openrouter_api_key)
    for model in OPENROUTER_MODELS:
        try:
            resp = client.chat.completions.create(
                model=model, messages=messages, max_tokens=max_tokens,
                timeout=60, temperature=0
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[openrouter] {model} failed: {e}")
    return ""
