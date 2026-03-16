"""DangerStorm — pure utility functions (testable primitives).

All business logic is extracted here as side-effect-free functions.
Endpoints in server.py call these and handle only I/O, auth, and DB.
"""

import re
import uuid as uuid_module

# ── Constants ─────────────────────────────────────────────────

ANON_DAILY_LIMIT = 3

TIER_IDEA_LIMITS = {
    "free": 19,
    "pioneer": 99,
    "pro": 99,
}

# The six output marker tags that Claude produces and the frontend parses.
OUTPUT_TAGS = ("OUTPUT_1", "OUTPUT_2", "OUTPUT_3", "OUTPUT_4", "OUTPUT_5", "OUTPUT_6")


# ── Anonymous rate limiting ───────────────────────────────────

def parse_forwarded_ip(header_value):
    """Extract the first (client) IP from an X-Forwarded-For header.

    Args:
        header_value: Raw header string, e.g. "1.2.3.4, 10.0.0.1" or None.

    Returns:
        The first IP as a string, or None if header_value is falsy.
    """
    if not header_value:
        return None
    if "," in header_value:
        return header_value.split(",")[0].strip()
    return header_value.strip()


def check_anon_limit(timestamps, now, daily_limit=ANON_DAILY_LIMIT):
    """Evaluate whether an anonymous user may start a new conversation.

    Pure function — does NOT mutate the timestamps list.

    Args:
        timestamps: List of Unix timestamps of previous conversations.
        now: Current Unix timestamp.
        daily_limit: Max conversations in a 24-hour window.

    Returns:
        (allowed, remaining, pruned_timestamps) where pruned_timestamps
        is a new list with entries older than 24 h removed.
    """
    cutoff = now - 86400
    recent = [t for t in timestamps if t > cutoff]
    used = len(recent)
    remaining = max(0, daily_limit - used)
    return used < daily_limit, remaining, recent


# ── Idea management helpers ───────────────────────────────────

def max_ideas_for_tier(tier):
    """Return the idea-count cap for a given tier.

    Args:
        tier: One of "free", "pioneer", "pro".

    Returns:
        Integer limit. Unknown tiers default to the free limit.
    """
    return TIER_IDEA_LIMITS.get(tier, TIER_IDEA_LIMITS["free"])


def idea_limit_reached(idea_count, tier):
    """Check whether a user has hit their idea cap.

    Args:
        idea_count: Current number of non-trashed ideas.
        tier: User's tier string.

    Returns:
        True if the user cannot create another idea.
    """
    return idea_count >= max_ideas_for_tier(tier)


def generate_placeholder_domain():
    """Return a unique placeholder domain for ideas saved without one.

    Format: "none-{8-hex-chars}", e.g. "none-a1b2c3d4".
    """
    return f"none-{uuid_module.uuid4().hex[:8]}"


def sanitize_domain(domain):
    """Normalize a domain value, substituting a placeholder if empty/None.

    Args:
        domain: Raw domain string from client.

    Returns:
        (domain, is_placeholder) tuple.
    """
    if not domain or domain == "None":
        return generate_placeholder_domain(), True
    return domain, False


# ── Data sanitization ─────────────────────────────────────────

def strip_null_bytes(obj):
    """Recursively strip \\u0000 from strings — PostgreSQL text columns reject them.

    Args:
        obj: Any JSON-compatible value (str, dict, list, int, float, bool, None).

    Returns:
        A new object with null bytes removed from all strings.
    """
    if isinstance(obj, str):
        return obj.replace("\x00", "")
    if isinstance(obj, dict):
        return {k: strip_null_bytes(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [strip_null_bytes(v) for v in obj]
    return obj


# ── Output marker parsing ─────────────────────────────────────

def parse_output_markers(text):
    """Extract OUTPUT_1 through OUTPUT_6 from a Claude response.

    This is the single source of truth for marker parsing — both server
    and client should agree on these marker names.

    Args:
        text: Full assistant response text.

    Returns:
        dict with keys "output1"–"output6" (trimmed content or ""),
        "hasOutputs" (bool), and "conversationText" (text with markers removed).
    """
    results = {}
    for i, tag in enumerate(OUTPUT_TAGS, start=1):
        pattern = re.compile(rf"==={tag}_START===\s*([\s\S]*?)\s*==={tag}_END===")
        match = pattern.search(text)
        results[f"output{i}"] = match.group(1).strip() if match else ""

    has_outputs = bool(results["output1"])

    # Remove all marker blocks to get pure conversational text
    clean = re.sub(r"===OUTPUT_\d_START===[\s\S]*?===OUTPUT_\d_END===", "", text).strip()

    results["hasOutputs"] = has_outputs
    results["conversationText"] = clean
    return results


# ── PPT response cleaning ─────────────────────────────────────

def strip_code_fences(text):
    """Remove markdown code fences from a string (e.g. ```json ... ```).

    Args:
        text: Raw text that may be wrapped in triple backticks.

    Returns:
        The inner content with fences stripped, or the original text if none found.
    """
    stripped = text.strip()
    if stripped.startswith("```"):
        # Remove opening fence line
        stripped = stripped.split("\n", 1)[1] if "\n" in stripped else stripped[3:]
        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()
    return stripped
