import os
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, Response
from dotenv import load_dotenv
import anthropic
import json

load_dotenv(override=True)

app = Flask(__name__, static_folder="public", static_url_path="")

# Let the Anthropic client pick up ANTHROPIC_API_KEY from env automatically
client = anthropic.Anthropic()

# Supabase setup (server-side with service key for trusted operations)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

_supabase_client = None


def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def get_supabase_user(access_token):
    """Verify a Supabase JWT and return the user."""
    from supabase import create_client
    # Create a client with the user's token to verify it
    user_client = create_client(
        SUPABASE_URL,
        os.getenv("SUPABASE_ANON_KEY", ""),
    )
    user_client.auth.set_session(access_token, "")
    try:
        user_resp = user_client.auth.get_user(access_token)
        return user_resp.user
    except Exception:
        return None


def require_auth(f):
    """Decorator to require Supabase auth on an endpoint."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401
        token = auth_header.split(" ", 1)[1]
        user = get_supabase_user(token)
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        request.user = user
        return f(*args, **kwargs)
    return decorated


# Stripe setup
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")

SYSTEM_PROMPT = """You are DangerStorm — a confident, direct, product-savvy AI that helps people turn product ideas into professional pitch deck prompts in under 90 seconds.

Your voice: You talk like a senior product manager who's evaluated a thousand ideas and knows instantly what makes one work. Confident, direct, excited when you see a great angle, and willing to push back when something is vague.

## CONVERSATION RULES (STRICT)

1. Always ask ONLY ONE question per response. Never bundle questions.
2. Be extremely aggressive about extracting info from previous answers. If the user already provided or strongly implied something, skip that question entirely — don't mention you skipped it.
3. Max 5 total exchanges (including opener). Often 3–4 is enough.
4. After each user reply: acknowledge/react conversationally, then either ask exactly one next question OR generate all three outputs if you have enough.

## CONVERSATION SEQUENCE (ask adaptively, never show as a list):

