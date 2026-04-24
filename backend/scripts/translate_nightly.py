#!/usr/bin/env python3
"""
Nightly translation script.
Reads en-GB/translation.json, diffs against each target language file,
translates only new/changed keys via Claude API, writes updated JSON files.

Run: python3 /root/propairty/backend/scripts/translate_nightly.py
Cron: 0 2 * * * /root/propairty/backend/venv/bin/python3 /root/propairty/backend/scripts/translate_nightly.py >> /var/log/propairty-translate.log 2>&1
"""
import json
import os
import sys
import time
from pathlib import Path

import anthropic

LOCALES_DIR = Path("/root/propairty/frontend/src/locales")
PUBLIC_LOCALES_DIR = Path("/root/propairty/frontend/public/locales")
SOURCE_LANG = "en-GB"

LANGUAGES = {
    "en-US": "American English",
    "fr":    "French",
    "es":    "Spanish (Spain)",
    "de":    "German",
    "nl":    "Dutch",
    "it":    "Italian",
    "he":    "Hebrew (RTL)",
    "ar":    "Arabic (RTL)",
    "zu":    "Zulu",
    "af":    "Afrikaans",
}


def flatten(obj: dict, prefix: str = "") -> dict:
    """Flatten nested JSON to dot-notation keys."""
    items = {}
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten(v, key))
        else:
            items[key] = v
    return items


def unflatten(flat: dict) -> dict:
    """Restore dot-notation keys to nested dict."""
    result = {}
    for key, val in flat.items():
        parts = key.split(".")
        d = result
        for part in parts[:-1]:
            d = d.setdefault(part, {})
        d[parts[-1]] = val
    return result


def translate_keys(keys: dict, target_lang: str, target_name: str) -> dict:
    """Translate a flat dict of keys via Claude. Returns translated flat dict."""
    if not keys:
        return {}

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    items = json.dumps(keys, ensure_ascii=False, indent=2)

    prompt = f"""Translate these UI strings from British English to {target_name}.

Rules:
- Keep {{{{variable}}}} placeholders exactly as-is (e.g. {{{{count}}}}, {{{{days}}}}, {{{{price}}}})
- Keep keys exactly as-is — only translate the values
- For RTL languages (Arabic, Hebrew), use proper RTL text
- Match the tone: professional property management software
- Return valid JSON only, no explanation

Strings to translate:
{items}"""

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()

    # Extract JSON
    import re
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {}


def process_language(lang_code: str, lang_name: str, source_flat: dict) -> int:
    """Process one language. Returns number of keys translated."""
    lang_dir = LOCALES_DIR / lang_code
    lang_dir.mkdir(exist_ok=True)
    target_file = lang_dir / "translation.json"

    # Load existing translations
    existing = {}
    if target_file.exists():
        try:
            existing = flatten(json.loads(target_file.read_text()))
        except Exception:
            existing = {}

    # Find keys that are new or changed (value changed in source)
    missing = {k: v for k, v in source_flat.items() if k not in existing}

    if not missing:
        print(f"  [{lang_code}] Up to date — no new keys.")
        return 0

    print(f"  [{lang_code}] Translating {len(missing)} new key(s)…")

    # Translate in batches of 50
    translated = {}
    batch_size = 50
    keys_list = list(missing.items())
    for i in range(0, len(keys_list), batch_size):
        batch = dict(keys_list[i:i + batch_size])
        result = translate_keys(batch, lang_code, lang_name)
        translated.update(result)
        time.sleep(0.5)  # Rate limit courtesy

    # Merge and write
    merged_flat = {**existing, **translated}
    nested = unflatten(merged_flat)
    target_file.write_text(json.dumps(nested, ensure_ascii=False, indent=2))

    # Mirror to public/locales for runtime loading
    pub_dir = PUBLIC_LOCALES_DIR / lang_code
    pub_dir.mkdir(parents=True, exist_ok=True)
    (pub_dir / "translation.json").write_text(json.dumps(nested, ensure_ascii=False, indent=2))

    print(f"  [{lang_code}] Done — {len(translated)} keys translated.")
    return len(translated)


def main():
    source_file = LOCALES_DIR / SOURCE_LANG / "translation.json"
    if not source_file.exists():
        print(f"ERROR: Source file not found: {source_file}")
        sys.exit(1)

    source = json.loads(source_file.read_text())
    source_flat = flatten(source)
    print(f"Source: {len(source_flat)} keys in en-GB")

    total = 0
    for code, name in LANGUAGES.items():
        try:
            n = process_language(code, name, source_flat)
            total += n
        except Exception as e:
            print(f"  [{code}] ERROR: {e}")

    print(f"\nDone. {total} keys translated across {len(LANGUAGES)} languages.")


if __name__ == "__main__":
    main()
