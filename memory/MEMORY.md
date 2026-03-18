# DangerStorm Project Memory

## Commit Message Format
- **Always** put the build number at the **beginning** of the commit message: `(build 016) Fix auth deadlock...`
- This makes it visible in Railway's deploy list even when the window is narrow
- Always bump the build number in `public/index.html` when pushing changes
- Never forget the build number — user relies on it to track deploys

## Key Technical Lessons
- Supabase JS v2 CDN (`@supabase/supabase-js@2`) creates a global `window.supabase` — don't use `let supabase` at top level (use `sbClient`)
- Supabase JS v2.98+ uses `navigator.locks` internally — `onAuthStateChange` callback must NOT be async/await or it deadlocks `signInWithPassword`
- When removing UI elements (buttons, etc.), always remove the corresponding JS event listeners too or app.js crashes on load
- `.claude/` must be in `.gitignore` — settings.json can leak secrets via approved bash commands

## Tech Stack
- Python/Flask backend, vanilla HTML/CSS/JS frontend
- Anthropic API (Claude Sonnet 4.6) for chat, Claude Haiku for help chatbot
- Supabase for auth + data storage
- Deployed to Railway (auto-deploys from GitHub main branch)
- Auth: email+password (no magic links), Google OAuth (auth.dangerstorm.net)
- Current build: 114

## Features
- Guided tour (first-visit, 5 steps, replayable via footer link)
- Help chatbot (floating ? button, slide-out panel, uses Haiku with help system prompt)
- Help mode skips rate limiting, prompt logging, and output parsing

## Planned: Geek Mode
- [project_geek_mode.md](project_geek_mode.md) — Easter egg that teaches users why prompts work, with three levels: annotated output, prompt anatomy, and full inception (DangerStorm's own system prompt revealed)

## Capacitor / iOS App
- [project_capacitor_ios.md](project_capacitor_ios.md) — Capacitor config ready, needs Mac build for App Store

## Feedback
- [feedback_no_overwrite_name_domain.md](feedback_no_overwrite_name_domain.md) — Never overwrite product name or domain when re-saving an existing idea
- [feedback_testable_primitives.md](feedback_testable_primitives.md) — Complex logic should be tested server-side endpoints, never duplicated in client JS
- [feedback_client_server_contracts.md](feedback_client_server_contracts.md) — Shared params/fields between client+server need contract tests to prevent stale reference crashes
- [feedback_testing_methodology.md](feedback_testing_methodology.md) — Full testing methodology for Flask+JS projects: pure functions, contracts, test-before-deploy workflow
