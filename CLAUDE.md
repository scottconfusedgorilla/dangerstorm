# DangerStorm.net — Design Brief

## BUILD NUMBER
There is a visible build number on the home screen in `public/index.html` (class `build-number`). **Increment the build number on every deploy.** Format: `build NNN`. Current: `build 004`.

You are building the MVP of DangerStorm.net — a conversational tool that takes a product idea and a domain name and generates a professional product pitch deck, similar to the Atomic Maple product portfolio format.

## WHAT IT DOES

The user visits dangerstorm.net. No signup required. They give it a product idea and a domain. DangerStorm interviews them briefly (one question at a time), then generates a complete prompt they can paste into Claude or ChatGPT to produce a polished 8-slide product pitch deck.

This is a tool for product people who have ideas faster than they can document them. One idea, one domain, 90 seconds, one deck.

## THE CONVERSATION FLOW (strict single-question rule)

- Always ask **only one question per response** unless the conversation is complete and you're ready to generate outputs.
- Be extremely aggressive about extracting and remembering information from previous answers. If the user has already provided (or strongly implied) the info for the next logical question, skip it entirely — do not mention that you skipped it.
- Start with the opener that combines the two most important pieces.
- Core sequence to cover (never show as a list; ask adaptively and minimally):
  1. Elevator pitch + domain (ask together in opener).
  2. Primary user / who buys it (only if not clear from pitch).
  3. Revenue model (only if not obvious or if it affects the story).
  4. The one key differentiator / insight (almost always ask this — it's the heart of Slide 3).
  5. Competitor/reference URL (only if not mentioned earlier; truly optional).
  6. Current status (last resort; often inferable or skippable).
- After each user reply:
  - Internally extract and store key details.
  - Briefly acknowledge / react conversationally (show excitement, push back gently if vague, paraphrase to confirm understanding).
  - Then: if you now have enough to generate a strong deck (usually after 3–5 total exchanges), immediately output the three blocks (deck prompt, Carrd copy, Kit form copy) with copy buttons.
  - Otherwise, ask **exactly one** next question, phrased naturally and directly.
  - If the current answer is vague/broad, push back in your acknowledgment, then ask one sharpening question (e.g., "That's three ideas mashed together. Pick the one core thing it does best. What's that?").
- Never ask more than one question in a single response. Never bundle follow-ups or list multiple questions.
- Max total questions asked: 5 (including opener). Often 3–4 is plenty if the initial pitch is detailed.
- If the user volunteers extra info unprompted, incorporate it silently and skip ahead.

## HANDLING THE REFERENCE URL

If the user provides a URL at any point, fetch it during the conversation to understand the competitive landscape or inspiration. Acknowledge briefly: "Got it — so this is similar to [X] but your angle is [differentiator]. Sharp." Include the reference context in the generated prompt.

If no URL provided by the time you're ready to generate, skip — no need to ask unless it feels critical.

## AFTER THE CONVERSATION

Display the generated prompt in a clean, copyable text block. One-click copy button. Option to "refine" (re-enter conversation to adjust). Option to "start over."

Also generate and display (in separate labeled blocks):
- **OUTPUT 2** — CARRD LANDING PAGE COPY (Carrd-compatible markdown, <150 words)
- **OUTPUT 3** — KIT (CONVERTKIT) SIGNUP FORM COPY

## THE GENERATED PROMPT SHOULD PRODUCE A DECK WITH THIS STRUCTURE

- **Slide 1 — TITLE**
  - Product name (large)
  - Domain name
  - One-line tagline
  - "Scott Welch | atomicmaple.vc | [date]" (or configurable attribution)

- **Slide 2 — THE PROBLEM**
  - What pain does this solve?
  - Who feels the pain?
  - Why hasn't it been solved? (or why existing solutions fail)

- **Slide 3 — THE SOLUTION**
  - What the product does, in plain language
  - The key insight — the one thing that makes this different
  - Keep it simple. "There would be a folder. You'd put your stuff in it. It would sync."

- **Slide 4 — HOW IT WORKS**
  - 3-4 steps showing the user experience
  - Each step: icon concept, short title, one-line description
  - Should feel effortless. If it takes more than 4 steps, the product is too complex for one slide.

- **Slide 5 — WHO BUYS IT**
  - Primary audience
  - Secondary audiences
  - Why they'd pay for this specifically

- **Slide 6 — REVENUE MODEL**
  - How it makes money
  - Pricing tiers if applicable (free / pro / enterprise)
  - What the unit economics look like at scale

- **Slide 7 — STATUS & PROOF**
  - Current status (idea, prototype, launched, revenue)
  - Any validation (users, waitlist, letters of intent, comparable products)
  - What's needed to get to next stage

- **Slide 8 — CLOSING**
  - Product name + domain
  - The one-line pitch repeated
  - Contact info

## DESIGN DIRECTION IN THE GENERATED PROMPT

The prompt should specify:
- A bold color palette appropriate to the product category (not generic blue)
- Dark title and closing slides, light content slides (sandwich structure)
- Clean typography: Trebuchet MS or Georgia for headers, Calibri for body
- Each slide must have a visual element — icon concept, stat callout, comparison, or diagram
- No bullet points on white backgrounds. Every slide should be designed, not just typed.
- 16:9 format

## TECH STACK

- Single-page web app. HTML/CSS/JS or React, your choice.
- Use the Anthropic API (Claude) for the conversational flow.
- No database needed for MVP. No signup. No accounts.
- Mobile-friendly. Clean, bold UI.
- Color scheme: Dark background (#0F172A), electric orange accent (#F97316), white text.
- The conversation should feel like talking to a sharp product strategist, not filling out a form.

## CRITICAL DESIGN PRINCIPLES

- This is a conversation, not a wizard. No progress bars. No step indicators. Just a chat.
- The AI should feel like an experienced product person who immediately sees the angle.
- Never ask more than one question at a time. Often 3–4 total exchanges is enough.
- The AI should push back if the idea is vague: "That's too broad. What's the ONE thing it does?"
- The generated prompt should be visible in full, not behind a modal or accordion.
- The copy button must work on mobile.
- The whole experience should take under 90 seconds.

## PERSONALITY

DangerStorm's voice is confident, direct, and product-savvy. It talks like a senior product manager who's evaluated a thousand ideas and knows instantly what makes one work.

- **Example opener:** "Alright, hit me. What's the product? Give me the elevator pitch in one or two sentences, and what's the domain?"
- **Example follow-up:** "Got it — [paraphrase pitch + domain]. I like the angle. Who's the primary user — who feels this pain the hardest?"
- **Example pushback:** "That's still pretty broad. Nail the one thing it does better than anything else. What's that?"
- **Example excitement:** "Boom — that's the insight nobody else has. That's your Slide 3 money."

## WHAT SUCCESS LOOKS LIKE

A product person with an idea and a domain visits dangerstorm.net, has a 90-second conversation, and gets a prompt that produces a professional 8-slide product pitch deck from any AI tool. The deck looks like it was made by someone who spent a week on it, not 90 seconds.

## BONUS OUTPUTS

After generating the deck prompt, DangerStorm also generates two additional outputs:

### OUTPUT 2 — CARRD LANDING PAGE COPY

Generate ready-to-paste copy for a one-page Carrd.co landing page for the product. Structure:

- **Headline:** The product tagline (bold, punchy, 8 words or less)
- **Subheadline:** One sentence explaining what it does and for whom
- **Three feature bullets:** Short, benefit-focused (not feature-focused). Use **bold** for the lead word.
- **Social proof placeholder:** "Join [X] others who..." or "Built by [credibility statement]"
- **CTA:** "Get early access" or "Join the waitlist" — action-oriented, specific
- **Footer:** Domain name, one-line "Built with love in [city]" or similar

Format using Carrd-compatible markdown:
- **Bold** for emphasis
- *Italic* for secondary text
- [Link text](URL) for any links
- No headers, no lists, no HTML — Carrd doesn't support them in text blocks

Keep it to under 150 words total. This should be copy-pasteable directly into a Carrd text element.

### OUTPUT 3 — KIT (CONVERTKIT) SIGNUP FORM COPY

Generate the copy for a Kit email signup form to embed on the Carrd page:

- **Form headline:** "Be the first to know when [product name] launches"
- **Form description:** One sentence on what they'll get (early access, launch discount, beta invite)
- **Email field placeholder:** "your@email.com"
- **Button text:** Specific, action-oriented (e.g., "Get early access", "Join the waitlist", "Notify me")
- **Privacy line:** "No spam. Unsubscribe anytime."

All three outputs (deck prompt, Carrd copy, Kit form copy) should be displayed in separate, clearly labeled, copyable text blocks with individual copy buttons.

## FUTURE: PRO VERSION (NOT MVP)

Pro users log in with Google SSO. Their conversation context is preserved, so they can return and refine outputs from where they left off. Session history is tied to their Google account. This enables iterative refinement: "Actually, change the revenue model to freemium" without re-answering every question.

Pro becomes a product idea management tool. Users build a library of product ideas, each with its generated deck prompt, Carrd copy, and Kit form. Saved, searchable, refinable.

One-click integration with Atomic Maple: when an idea is ready, the user can list it directly on atomicmaple.vc — complete with all generated assets — to be matched with a builder.

- **DangerStorm free** = one idea, one session, copy your outputs.
- **DangerStorm Pro** = your product idea portfolio, with a pipeline to Atomic Maple.

NOT for MVP — MVP is zero-auth, stateless, single session.

---

**One idea. One domain. One deck. Go.**
