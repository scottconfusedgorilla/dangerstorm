"""Contract tests — verify server and client agree on interfaces.

These tests catch synchronization bugs where a constant or marker name
is changed on one side but not the other.
"""

from utils import ANON_DAILY_LIMIT, OUTPUT_TAGS, TIER_IDEA_LIMITS


class TestOutputMarkerContract:
    """The six output marker tags must match what SYSTEM_PROMPT and app.js expect."""

    def test_exactly_six_tags(self):
        """DangerStorm produces exactly 6 output blocks."""
        assert len(OUTPUT_TAGS) == 6

    def test_tag_names(self):
        """Tags must be OUTPUT_1 through OUTPUT_6 — server.py SYSTEM_PROMPT
        and app.js parseOutputs() both rely on this exact naming."""
        assert OUTPUT_TAGS == (
            "OUTPUT_1", "OUTPUT_2", "OUTPUT_3",
            "OUTPUT_4", "OUTPUT_5", "OUTPUT_6",
        )

    def test_tags_are_strings(self):
        """All tags must be plain strings (used in regex construction)."""
        for tag in OUTPUT_TAGS:
            assert isinstance(tag, str)


class TestTierLimitContract:
    """Tier names and limits must match what server.py and the frontend expect."""

    def test_known_tiers(self):
        """The three tiers the system uses must all be defined."""
        assert "free" in TIER_IDEA_LIMITS
        assert "pioneer" in TIER_IDEA_LIMITS
        assert "pro" in TIER_IDEA_LIMITS

    def test_no_extra_tiers(self):
        """Only the three expected tiers should exist."""
        assert set(TIER_IDEA_LIMITS.keys()) == {"free", "pioneer", "pro"}

    def test_pro_and_pioneer_equal(self):
        """Pro and pioneer share the same limit (99) — dashboard.js relies on this."""
        assert TIER_IDEA_LIMITS["pro"] == TIER_IDEA_LIMITS["pioneer"]

    def test_free_is_lower(self):
        """Free tier must have a lower limit than paid tiers."""
        assert TIER_IDEA_LIMITS["free"] < TIER_IDEA_LIMITS["pro"]


class TestAnonLimitContract:
    """Anonymous rate limit constant must match what anon-status endpoint returns."""

    def test_default_limit_is_three(self):
        """Free users get 3 conversations per 24 hours — matched in app.js anon UI."""
        assert ANON_DAILY_LIMIT == 3
