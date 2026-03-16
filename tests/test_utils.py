"""Tests for utils.py — DangerStorm's testable primitives.

Each test includes a docstring explaining what it verifies and why.
"""

import time

from utils import (
    ANON_DAILY_LIMIT,
    OUTPUT_TAGS,
    check_anon_limit,
    generate_placeholder_domain,
    idea_limit_reached,
    max_ideas_for_tier,
    parse_forwarded_ip,
    parse_output_markers,
    sanitize_domain,
    strip_code_fences,
    strip_null_bytes,
)


# ── parse_forwarded_ip ────────────────────────────────────────


class TestParseForwardedIp:
    """Extract the first client IP from X-Forwarded-For header values."""

    def test_single_ip(self):
        """Simple case: header contains one IP."""
        assert parse_forwarded_ip("203.0.113.50") == "203.0.113.50"

    def test_multiple_ips(self):
        """Proxy chain: first IP is the real client."""
        assert parse_forwarded_ip("203.0.113.50, 70.41.3.18, 150.172.238.178") == "203.0.113.50"

    def test_multiple_ips_with_spaces(self):
        """Spaces around IPs should be stripped."""
        assert parse_forwarded_ip("  1.2.3.4 , 5.6.7.8 ") == "1.2.3.4"

    def test_none_returns_none(self):
        """Missing header should return None, not crash."""
        assert parse_forwarded_ip(None) is None

    def test_empty_string_returns_none(self):
        """Empty string is falsy, should return None."""
        assert parse_forwarded_ip("") is None

    def test_ipv6(self):
        """IPv6 addresses should pass through unchanged."""
        assert parse_forwarded_ip("::1") == "::1"


# ── check_anon_limit ─────────────────────────────────────────


class TestCheckAnonLimit:
    """Evaluate anonymous rate limiting without side effects."""

    def test_no_history_allowed(self):
        """Fresh user with no timestamps should be allowed."""
        allowed, remaining, pruned = check_anon_limit([], time.time())
        assert allowed is True
        assert remaining == ANON_DAILY_LIMIT
        assert pruned == []

    def test_under_limit(self):
        """User with 2 recent conversations still has 1 remaining."""
        now = time.time()
        timestamps = [now - 100, now - 200]
        allowed, remaining, pruned = check_anon_limit(timestamps, now)
        assert allowed is True
        assert remaining == 1
        assert len(pruned) == 2

    def test_at_limit_blocked(self):
        """User with exactly 3 recent conversations should be blocked."""
        now = time.time()
        timestamps = [now - 100, now - 200, now - 300]
        allowed, remaining, pruned = check_anon_limit(timestamps, now)
        assert allowed is False
        assert remaining == 0

    def test_old_entries_pruned(self):
        """Conversations older than 24 hours should not count.
        2 old + 1 recent = 1 used, 2 remaining, allowed.
        """
        now = time.time()
        timestamps = [now - 90000, now - 90001, now - 100]  # two old, one recent
        allowed, remaining, pruned = check_anon_limit(timestamps, now)
        assert allowed is True
        assert remaining == 2
        assert len(pruned) == 1

    def test_all_old_entries_reset(self):
        """All conversations expired — should be fully reset."""
        now = time.time()
        timestamps = [now - 90000, now - 100000, now - 200000]
        allowed, remaining, pruned = check_anon_limit(timestamps, now)
        assert allowed is True
        assert remaining == ANON_DAILY_LIMIT
        assert pruned == []

    def test_does_not_mutate_input(self):
        """The original list must not be modified — pure function contract."""
        now = time.time()
        original = [now - 90000, now - 100]
        original_copy = list(original)
        check_anon_limit(original, now)
        assert original == original_copy

    def test_custom_limit(self):
        """Custom daily_limit overrides the default."""
        now = time.time()
        timestamps = [now - 100]
        allowed, remaining, _ = check_anon_limit(timestamps, now, daily_limit=1)
        assert allowed is False
        assert remaining == 0


# ── max_ideas_for_tier / idea_limit_reached ───────────────────


