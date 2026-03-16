"""Tests for the idea save/re-save flow — DangerStorm's most critical path.

Covers the decision logic extracted to utils.py that determines whether
a save request creates a new idea or updates an existing one, what status
to assign, and how version numbers are computed.
"""

from utils import (
    classify_save_request,
    compute_next_version,
    determine_idea_status,
    idea_limit_reached,
)


# ── classify_save_request ─────────────────────────────────────


class TestClassifySaveRequest:
    """Decide new-vs-update based on existingIdeaId and ownership query result."""

    def test_no_existing_id_is_new(self):
        """No existingIdeaId → always a new idea."""
        is_new, idea_id = classify_save_request(None, [])
        assert is_new is True
        assert idea_id is None

    def test_empty_string_existing_id_is_new(self):
        """Empty string existingIdeaId → treated as new (falsy)."""
        is_new, idea_id = classify_save_request("", [])
        assert is_new is True
        assert idea_id is None

    def test_valid_existing_id_with_match(self):
        """existingIdeaId found in DB for this user → update, not new."""
        check_data = [{"id": "abc-123", "product_name": "My Idea"}]
        is_new, idea_id = classify_save_request("abc-123", check_data)
        assert is_new is False
        assert idea_id == "abc-123"

    def test_existing_id_not_found_trashed(self):
        """existingIdeaId provided but query returned nothing (idea was trashed).
        Current behavior: falls through to new. This could cause a duplicate
        domain error if the domain still exists on another active idea.
        """
        is_new, idea_id = classify_save_request("abc-123", [])
        assert is_new is True
        assert idea_id is None

    def test_existing_id_not_found_wrong_user(self):
        """existingIdeaId belongs to a different user → query returns empty.
        Same fallthrough behavior as trashed.
        """
        is_new, idea_id = classify_save_request("other-user-idea", [])
        assert is_new is True
        assert idea_id is None

    def test_existing_id_with_none_check_data(self):
        """check_data is None (defensive) → treat as new."""
        is_new, idea_id = classify_save_request("abc-123", None)
        assert is_new is True
        assert idea_id is None

    def test_multiple_matches_uses_first(self):
        """Multiple rows returned (shouldn't happen) → uses the first one."""
        check_data = [
            {"id": "first-id", "product_name": "First"},
            {"id": "second-id", "product_name": "Second"},
        ]
        is_new, idea_id = classify_save_request("first-id", check_data)
        assert is_new is False
        assert idea_id == "first-id"

    def test_existing_id_returns_db_id_not_client_id(self):
        """The returned idea_id comes from the DB row, not the client param.
        This matters if the client somehow sends a different ID than what's in check_data.
        """
        check_data = [{"id": "db-id-456", "product_name": "From DB"}]
        is_new, idea_id = classify_save_request("client-id-789", check_data)
        assert is_new is False
        assert idea_id == "db-id-456"


# ── determine_idea_status ─────────────────────────────────────


class TestDetermineIdeaStatus:
    """Decide complete vs draft based on outputs dict."""

    def test_complete_with_output1(self):
        """Outputs containing a deck prompt (output1) → complete."""
        outputs = {"output1": "Full deck prompt here", "output2": "Carrd copy"}
        assert determine_idea_status(outputs) == "complete"

    def test_draft_with_empty_output1(self):
        """output1 is empty string → draft.
        This can happen if the user re-saves mid-conversation before
        outputs are generated.
        """
        outputs = {"output1": "", "output2": ""}
        assert determine_idea_status(outputs) == "draft"

    def test_draft_with_no_outputs(self):
        """Empty outputs dict → draft."""
        assert determine_idea_status({}) == "draft"

    def test_draft_with_none_outputs(self):
        """None outputs → draft (defensive)."""
        assert determine_idea_status(None) == "draft"

    def test_draft_with_only_output2(self):
        """Has output2 but no output1 → still draft.
        output1 (deck prompt) is the gate for 'complete'.
        """
        outputs = {"output2": "Carrd copy here"}
        assert determine_idea_status(outputs) == "draft"

    def test_status_regression_complete_to_draft(self):
        """Re-saving a previously complete idea with cleared outputs → draft.
        This documents current behavior: status can regress. The caller
        is responsible for deciding whether to allow this.
        """
        # First save: complete
        assert determine_idea_status({"output1": "deck"}) == "complete"
        # Second save: outputs cleared
        assert determine_idea_status({"output1": ""}) == "draft"


# ── compute_next_version ──────────────────────────────────────