1. Elevator pitch + domain (ask together in opener)
2. Primary user / who buys it (only if not clear from pitch)
3. Revenue model (only if not obvious)
4. The one key differentiator / insight (almost always ask — it's the heart of Slide 3)
5. Competitor/reference URL (truly optional, only if not mentioned)
6. Current status (often inferable or skippable)

## YOUR OPENER (first message, always):

"Alright, hit me. What's the product? Give me the elevator pitch in one or two sentences, and what's the domain?"

## REACTION STYLE:

- Paraphrase to confirm: "OK, so [domain] — [what it does]. I like the angle."
- Push back if vague: "That's still pretty broad. Nail the one thing it does better than anything else. What's that?"
- Show excitement: "Boom — that's the insight nobody else has. That's your Slide 3 money."
- If they give a URL: "Got it — so this is similar to [X] but your angle is [differentiator]. Sharp."

## WHEN YOU HAVE ENOUGH INFO (usually after 3-5 exchanges):

Generate ONLY the pitch deck prompt (Output 1). The other outputs will be generated separately if the user requests them. Use these exact markers so the frontend can parse them:

===OUTPUT_1_START===
[The complete deck prompt — see structure below]
===OUTPUT_1_END===

## OUTPUT 1 — DECK PROMPT STRUCTURE:

Generate a detailed prompt that will produce an 8-slide pitch deck when pasted into Claude or ChatGPT:

Slide 1 — TITLE: Product name (large), domain, one-line tagline, "Scott Welch | atomicmaple.vc | [today's date]"
Slide 2 — THE PROBLEM: What pain, who feels it, why unsolved
Slide 3 — THE SOLUTION: What it does in plain language, THE KEY INSIGHT that makes it different
Slide 4 — HOW IT WORKS: 3-4 steps of user experience, each with icon concept + short title + one-line description
Slide 5 — WHO BUYS IT: Primary audience, secondary audiences, why they'd pay
Slide 6 — REVENUE MODEL: How it makes money, pricing tiers if applicable, unit economics at scale
Slide 7 — STATUS & PROOF: Current status, any validation, what's needed next
Slide 8 — CLOSING: Product name + domain, one-line pitch repeated, contact info

The prompt should also specify:
- A bold color palette appropriate to the product category (not generic blue)
- Dark title and closing slides, light content slides (sandwich structure)
- Clean typography: Trebuchet MS or Georgia for headers, Calibri for body
- Each slide must have a visual element — icon concept, stat callout, comparison, or diagram
- No bullet points on white backgrounds. Every slide should be designed, not just typed.
- 16:9 format

## OUTPUT 2 — CARRD LANDING PAGE COPY (<150 words):

Structure:
- Headline: Product tagline (bold, punchy, 8 words or less)
- Subheadline: One sentence explaining what it does and for whom
- Three feature bullets: Benefit-focused, **bold** lead word
- Social proof placeholder: "Join [X] others who..." or "Built by [credibility]"
- CTA: "Get early access" or "Join the waitlist"
- Footer: Domain name + one-line closer

Format: **Bold** for emphasis, *italic* for secondary, [links](URL). No headers, no lists, no HTML.

## OUTPUT 3 — KIT (CONVERTKIT) SIGNUP FORM COPY:

- Form headline: "Be the first to know when [product name] launches"
- Form description: One sentence on what they'll get
- Email placeholder: "your@email.com"
- Button text: Specific, action-oriented
- Privacy line: "No spam. Unsubscribe anytime."

## OUTPUT 4 — CARRD LANDING PAGE HTML MOCKUP:

Generate a complete, self-contained HTML page that visually mocks up the Carrd landing page. This should look like a real, polished one-page site. Requirements:
- All CSS inline in a <style> tag — no external dependencies
- Use a bold color palette derived from the product (NOT the DangerStorm orange — use colors appropriate to the product)
- Dark or light theme based on the product's vibe
- Clean, modern layout: centered content, generous whitespace
- Headline large and bold, subheadline smaller
- Feature bullets styled as cards or icon rows (use simple unicode or emoji icons)
- CTA button prominently styled with hover state
- Footer with domain and tagline
- Mobile-responsive (use max-width container)
- Should look professional enough to screenshot and use

## OUTPUT 5 — KIT SIGNUP FORM HTML MOCKUP:

Generate a complete, self-contained HTML page that mocks up the Kit email signup form as it would appear embedded on the Carrd page. Requirements:
- All CSS inline in a <style> tag
- Match the color palette from OUTPUT 4
- Centered card layout with subtle shadow or border
- Form headline and description
- Email input field (styled, not default browser)
- Submit button matching the CTA style from the landing page
- Privacy line in small muted text below
- Should look like an embedded Kit form widget

## OUTPUT 6 — CLAUDE CODE BUILD PROMPT:

Generate a ready-to-paste prompt that a user can give to Claude Code (Anthropic's CLI coding agent) to build an MVP of the product. The prompt should:
- Start with a clear project description and what the tool should build
- Specify the tech stack (pick something appropriate — e.g., Python/Flask, Node/Express, Next.js, etc. based on the product type)
- Define the core features for MVP (no more than 3-5 key features)
- Describe the user flow step by step
- Include UI/UX direction (color scheme, layout style, mobile-friendly)
- Specify any APIs or integrations needed
- Include data model if applicable (what gets stored, relationships)
- End with "Build this as a working MVP. Start with the backend, then the frontend. Make it functional, not just a mockup."
- Keep it practical and buildable in one session — no over-engineering
- Write it as direct instructions, not a conversation. This is a CLAUDE.md-style brief.

## IMPORTANT:
- Never break character. You ARE DangerStorm.
- Never show the question sequence as a list.
- If the user says something off-topic, gently redirect: "Love the energy, but let's stay focused. What's the product?"
- Keep your conversational responses SHORT — 1-3 sentences max before asking the next question.
- CRITICAL: Generate ONLY Output 1 (the deck prompt). Outputs 2-6 are generated separately on demand. Do not generate them here.
- Keep the deck prompt detailed but concise — aim for 600-800 words max.

## IMPORTANT CONTEXT:
You have ALREADY said your opener: "Alright, hit me. What's the product? Give me the elevator pitch in one or two sentences, and what's the domain?"
The user's first message is their response to that opener. Do NOT repeat the opener. Continue the conversation from there.
"""


@app.route("/")
def index():
    return send_from_directory("public", "index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=64000,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

        assistant_text = response.content[0].text
        return jsonify({"response": assistant_text})

    except anthropic.APIError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    data = request.json
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Ensure messages alternate correctly for the API.
    # The frontend sends the hardcoded opener as an assistant message first,
    # so we strip it and include it via system prompt context instead.
    api_messages = []
    for msg in messages:
        if not api_messages and msg["role"] == "assistant":
            # Skip the leading assistant message — it's the hardcoded opener
            continue
        api_messages.append(msg)

    if not api_messages:
        return jsonify({"error": "No user message provided"}), 400

    def generate():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=64000,
                system=SYSTEM_PROMPT,
                messages=api_messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: {\"done\": true}\n\n"
        except anthropic.APIError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
            "Connection": "keep-alive",
        },
    )


EXTRAS_SYSTEM_PROMPT = """You are DangerStorm's output generator. Given a pitch deck prompt that was already generated, produce the five additional outputs for the product. Use these exact markers:

===OUTPUT_2_START===
[Carrd landing page copy — plain text, under 150 words]
===OUTPUT_2_END===

===OUTPUT_3_START===
[Kit signup form copy — plain text]
===OUTPUT_3_END===

===OUTPUT_4_START===
[Complete self-contained HTML page for a Carrd-style landing page mockup. All CSS in a <style> tag. Bold product-appropriate color palette. Clean, modern, mobile-responsive. Under 80 lines.]
===OUTPUT_4_END===

===OUTPUT_5_START===
[Complete self-contained HTML page for a Kit email signup form mockup. Match OUTPUT 4 palette. Under 60 lines.]
===OUTPUT_5_END===

===OUTPUT_6_START===
[Claude Code build prompt — direct instructions for building an MVP. Specify tech stack, core features, user flow, UI direction. Under 30 lines. End with "Build this as a working MVP."]
===OUTPUT_6_END===

OUTPUT 2 — CARRD COPY: Headline (8 words max), subheadline, 3 benefit-focused bullets with **bold** lead word, social proof placeholder, CTA, footer. Carrd-compatible: **bold**, *italic*, [links](URL) only.

OUTPUT 3 — KIT FORM COPY: Form headline, description, email placeholder, button text, privacy line.

OUTPUT 4 — LANDING PAGE HTML: Real, polished one-page site. Product-appropriate colors (NOT orange). Headline, features as cards, CTA button with hover, footer. Mobile-responsive.

OUTPUT 5 — SIGNUP FORM HTML: Centered card, form with styled email input, submit button, privacy line. Match OUTPUT 4 colors.

OUTPUT 6 — BUILD PROMPT: Project description, tech stack, 3-5 MVP features, user flow, UI direction, data model if needed. Practical and buildable.

Be concise. Every line earns its place."""


@app.route("/api/generate-extras", methods=["POST"])
def generate_extras():
    data = request.json
    deck_prompt = data.get("deckPrompt", "")

    if not deck_prompt:
        return jsonify({"error": "No deck prompt provided"}), 400

    def generate():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=16000,
                system=EXTRAS_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Generate all five additional outputs for this product based on the following deck prompt:\n\n{deck_prompt}"}],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: {\"done\": true}\n\n"
        except anthropic.APIError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


PPT_SYSTEM_PROMPT = """You are a slide deck data generator. Given a pitch deck prompt, extract and generate structured JSON data for an 8-slide pitch deck.

Return ONLY valid JSON with this exact structure — no markdown, no code fences, no explanation:

{
  "title": "Product Name",
  "palette": {
    "dark": "#1a1a2e",
    "primary": "#e94560",
    "secondary": "#0f3460",
    "accent": "#16213e",
    "light": "#f5f5f5",
    "text_light": "#ffffff",
    "text_dark": "#1a1a2e"
  },
  "slides": [
    {
      "type": "title",
      "title": "Product Name",
      "subtitle": "Tagline here",
      "footer": "Author | website | date"
    },
    {
      "type": "content",
      "heading": "THE PROBLEM",
      "bullets": ["Pain point 1", "Pain point 2", "Pain point 3"],
      "callout": "Optional stat or highlight"
    },
    {
      "type": "content",
      "heading": "THE SOLUTION",
      "bullets": ["Key insight", "What it does", "Why it's different"],
      "callout": "The key differentiator"
    },
    {
      "type": "steps",
      "heading": "HOW IT WORKS",
      "steps": [
        {"icon": "1", "title": "Step One", "description": "What happens"},
        {"icon": "2", "title": "Step Two", "description": "What happens"},
        {"icon": "3", "title": "Step Three", "description": "What happens"}
      ]
    },
    {
      "type": "content",
      "heading": "WHO BUYS IT",
      "bullets": ["Primary audience", "Secondary audience", "Why they pay"],
      "callout": null
    },
    {
      "type": "content",
      "heading": "REVENUE MODEL",
      "bullets": ["How it makes money", "Pricing approach", "Unit economics"],
      "callout": null
    },
    {
      "type": "content",
      "heading": "STATUS & PROOF",
      "bullets": ["Current status", "Validation", "What's next"],
      "callout": null
    },
    {
      "type": "closing",
      "title": "Product Name",
      "subtitle": "Tagline repeated",
      "footer": "Contact info"
    }
  ]
}

Pick a bold, category-appropriate color palette. Make the content punchy and professional."""


@app.route("/api/generate-ppt", methods=["POST"])
def generate_ppt():
    data = request.json
    deck_prompt = data.get("deckPrompt", "")

    if not deck_prompt:
        return jsonify({"error": "No deck prompt provided"}), 400

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=PPT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": deck_prompt}],
        )

        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        slide_data = json.loads(raw)
        return jsonify(slide_data)

    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse slide data from AI"}), 500
    except anthropic.APIError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/dashboard")
def dashboard():
    return send_from_directory("public", "dashboard.html")


@app.route("/account")
def account():
    return send_from_directory("public", "account.html")


@app.route("/api/save-idea", methods=["POST"])
@require_auth
def save_idea():
    data = request.json
    user_id = request.user.id
    domain = data.get("domain", "None") or "None"
    product_name = data.get("productName", "Untitled Idea")
    tagline = data.get("tagline", "")
    conversation = data.get("conversation", [])
    outputs = data.get("outputs", {})

    sb = get_supabase()

    # Check idea limit
    profile = sb.table("profiles").select("tier, idea_count").eq("id", user_id).single().execute()
    if not profile.data:
        return jsonify({"error": "Profile not found"}), 404

    tier = profile.data["tier"]
    idea_count = profile.data["idea_count"]
    max_ideas = 999 if tier == "pro" else 5

    # Check if this domain already has an idea (update, not count against limit)
    existing = sb.table("ideas").select("id").eq("user_id", user_id).eq("domain", domain).execute()
    is_new = len(existing.data) == 0

    if is_new and idea_count >= max_ideas:
        return jsonify({"error": f"Idea limit reached ({max_ideas}). Upgrade to Pro for more."}), 403

    # Upsert idea
    if is_new:
        idea_result = sb.table("ideas").insert({
            "user_id": user_id,
            "domain": domain,
            "product_name": product_name,
            "tagline": tagline,
            "status": "complete",
        }).execute()
        idea_id = idea_result.data[0]["id"]
    else:
        idea_id = existing.data[0]["id"]
        sb.table("ideas").update({
            "product_name": product_name,
            "tagline": tagline,
            "status": "complete",
            "updated_at": "now()",
        }).eq("id", idea_id).execute()

    # Get next version number
    versions = sb.table("idea_versions").select("version_number").eq("idea_id", idea_id).order("version_number", desc=True).limit(1).execute()
    next_version = (versions.data[0]["version_number"] + 1) if versions.data else 1

    # Insert version
    sb.table("idea_versions").insert({
        "idea_id": idea_id,
        "version_number": next_version,
        "conversation": conversation,
        "outputs": outputs,
    }).execute()

    return jsonify({
        "ideaId": idea_id,
        "versionNumber": next_version,
        "isNew": is_new,
    })


@app.route("/api/stripe/create-checkout", methods=["POST"])
@require_auth
def stripe_create_checkout():
    if not STRIPE_SECRET_KEY:
        return jsonify({"error": "Stripe not configured"}), 500

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    user = request.user
    sb = get_supabase()
    profile = sb.table("profiles").select("stripe_customer_id").eq("id", user.id).single().execute()

    checkout_params = {
        "mode": "subscription",
        "line_items": [{"price": STRIPE_PRICE_ID, "quantity": 1}],
        "success_url": request.host_url + "account?success=1",
        "cancel_url": request.host_url + "account?canceled=1",
        "metadata": {"user_id": user.id},
    }

    # Reuse existing Stripe customer if we have one
    if profile.data and profile.data.get("stripe_customer_id"):
        checkout_params["customer"] = profile.data["stripe_customer_id"]
    else:
        checkout_params["customer_email"] = user.email

    session = stripe.checkout.Session.create(**checkout_params)
    return jsonify({"url": session.url})


@app.route("/api/stripe/portal", methods=["POST"])
@require_auth
def stripe_portal():
    if not STRIPE_SECRET_KEY:
        return jsonify({"error": "Stripe not configured"}), 500

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    user = request.user
    sb = get_supabase()
    profile = sb.table("profiles").select("stripe_customer_id").eq("id", user.id).single().execute()

    if not profile.data or not profile.data.get("stripe_customer_id"):
        return jsonify({"error": "No billing account found"}), 404

    session = stripe.billing_portal.Session.create(
        customer=profile.data["stripe_customer_id"],
        return_url=request.host_url + "account",
    )
    return jsonify({"url": session.url})


@app.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    if not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
        return jsonify({"error": "Stripe not configured"}), 500

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError):
        return jsonify({"error": "Invalid signature"}), 400

    sb = get_supabase()

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")

        if user_id:
            sb.table("profiles").update({
                "tier": "pro",
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
            }).eq("id", user_id).execute()

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        # Find the profile by stripe_customer_id and downgrade
        sb.table("profiles").update({
            "tier": "free",
            "stripe_subscription_id": None,
        }).eq("stripe_customer_id", customer_id).execute()

    return jsonify({"received": True})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    debug = os.getenv("RAILWAY_ENVIRONMENT") is None
    app.run(debug=debug, host="0.0.0.0", port=port)
