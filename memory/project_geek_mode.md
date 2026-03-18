---
name: Geek Mode — Prompt Teaching Easter Egg
description: Plan for a hidden "geek mode" that teaches users why prompts work, using DangerStorm's own outputs as examples
type: project
---

## Concept

DangerStorm's core value: most people are bad at prompts. DangerStorm writes great prompts for them. But "teach a man to fish" — we should also help users *understand* why the generated prompts are good, so they get better at prompting on their own.

**Why:** This turns DangerStorm from a tool into a teacher. Users who understand prompt structure become better AI users everywhere, not just in DangerStorm.

**How to apply:** Build as a discoverable easter egg, not a prominent feature. Must not slow down repeat users.

## Three Levels

1. **Current behavior** — generated prompt is displayed, user copies it
2. **Geek Mode** — prompt sections get margin annotations explaining *why* they work (context-first framing, specificity, constraints, examples, etc.)
3. **Full Inception** — reveal DangerStorm's own system prompt with the same annotation treatment ("this entire conversation was driven by a prompt too")

## Discovery Mechanism (Easter Egg)

Three candidate approaches (pick one to build):

### Option A: "Powered by a prompt →"
- Tiny subtle text at the bottom of generated output, looks like a watermark
- Curious users click it → view transforms to annotated X-ray mode
- Regular users never notice it

### Option B: Logo trick
- After outputs are generated, DangerStorm logo gets a subtle glow/pulse
- Click it → page flips into annotated "X-ray view" of the prompt
- Like "View Source" for prompts

### Option C: "Third click" on copy button
- Copy button says "Copy" → click → "Copied!" → settles to "Copied. But why does it work? →"
- Repeat users already copied and moved on
- Curious users see the second state and click the rabbit hole

## Annotation Format

- Non-conversational — no extra AI chat
- Clean margin notes, like an annotated textbook
- Each prompt section highlighted with a short explanation
- Examples: "Notice how the problem is framed before the solution — AI responds better with context first", "These constraints prevent the AI from going off-track"

## Inception Layer

- Once in geek mode, a small "Go deeper →" link at the bottom
- Reveals DangerStorm's own system prompt (from CLAUDE.md) with annotations
- Ultimate meta-flex: "this experience you just had was driven by a prompt too"

## Technical Approach

- Annotations can be static/hardcoded per prompt section (no AI needed)
- CSS transition to transform normal view → annotated view
- localStorage flag to remember if user has discovered geek mode
- No impact on normal flow — zero performance cost until activated