class TestComputeNextVersion:
    """Compute the next version number from existing version rows."""

    def test_no_versions(self):
        """Brand new idea with no versions → version 1."""
        assert compute_next_version([]) == 1

    def test_one_version(self):
        """One existing version → version 2."""
        assert compute_next_version([{"version_number": 1}]) == 2

    def test_multiple_versions(self):
        """Three versions → version 4."""
        data = [{"version_number": 3}, {"version_number": 2}, {"version_number": 1}]
        assert compute_next_version(data) == 4

    def test_gap_in_versions(self):
        """Non-sequential version numbers (e.g. 1, 3 — 2 was deleted).
        Should still return max+1, not fill the gap.
        """
        data = [{"version_number": 3}, {"version_number": 1}]
        assert compute_next_version(data) == 4

    def test_unsorted_input(self):
        """Input not sorted desc — should still find the max."""
        data = [{"version_number": 1}, {"version_number": 5}, {"version_number": 3}]
        assert compute_next_version(data) == 6

    def test_none_input(self):
        """None input (defensive) → version 1."""
        assert compute_next_version(None) == 1


# ── Integration: save-flow decision combinations ──────────────


class TestSaveFlowIntegration:
    """Test realistic combinations of decisions in the save flow.

    These simulate the sequence of decisions the save-idea endpoint makes,
    using the extracted pure functions.
    """

    def test_new_save_under_limit(self):
        """New idea, user under limit → allowed, creates version 1.
        Happy path for first-time save.
        """
        is_new, idea_id = classify_save_request(None, [])
        assert is_new is True
        assert not idea_limit_reached(5, "free")  # 5 < 19
        status = determine_idea_status({"output1": "deck prompt"})
        assert status == "complete"
        version = compute_next_version([])
        assert version == 1

    def test_resave_existing_idea(self):
        """Re-save with valid existingIdeaId → update, new version.
        Happy path for editing an existing idea.
        """
        check_data = [{"id": "idea-abc"}]
        is_new, idea_id = classify_save_request("idea-abc", check_data)
        assert is_new is False
        assert idea_id == "idea-abc"
        # Idea limit is NOT checked for re-saves (is_new is False)
        status = determine_idea_status({"output1": "updated deck"})
        assert status == "complete"
        version = compute_next_version([{"version_number": 2}, {"version_number": 1}])
        assert version == 3

    def test_resave_trashed_idea_falls_through(self):
        """Re-save a trashed idea → classified as new (current behavior).
        This documents a potential reliability issue: the user thinks they're
        updating, but the server creates a new idea instead.
        """
        is_new, idea_id = classify_save_request("trashed-idea-id", [])
        assert is_new is True
        assert idea_id is None
        # This would then hit the INSERT path, potentially causing a
        # duplicate domain error if the domain is already in use

    def test_new_save_at_limit_blocked(self):
        """New idea when user is at limit → blocked."""
        is_new, _ = classify_save_request(None, [])
        assert is_new is True
        assert idea_limit_reached(19, "free") is True  # 19 >= 19

    def test_resave_at_limit_allowed(self):
        """Re-save when user is at limit → allowed (limit only checked for new).
        This is critical: editing an existing idea must never be blocked by
        the idea limit. The server checks `if is_new and idea_limit_reached(...)`.
        """
        check_data = [{"id": "existing-idea"}]
        is_new, idea_id = classify_save_request("existing-idea", check_data)
        assert is_new is False
        # Even though limit is reached, the `is_new` guard means this won't block
        assert idea_limit_reached(19, "free") is True
        # The endpoint does: `if is_new and idea_limit_reached(...)` → False and True → False
        assert not (is_new and idea_limit_reached(19, "free"))

    def test_draft_resave_preserves_draft(self):
        """Re-saving mid-conversation (no outputs yet) → stays draft."""
        check_data = [{"id": "draft-idea"}]
        is_new, idea_id = classify_save_request("draft-idea", check_data)
        assert is_new is False
        status = determine_idea_status({})
        assert status == "draft"

    def test_complete_to_draft_regression_on_resave(self):
        """Re-save a complete idea but with empty outputs → status regresses to draft.
        This could happen if the client sends a re-save during a new conversation
        before outputs are generated. Documents current behavior.
        """
        check_data = [{"id": "complete-idea"}]
        is_new, _ = classify_save_request("complete-idea", check_data)
        assert is_new is False
        # Previously complete, but this re-save has no outputs
        status = determine_idea_status({"output1": ""})
        assert status == "draft"
