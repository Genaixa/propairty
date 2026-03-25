import feedparser
import httpx
import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/news", tags=["news"])

# UK property industry RSS feeds
RSS_FEEDS = [
    {"name": "Estate Agent Today", "url": "https://www.estateagenttoday.co.uk/rss.xml"},
    {"name": "Property Industry Eye", "url": "https://propertyindustryeye.com/feed/"},
    {"name": "Property Reporter", "url": "https://www.propertyreporter.co.uk/feed/"},
    {"name": "The Negotiator", "url": "https://thenegotiator.co.uk/feed/"},
]

# In-memory cache: {articles: [...], summary: "...", cached_at: datetime}
_cache = {}
CACHE_TTL_HOURS = 4


def _is_cache_fresh():
    if not _cache.get("cached_at"):
        return False
    return datetime.utcnow() - _cache["cached_at"] < timedelta(hours=CACHE_TTL_HOURS)


def fetch_articles(max_per_feed=5):
    articles = []
    for feed_info in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_info["url"])
            for entry in feed.entries[:max_per_feed]:
                articles.append({
                    "source": feed_info["name"],
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "summary": entry.get("summary", entry.get("description", ""))[:300],
                    "published": entry.get("published", ""),
                })
        except Exception:
            continue
    return articles


def ai_curate(articles: list) -> dict:
    """Send headlines to AI and get a curated briefing."""
    if not articles:
        return {"briefing": "No news available right now.", "highlights": [], "flagged": []}

    # Use top 8 articles to keep prompt short enough for small models
    top = articles[:8]
    headlines = "\n".join(
        f"- {a['title']} ({a['source']})"
        for a in top
    )

    prompt = f"""You are an assistant for a UK letting agent. Analyse these property news headlines and return ONLY a JSON object, no markdown, no explanation.

Headlines:
{headlines}

Return this exact JSON structure:
{{"briefing":"2-3 sentences summarising key themes and what letting agents should know","highlights":[{{"title":"short headline","reason":"why it matters to a letting agent"}}],"flagged":[{{"title":"headline","action":"what the agent should do"}}]}}

Rules: highlights has 3-5 items, flagged has 0-3 items, return only JSON."""

    # Try Ollama first, then Mistral
    client = model = None
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            from openai import OpenAI
            client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
            model = "llama3.2:3b"
    except Exception:
        pass

    if not client:
        mistral_key = os.environ.get("MISTRAL_API_KEY", "")
        if mistral_key:
            from openai import OpenAI
            client = OpenAI(base_url="https://api.mistral.ai/v1", api_key=mistral_key)
            model = "mistral-small-latest"

    if not client:
        return {
            "briefing": "AI briefing unavailable — showing raw headlines.",
            "highlights": [{"title": a["title"], "reason": a["source"]} for a in articles[:5]],
            "flagged": [],
        }

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            timeout=60,
        )
        text = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:].strip()
        # Extract JSON object if there's surrounding text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            text = text[start:end]
        return json.loads(text)
    except Exception as e:
        return {
            "briefing": "AI briefing could not be generated right now. Here are the latest headlines.",
            "highlights": [{"title": a["title"], "reason": a["source"]} for a in articles[:5]],
            "flagged": [],
        }


def refresh_cache():
    articles = fetch_articles()
    curation = ai_curate(articles)
    _cache["articles"] = articles
    _cache["curation"] = curation
    _cache["cached_at"] = datetime.utcnow()


@router.get("")
def get_news(current_user: User = Depends(get_current_user)):
    if not _is_cache_fresh():
        refresh_cache()
    return {
        "articles": _cache.get("articles", []),
        "curation": _cache.get("curation", {}),
        "cached_at": _cache["cached_at"].isoformat() if _cache.get("cached_at") else None,
        "next_refresh_hours": CACHE_TTL_HOURS,
    }


@router.post("/refresh")
def force_refresh(current_user: User = Depends(get_current_user)):
    refresh_cache()
    return {"ok": True, "article_count": len(_cache.get("articles", []))}
