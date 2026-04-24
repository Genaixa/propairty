import feedparser
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/news", tags=["news"])

RSS_FEEDS = [
    {"name": "Estate Agent Today",   "url": "https://www.estateagenttoday.co.uk/rss.xml"},
    {"name": "Property Industry Eye","url": "https://propertyindustryeye.com/feed/"},
    {"name": "Property Reporter",    "url": "https://www.propertyreporter.co.uk/feed/"},
    {"name": "The Negotiator",       "url": "https://thenegotiator.co.uk/feed/"},
]

_cache = {}
CACHE_TTL_HOURS = 1


def _is_cache_fresh():
    if not _cache.get("cached_at"):
        return False
    return datetime.utcnow() - _cache["cached_at"] < timedelta(hours=CACHE_TTL_HOURS)


def fetch_all_articles(max_per_feed=10):
    """Pull up to max_per_feed articles from each feed — broad pool for AI to select from."""
    articles = []
    for feed_info in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_info["url"])
            for entry in feed.entries[:max_per_feed]:
                articles.append({
                    "source": feed_info["name"],
                    "title": entry.get("title", "").strip(),
                    "url":   entry.get("link", ""),
                    "summary": entry.get("summary", entry.get("description", ""))[:300].strip(),
                    "published": entry.get("published", ""),
                })
        except Exception:
            continue
    return articles


def score_and_select(articles: list) -> list:
    """
    Use Claude to pick the ~20 most relevant articles for a UK letting agent
    and score each 1-5. Returns articles sorted by score descending.
    """
    if not articles:
        return []

    from app.routers.intelligence import _claude

    numbered = "\n".join(
        f"{i}. [{a['source']}] {a['title']}"
        for i, a in enumerate(articles)
    )

    prompt = f"""You are an expert assistant for a UK residential letting agent.

Below are {len(articles)} property news headlines (numbered). Your job:
1. Select the ~20 most relevant and important ones for a UK letting agent to read today.
   Prioritise: legislation/regulation changes, rental market trends, landlord/tenant law,
   deposit rules, eviction law, energy efficiency requirements, interest rates affecting
   landlords, housing supply, Rightmove/Zoopla/portal news, agent industry news.
   Deprioritise: housebuilding, commercial property, mortgages for buyers, overseas property.
2. Score each selected article 1–5 (5 = critical/must-read, 1 = mildly interesting).
3. Return ONLY a JSON array, no markdown, no explanation:
[{{"index": 0, "score": 5}}, {{"index": 3, "score": 3}}, ...]

Headlines:
{numbered}"""

    raw = _claude(prompt, max_tokens=600)

    try:
        # Extract JSON array
        import re
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        scored = json.loads(match.group()) if match else []
    except Exception:
        # Fallback: return all articles unscored
        return [dict(a, score=3) for a in articles[:20]]

    # Build sorted result
    result = []
    for item in scored:
        idx = item.get("index")
        score = item.get("score", 3)
        if idx is not None and 0 <= idx < len(articles):
            result.append(dict(articles[idx], score=score))

    # Sort by score descending
    result.sort(key=lambda a: a["score"], reverse=True)
    return result


def refresh_cache():
    articles = fetch_all_articles()
    scored = score_and_select(articles)
    _cache["articles"] = scored
    _cache["cached_at"] = datetime.utcnow()


@router.get("")
def get_news(current_user: User = Depends(get_current_user)):
    return {
        "articles": _cache.get("articles", []),
        "cached_at": _cache["cached_at"].isoformat() if _cache.get("cached_at") else None,
        "is_fresh": _is_cache_fresh(),
    }