class TestIdeaLimits:
    """Tier-based idea cap logic."""

    def test_free_tier(self):
        """Free users get 19 ideas."""
        assert max_ideas_for_tier("free") == 19

    def test_pioneer_tier(self):
        """Pioneer users get 99 ideas."""
        assert max_ideas_for_tier("pioneer") == 99

    def test_pro_tier(self):
        """Pro users get 99 ideas."""
        assert max_ideas_for_tier("pro") == 99

    def test_unknown_tier_defaults_to_free(self):
        """Unknown tier strings should fall back to the free limit."""
        assert max_ideas_for_tier("enterprise") == 19
        assert max_ideas_for_tier("") == 19

    def test_limit_not_reached(self):
        """18 ideas on free tier — room for one more."""
        assert idea_limit_reached(18, "free") is False

    def test_limit_exactly_reached(self):
        """19 ideas on free tier — cap hit."""
        assert idea_limit_reached(19, "free") is True

    def test_limit_exceeded(self):
        """20 ideas on free tier — over cap (shouldn't happen, but still True)."""
        assert idea_limit_reached(20, "free") is True

    def test_pro_not_reached(self):
        """50 ideas on pro tier — well under 99."""
        assert idea_limit_reached(50, "pro") is False

    def test_pro_reached(self):
        """99 ideas on pro tier — cap hit."""
        assert idea_limit_reached(99, "pro") is True


# ── generate_placeholder_domain / sanitize_domain ─────────────


class TestDomainHelpers:
    """Domain placeholder generation and sanitization."""

    def test_placeholder_format(self):
        """Placeholder should be 'none-' followed by 8 hex chars."""
        d = generate_placeholder_domain()
        assert d.startswith("none-")
        assert len(d) == 13  # "none-" (5) + 8 hex chars

    def test_placeholder_uniqueness(self):
        """Two calls should produce different domains."""
        assert generate_placeholder_domain() != generate_placeholder_domain()

    def test_sanitize_none_string(self):
        """The literal string 'None' should become a placeholder."""
        domain, is_placeholder = sanitize_domain("None")
        assert is_placeholder is True
        assert domain.startswith("none-")

    def test_sanitize_empty_string(self):
        """Empty string should become a placeholder."""
        domain, is_placeholder = sanitize_domain("")
        assert is_placeholder is True
        assert domain.startswith("none-")

    def test_sanitize_none_value(self):
        """Python None should become a placeholder."""
        domain, is_placeholder = sanitize_domain(None)
        assert is_placeholder is True

    def test_sanitize_real_domain(self):
        """A real domain should pass through unchanged."""
        domain, is_placeholder = sanitize_domain("dangerstorm.net")
        assert domain == "dangerstorm.net"
        assert is_placeholder is False


# ── strip_null_bytes ──────────────────────────────────────────


class TestStripNullBytes:
    """Recursively remove \\x00 from nested structures."""

    def test_clean_string(self):
        """String without null bytes should pass through unchanged."""
        assert strip_null_bytes("hello") == "hello"

    def test_string_with_nulls(self):
        """Null bytes should be removed from strings."""
        assert strip_null_bytes("hel\x00lo") == "hello"

    def test_nested_dict(self):
        """Null bytes inside dict values should be cleaned."""
        result = strip_null_bytes({"a": "foo\x00bar", "b": "clean"})
        assert result == {"a": "foobar", "b": "clean"}

    def test_nested_list(self):
        """Null bytes inside list elements should be cleaned."""
        result = strip_null_bytes(["a\x00b", "cd"])
        assert result == ["ab", "cd"]

    def test_deeply_nested(self):
        """Dict containing list containing dict with null bytes."""
        data = {"items": [{"name": "x\x00y"}]}
        result = strip_null_bytes(data)
        assert result == {"items": [{"name": "xy"}]}

    def test_non_string_passthrough(self):
        """Integers, floats, booleans, None should pass through unchanged."""
        assert strip_null_bytes(42) == 42
        assert strip_null_bytes(3.14) == 3.14
        assert strip_null_bytes(True) is True
        assert strip_null_bytes(None) is None


# ── parse_output_markers ──────────────────────────────────────


