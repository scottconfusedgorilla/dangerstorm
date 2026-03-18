---
name: Client-server parameter contracts
description: When client JS and server Python share query parameters or field names, define the contract in utils.py with tests. Prevents stale reference crashes.
type: feedback
---

When removing or renaming a filter parameter, variable, or field that exists in both client JS and server Python, the other side can retain a stale reference that crashes at runtime.

**Why:** Build 020 removed `artistId` from the variable declaration in catalog.js but left `if (artistId) url += ...` on the next line. This caused a ReferenceError that made all items disappear in production. No test caught it.

**How to apply:**
- Define shared parameter contracts in `utils.py` (e.g., `ITEMS_FILTER_PARAMS`)
- Write contract tests that verify the exact set of valid params
- When adding/removing a param, the contract test forces both sides to update
- Client JS should use a single `buildXxxUrl(params)` function (not inline string concat) so all param references are in one auditable place
- The pattern: contract constant → contract test → client builder function → server handler
