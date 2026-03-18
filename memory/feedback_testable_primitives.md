---
name: Testable primitives principle
description: Complex logic should be server-side endpoints with tests, never duplicated client-side. Avoid parallel implementations in Python and JS.
type: feedback
---

Hard calculations (coordinate math, business rules, formatting) should be server-side endpoints, not inline client JS.

**Why:** Client-side math is untestable in our workflow — the only test is "deploy and look at it," leading to multiple screenshot-debug-push cycles (e.g., 4 rounds to fix crop offset math). Also, duplicating logic in Python (server) and JS (client) leads to predictable divergence bugs — see Caliper project as example.

**How to apply:**
- Extract any non-trivial logic into a server endpoint
- Write test cases for that endpoint
- Client just calls the endpoint and applies the result
- Never implement the same calculation in both Python and JS
- Ideal flow: deploy to staging → run tests → promote to production only if tests pass