class TestParseOutputMarkers:
    """Extract OUTPUT_1 through OUTPUT_6 from Claude response text."""

    SAMPLE_RESPONSE = (
        "Great idea! Here are your outputs:\n\n"
        "===OUTPUT_1_START===\nDeck prompt content here\n===OUTPUT_1_END===\n\n"
        "===OUTPUT_2_START===\nCarrd copy here\n===OUTPUT_2_END===\n\n"
        "===OUTPUT_3_START===\nKit form copy\n===OUTPUT_3_END===\n\n"
        "===OUTPUT_4_START===\nIntro pitch\n===OUTPUT_4_END===\n\n"
        "===OUTPUT_5_START===\nOne-line summary\n===OUTPUT_5_END===\n\n"
        "===OUTPUT_6_START===\nBuild prompt\n===OUTPUT_6_END===\n"
    )

    def test_all_six_outputs_extracted(self):
        """All six marker blocks should be captured."""
        result = parse_output_markers(self.SAMPLE_RESPONSE)
        assert result["output1"] == "Deck prompt content here"
        assert result["output2"] == "Carrd copy here"
        assert result["output3"] == "Kit form copy"
        assert result["output4"] == "Intro pitch"
        assert result["output5"] == "One-line summary"
        assert result["output6"] == "Build prompt"

    def test_has_outputs_true(self):
        """hasOutputs should be True when OUTPUT_1 is present."""
        result = parse_output_markers(self.SAMPLE_RESPONSE)
        assert result["hasOutputs"] is True

    def test_has_outputs_false_when_no_output1(self):
        """hasOutputs should be False when OUTPUT_1 is missing, even if others exist."""
        text = "===OUTPUT_2_START===\nSome content\n===OUTPUT_2_END==="
        result = parse_output_markers(text)
        assert result["hasOutputs"] is False

    def test_conversation_text_strips_markers(self):
        """conversationText should contain only the non-marker text."""
        result = parse_output_markers(self.SAMPLE_RESPONSE)
        assert "===OUTPUT" not in result["conversationText"]
        assert "Great idea! Here are your outputs:" in result["conversationText"]

    def test_no_markers_at_all(self):
        """Plain conversational text with no markers."""
        text = "Tell me more about your idea."
        result = parse_output_markers(text)
        assert result["hasOutputs"] is False
        assert result["output1"] == ""
        assert result["conversationText"] == text

    def test_whitespace_trimmed(self):
        """Content inside markers should be trimmed of leading/trailing whitespace."""
        text = "===OUTPUT_1_START===\n\n  Deck content  \n\n===OUTPUT_1_END==="
        result = parse_output_markers(text)
        assert result["output1"] == "Deck content"

    def test_multiline_content(self):
        """Markers can contain multi-line content with internal newlines."""
        text = "===OUTPUT_1_START===\nLine 1\nLine 2\nLine 3\n===OUTPUT_1_END==="
        result = parse_output_markers(text)
        assert result["output1"] == "Line 1\nLine 2\nLine 3"


# ── strip_code_fences ─────────────────────────────────────────


class TestStripCodeFences:
    """Remove markdown code fences from PPT JSON responses."""

    def test_json_fences(self):
        """```json ... ``` should be unwrapped."""
        text = '```json\n{"title": "Test"}\n```'
        assert strip_code_fences(text) == '{"title": "Test"}'

    def test_plain_fences(self):
        """``` ... ``` without a language tag should also be unwrapped."""
        text = '```\n{"title": "Test"}\n```'
        assert strip_code_fences(text) == '{"title": "Test"}'

    def test_no_fences(self):
        """Text without fences should pass through unchanged."""
        text = '{"title": "Test"}'
        assert strip_code_fences(text) == '{"title": "Test"}'

    def test_leading_trailing_whitespace(self):
        """Surrounding whitespace should be handled before fence detection."""
        text = '  ```json\n{"ok": true}\n```  '
        assert strip_code_fences(text) == '{"ok": true}'

    def test_inner_backticks_preserved(self):
        """Backticks inside the content (not at start) should not be stripped."""
        text = 'Here is some `inline code` in text'
        assert strip_code_fences(text) == 'Here is some `inline code` in text'
