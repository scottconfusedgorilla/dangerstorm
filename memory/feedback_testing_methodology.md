---
name: Testing methodology for Flask/JS projects
description: Detailed methodology for building testable Flask+vanilla JS apps. Extract logic into pure functions, write tests before deploy, use contracts between client and server.
type: feedback
---

## Testing Methodology — Lessons from PXCatalog

### The Core Principle

**Anything that's hard to get right should be a tested primitive, not inline code.**

Client-side JS math, string formatting, business logic — if it's non-trivial, it belongs in a pure function with tests. The only test for inline JS is "deploy and look at it," which means multiple screenshot-debug-push cycles to fix bugs that a test would have caught instantly.

### Architecture Pattern

```
utils.py          — Pure functions (no Flask, no DB, no side effects)
tests/            — pytest tests for every function in utils.py
server.py         — Flask endpoints that call utils.py + handle I/O/DB
public/*.js       — Client JS that mirrors the same logic (with comments linking to tests)
```

### What Goes in utils.py

1. **Complex math** — e.g., crop/pan/zoom coordinate transforms
2. **Data transformation** — e.g., Excel import column mapping, row parsing
3. **Business rules** — e.g., title defaulting, validation logic
4. **Metadata extraction** — e.g., EXIF parsing from images
5. **Contracts** — e.g., `ITEMS_FILTER_PARAMS` defining valid query parameters

### What Stays in server.py

- Database reads/writes (Supabase calls)
- File I/O (uploads, exports)
- Authentication
- HTTP request/response handling
- Calls to utils.py functions

### The Contract Pattern (Prevents Client/Server Drift)

When client JS and server Python share parameter names, field names, or filter options:

1. Define the contract in `utils.py`:
   ```python
   ITEMS_FILTER_PARAMS = {"page", "per_page", "q", "object_type_id", "creator", "medium", "location", "sort"}
   ```

2. Write contract tests:
   ```python
   def test_current_filters(self):
       assert ITEMS_FILTER_PARAMS == {"page", "per_page", "q", ...}

   def test_no_removed_params(self):
       assert "artist_id" not in ITEMS_FILTER_PARAMS  # removed in build 020
   ```

3. Client JS uses a single builder function:
   ```javascript
   function buildItemsUrl(page, filters, sort) {
       const params = new URLSearchParams();
       // ... all params in one auditable place
   }
   ```

**Why this matters:** In build 020, we removed `artistId` from the variable declaration but forgot one reference in URL construction. The page crashed with a ReferenceError — all items disappeared in production. A contract test would have caught this before deploy.

### Test Structure

```
tests/
  __init__.py
  test_utils.py       — Crop transform math (13 tests)
  test_import.py      — Column mapping, row parsing, edge cases (28 tests)
  test_exif.py        — EXIF metadata extraction (14 tests)
  test_contracts.py   — Client/server parameter contracts (4 tests)
```

Each test class documents the expected behavior so a human can verify:
```python
def test_landscape_image_in_square_container_centered(self):
    """1000x500 image in 200x200 container, centered, no zoom.
    base_scale = max(200/1000, 200/500) = max(0.2, 0.4) = 0.4
    width = 1000 * 0.4 = 400, height = 500 * 0.4 = 200
    left = 100 - 200 = -100, top = 0
    """
    result = compute_crop_transform(1000, 500, 200, 200, 0.5, 0.5, 1)
    assert result["width"] == 400
    assert result["left"] == -100
```

### Config

`pytest.ini`:
```ini
[pytest]
testpaths = tests
pythonpath = .
```

### Workflow

1. Write the pure function in `utils.py`
2. Write tests in `tests/`
3. Run `pytest` — verify all pass
4. Wire the function into `server.py` (endpoint or import logic)
5. Mirror in client JS with a comment: `// MUST match server-side utils.compute_crop_transform`
6. Run `pytest` again before every commit
7. Commit and push

### Key Rules

- **Never duplicate logic between Python and JS** — if both need it, make it a server endpoint or at minimum test the Python version and comment the JS copy
- **When removing a parameter/field**, update the contract constant + test, then the compiler (the test suite) tells you everywhere else it's referenced
- **Tests run in < 0.2 seconds** with zero infrastructure — no DB, no server, just pure functions
- **60 tests at build 025** covering crop math, import logic, EXIF extraction, and contracts

### The Lesson That Started It All

We spent 4 rounds debugging crop offset math (inline JS, no tests). Each round was: deploy → screenshot → debug → fix → push → repeat. After that, we extracted the formula into `utils.py`, wrote 13 tests with hand-calculated expected values, and never had another crop bug. The test suite runs in 0.07 seconds.
