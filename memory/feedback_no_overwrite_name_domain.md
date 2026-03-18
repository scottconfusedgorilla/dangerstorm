---
name: Never overwrite product name or domain on re-save
description: When re-saving an existing idea, never update product_name or domain — only tagline, status, updated_at
type: feedback
---

When re-saving an existing idea (existingIdeaId is set), never update the product name or domain fields. These are set once at creation and can only be edited manually from the dashboard.

**Why:** The AI often changes the product name or domain during refinement conversations, and the user doesn't want those changes silently overwriting the canonical name/domain they chose.

**How to apply:** In the save_idea endpoint, the update path should only touch tagline, status, and updated_at. Product name and domain changes require explicit user action (e.g., inline editing on the dashboard).
