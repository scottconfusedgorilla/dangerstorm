---
name: YYCatalog project context
description: YYCatalog — vintage nautical magazine catalog manager (Flask/Supabase/Railway), separate repo from DangerStorm
type: project
---

YYCatalog is a web app for managing ~5000 vintage nautical magazine scans (the "YesterYacht" collection).

**Why:** ~500 are covers to be sold via Shopify POD. User's daughter (non-technical, Mac user) will operate the catalog.

**How to apply:**
- Repo: `s:/Projects/YYCatalog` (GitHub: scottconfusedgorilla/YYCatalog, branch: master)
- Tech: Flask backend, vanilla HTML/CSS/JS frontend, Supabase auth+DB, Railway deploy, Dropbox API for images
- Dropbox: App Folder type ("YesterYacht"), images at `/All_YesterYacht_Images_4320_pixel`
- Supabase project: `essnrjfpstlsybhcqxme` — NO RLS, NO auto-profile trigger (profiles created manually)
- Auth: email+password only, no OAuth
- Build number in `public/index.html`, current: build 004
- Nautical theme: navy (#0A1628), brass/gold (#C9A84C), cream (#F5F0E8), teal (#2A7F7F)
- Filename encoding: `Y[YY].[MM][PubCode][PageNum].[Index][ImageCode]` with optional `_suffix`
- Railway uses Nixpacks builder (not Railpack)
- Commit format same as DangerStorm: `(build NNN) Description`
