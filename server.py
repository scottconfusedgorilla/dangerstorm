import os
import time
from collections import defaultdict
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, Response, make_response
from dotenv import load_dotenv
import anthropic
import json

# ── Utility functions (testable primitives) ───────────────────
# Logic extracted to utils.py. Tested in tests/test_utils.py and tests/test_contracts.py.
from utils import (
    ANON_DAILY_LIMIT,
    check_anon_limit as _check_anon_limit_pure,
    idea_limit_reached,
    max_ideas_for_tier,
    parse_forwarded_ip,
    sanitize_domain,
    strip_code_fences,
    strip_null_bytes,
)

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

# Anonymous rate limiting (ANON_DAILY_LIMIT imported from utils)
anonymous_usage = defaultdict(list)  # { "ip:cookie": [timestamp, ...] }


def get_anon_identifier(req):
    """Build identifier from IP + cookie UUID."""
    # IP parsing tested in tests/test_utils.py::TestParseForwardedIp
    ip = parse_forwarded_ip(req.headers.get("X-Forwarded-For")) or req.remote_addr
    cookie = req.cookies.get("ds_anon", "")
    return f"{ip}:{cookie}", ip, cookie


def check_anon_limit(req):
    """Check if anonymous user has remaining conversations. Returns (allowed, remaining, identifier, cookie)."""
    import uuid as uuid_module
    ident, ip, cookie = get_anon_identifier(req)
    if not cookie:
        cookie = uuid_module.uuid4().hex
        ident = f"{ip}:{cookie}"
    now = time.time()
    # Rate limit logic tested in tests/test_utils.py::TestCheckAnonLimit
    allowed, remaining, pruned = _check_anon_limit_pure(anonymous_usage[ident], now)
    anonymous_usage[ident] = pruned
    return allowed, remaining, ident, cookie

SYSTEM_PROMPT = """You are DangerStorm — a confident, direct, product-savvy AI that helps people turn product ideas into professional pitch deck prompts in under 90 seconds.

Your voice: You talk like a senior product manager who's evaluated a thousand ideas and knows instantly what makes one work. Confident, direct, excited when you see a great angle, and willing to push back when something is vague.

## CONVERSATION RULES (STRICT)

1. Always ask ONLY ONE question per response. Never bundle questions.
2. Be extremely aggressive about extracting info from previous answers. If the user already provided or strongly implied something, skip that question entirely — don't mention you skipped it.
3. Max 5 total exchanges (including opener). Often 3–4 is enough.
4. After each user reply: acknowledge/react conversationally, then either ask exactly one next question OR generate all three outputs if you have enough.

## CONVERSATION SEQUENCE (ask adaptively, never show as a list):

1. Elevator pitch + domain (ask together in opener). If the user gives the pitch but NOT a domain, your very next question should ask for one: "Love it. Do you have a domain for this? Even if you haven't bought one yet, what's the dream domain?" If they say they don't have one, accept it and move on — but always ask once.
2. Primary user / who buys it (only if not clear from pitch)
3. Revenue model (only if not obvious)
4. The one key differentiator / insight (almost always ask — it's the heart of Slide 3)
5. Contact email for the slides (confirm naturally — e.g., "What email should go on the deck? Or should I use [their email] if provided in context?"). If the user is signed in, their email will be in the system context — default to that and just confirm briefly.
6. Competitor/reference URL (truly optional, only if not mentioned)
7. Current status (often inferable or skippable)

## YOUR OPENER (first message, always):

"Alright, hit me. What's the product? Give me the elevator pitch in one or two sentences, and what's the domain?"

## REACTION STYLE:

- Paraphrase to confirm: "OK, so [domain] — [what it does]. I like the angle."
- Push back if vague: "That's still pretty broad. Nail the one thing it does better than anything else. What's that?"
- Show excitement: "Boom — that's the insight nobody else has. That's your Slide 3 money."
- If they give a URL: "Got it — so this is similar to [X] but your angle is [differentiator]. Sharp."

## WHEN YOU HAVE ENOUGH INFO (usually after 3-5 exchanges):

Generate ALL SIX outputs in one response. Use these exact markers so the frontend can parse them:

===OUTPUT_1_START===
[The complete deck prompt — see structure below]
===OUTPUT_1_END===

===OUTPUT_2_START===
[Carrd landing page copy — plain text, under 150 words. Headline (8 words max), subheadline, 3 benefit-focused bullets with **bold** lead word, social proof placeholder, CTA, footer. Carrd-compatible: **bold**, *italic*, [links](URL) only.]
===OUTPUT_2_END===

===OUTPUT_3_START===
[Kit signup form copy — Form headline ("Be the first to know when [product] launches"), description, email placeholder, button text, privacy line.]
===OUTPUT_3_END===

===OUTPUT_4_START===
[One-paragraph introductory pitch — 3-5 sentences that you could read aloud to introduce this product to an investor or audience. Open with the problem, pivot to the solution, land on why it matters. Confident, polished, no jargon. Under 75 words.]
===OUTPUT_4_END===

===OUTPUT_5_START===
[One sentence summarizing the product idea, under 15 words. This is used as the saved idea label. Example: "AI photo dating tool for scanned family archives". Do NOT include the domain or product name — describe what it DOES.]
===OUTPUT_5_END===

===OUTPUT_6_START===
[Claude Code build prompt — direct instructions for building an MVP. Specify tech stack, core features, user flow, UI direction. Under 30 lines. End with "Build this as a working MVP."]
===OUTPUT_6_END===

## OUTPUT 1 — DECK PROMPT STRUCTURE:

Generate a detailed prompt that will produce an 8-slide pitch deck when pasted into Claude or ChatGPT:

Slide 1 — TITLE: Product name (large), domain, one-line tagline, "[user's name or email] | [today's date]"
Slide 2 — THE PROBLEM: What pain, who feels it, why unsolved
Slide 3 — THE SOLUTION: What it does in plain language, THE KEY INSIGHT that makes it different
Slide 4 — HOW IT WORKS: 3-4 steps of user experience, each with icon concept + short title + one-line description
Slide 5 — WHO BUYS IT: Primary audience, secondary audiences, why they'd pay
Slide 6 — REVENUE MODEL: How it makes money, pricing tiers if applicable, unit economics at scale
Slide 7 — STATUS & PROOF: Current status, any validation, what's needed next
Slide 8 — CLOSING: Product name + domain, one-line pitch repeated, contact email

The prompt should also specify:
- A bold color palette appropriate to the product category (not generic blue)
- Dark title and closing slides, light content slides (sandwich structure)
- Clean typography: Trebuchet MS or Georgia for headers, Calibri for body
- Each slide must have a visual element — icon concept, stat callout, comparison, or diagram
- No bullet points on white backgrounds. Every slide should be designed, not just typed.
- 16:9 format

## IMPORTANT:
- Never break character. You ARE DangerStorm.
- Never show the question sequence as a list.
- If the user says something off-topic, gently redirect: "Love the energy, but let's stay focused. What's the product?"
- Keep your conversational responses SHORT — 1-3 sentences max before asking the next question.
- CRITICAL: When ready, generate ALL FIVE outputs in one response. The deck prompt should be detailed and complete — do not truncate or skip any slide.

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


@app.route("/api/anon-status")
def anon_status():
    allowed, remaining, ident, cookie = check_anon_limit(request)
    resp = make_response(jsonify({"remaining": remaining, "limit": ANON_DAILY_LIMIT}))
    if not request.cookies.get("ds_anon"):
        resp.set_cookie("ds_anon", cookie, max_age=86400 * 365, httponly=True, samesite="Lax")
    return resp


@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    data = request.json
    messages = data.get("messages", [])
    user_email = data.get("userEmail", "")

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Anonymous rate limiting: check if unauthenticated user has remaining conversations
    auth_header = request.headers.get("Authorization", "")
    is_authenticated = False
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        if get_supabase_user(token):
            is_authenticated = True

    anon_cookie = None
    if not is_authenticated:
        # Count new conversations only (first user message = messages has opener + 1 user msg)
        user_msg_count = sum(1 for m in messages if m.get("role") == "user")
        if user_msg_count <= 1:
            allowed, remaining, ident, cookie = check_anon_limit(request)
            anon_cookie = cookie
            if not allowed:
                return jsonify({"error": "anon_limit", "remaining": 0}), 403
            # Record this new conversation
            anonymous_usage[ident].append(time.time())

    # Log the latest user prompt with IP address for patent/IP documentation
    try:
        latest_user_msg = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, list):
                    latest_user_msg = " ".join(p.get("text", "") for p in content if p.get("type") == "text")
                else:
                    latest_user_msg = content
                break
        if latest_user_msg:
            ip_address = parse_forwarded_ip(request.headers.get("X-Forwarded-For")) or request.remote_addr
            # Look up user_id from email if available
            user_id = None
            if user_email:
                try:
                    sb = get_supabase()
                    profile = sb.table("profiles").select("id").eq("email", user_email).limit(1).execute()
                    if profile.data:
                        user_id = profile.data[0]["id"]
                except Exception:
                    pass
            sb = get_supabase()
            sb.table("prompt_log").insert({
                "user_id": user_id,
                "user_email": user_email or None,
                "ip_address": ip_address or "unknown",
                "prompt_text": latest_user_msg[:10000],  # cap at 10k chars
            }).execute()
    except Exception as e:
        print(f"[prompt-log] Failed to log prompt: {e}", flush=True)

    # Build system prompt, injecting user email context if available
    system = SYSTEM_PROMPT
    if user_email:
        system += f"\n\n## USER CONTEXT:\nThe user's email is {user_email}. Use this as the default contact email for the deck slides unless they specify otherwise."

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
        import time
        token_count = 0
        try:
            print(f"[stream] Starting chat stream, {len(api_messages)} messages", flush=True)
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=16000,
                system=system,
                messages=api_messages,
            ) as stream:
                for text in stream.text_stream:
                    token_count += 1
                    yield f"data: {json.dumps({'text': text})}\n\n"
            # Send stop reason so frontend can detect truncation
            msg = stream.get_final_message()
            stop = msg.stop_reason if msg else "unknown"
            usage = msg.usage if msg else None
            meta = {"done": True, "stop_reason": stop}
            if usage:
                meta["output_tokens"] = usage.output_tokens
            print(f"[stream] Completed: stop_reason={stop}, tokens={usage.output_tokens if usage else 'unknown'}", flush=True)
            yield f"data: {json.dumps(meta)}\n\n"
        except anthropic.APIError as e:
            print(f"[stream] APIError after {token_count} chunks: {e}", flush=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except GeneratorExit:
            print(f"[stream] GeneratorExit (client disconnected) after {token_count} chunks", flush=True)
        except Exception as e:
            print(f"[stream] Exception after {token_count} chunks: {type(e).__name__}: {e}", flush=True)
            yield f"data: {json.dumps({'error': f'Stream error: {str(e)}'})}\n\n"

    resp = Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
            "Connection": "keep-alive",
        },
    )
    if anon_cookie and not request.cookies.get("ds_anon"):
        resp.set_cookie("ds_anon", anon_cookie, max_age=86400 * 365, httponly=True, samesite="Lax")
    return resp


EXTRAS_SYSTEM_PROMPT = """You are DangerStorm's output generator. Given a pitch deck prompt that was already generated, produce three additional outputs for the product. Use these exact markers:

===OUTPUT_2_START===
[Carrd landing page copy — plain text, under 150 words]
===OUTPUT_2_END===

===OUTPUT_3_START===
[Kit signup form copy — plain text]
===OUTPUT_3_END===

===OUTPUT_6_START===
[Claude Code build prompt — direct instructions for building an MVP. Specify tech stack, core features, user flow, UI direction. Under 30 lines. End with "Build this as a working MVP."]
===OUTPUT_6_END===

OUTPUT 2 — CARRD COPY: Headline (8 words max), subheadline, 3 benefit-focused bullets with **bold** lead word, social proof placeholder, CTA, footer. Carrd-compatible: **bold**, *italic*, [links](URL) only.

OUTPUT 3 — KIT FORM COPY: Form headline, description, email placeholder, button text, privacy line.

OUTPUT 4 — INTRO PITCH: One paragraph (3-5 sentences, under 75 words). Problem → solution → why it matters. Investor-ready, read-aloud quality.

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
                messages=[{"role": "user", "content": f"Generate all three additional outputs for this product based on the following deck prompt:\n\n{deck_prompt}"}],
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

        raw = response.content[0].text
        # Code fence stripping tested in tests/test_utils.py::TestStripCodeFences
        raw = strip_code_fences(raw)

        slide_data = json.loads(raw)
        return jsonify(slide_data)

    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse slide data from AI"}), 500
    except anthropic.APIError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/session-info")
def session_info():
    """Return the client's IP address for transparency display."""
    # IP parsing tested in tests/test_utils.py::TestParseForwardedIp
    ip = parse_forwarded_ip(request.headers.get("X-Forwarded-For")) or request.remote_addr
    return jsonify({"ip": ip or "unknown"})


@app.route("/privacy")
def privacy():
    return send_from_directory("public", "privacy.html")


@app.route("/terms")
def terms():
    return send_from_directory("public", "terms.html")


@app.route("/dashboard")
def dashboard():
    return send_from_directory("public", "dashboard.html")


@app.route("/account")
def account():
    return send_from_directory("public", "account.html")


@app.route("/<user_id>/<idea_id>")
def view_idea(user_id, idea_id):
    """Serve the main app for bookmarkable idea URLs like /{userId}/{ideaId}"""
    return send_from_directory("public", "index.html")


# strip_null_bytes imported from utils — tested in tests/test_utils.py::TestStripNullBytes


@app.route("/api/save-idea", methods=["POST"])
@require_auth
def save_idea():
    try:
        # Sanitization tested in tests/test_utils.py::TestStripNullBytes
        data = strip_null_bytes(request.json)
        user_id = request.user.id
        # Domain sanitization tested in tests/test_utils.py::TestDomainHelpers
        domain, _ = sanitize_domain(data.get("domain", "None"))
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

        # If client already knows the idea ID, use it directly (re-save)
        existing_idea_id = data.get("existingIdeaId")
        force = data.get("force", False)

        if existing_idea_id:
            # Verify this idea belongs to the user
            check = sb.table("ideas").select("id, product_name").eq("id", existing_idea_id).eq("user_id", user_id).neq("status", "trash").execute()
            if check.data:
                existing = check
            else:
                existing = type('', (), {'data': []})()
        else:
            # No existing ID — always create a new idea
            existing = type('', (), {'data': []})()
        is_new = len(existing.data) == 0

        # Idea limit tested in tests/test_utils.py::TestIdeaLimits
        if is_new and idea_limit_reached(idea_count, tier):
            return jsonify({"error": f"Idea limit reached ({max_ideas_for_tier(tier)}). Upgrade to Pro for more."}), 403

        # Determine status based on whether outputs are present
        has_outputs = bool(outputs.get("output1"))
        idea_status = "complete" if has_outputs else "draft"

        # Upsert idea
        if is_new:
            # Bump sort_order of all existing ideas so new one lands at top (sort_order 0)
            existing_ideas = sb.table("ideas").select("id, sort_order").eq("user_id", user_id).neq("status", "trash").execute()
            for ei in existing_ideas.data:
                sb.table("ideas").update({"sort_order": (ei.get("sort_order") or 0) + 1}).eq("id", ei["id"]).execute()
            try:
                idea_result = sb.table("ideas").insert({
                    "user_id": user_id,
                    "domain": domain,
                    "product_name": product_name,
                    "tagline": tagline,
                    "status": idea_status,
                    "sort_order": 0,
                }).execute()
            except Exception as insert_err:
                err_str = str(insert_err)
                print(f"[save-idea] Insert failed for user={user_id} domain={domain} name={product_name}: {err_str}", flush=True)
                if "unique" in err_str.lower() or "duplicate" in err_str.lower() or "23505" in err_str:
                    return jsonify({"error": f"You already have an idea saved with the domain \"{domain}\". Try saving with a different domain, or update the existing idea from your dashboard."}), 409
                raise
            idea_id = idea_result.data[0]["id"]
        else:
            idea_id = existing.data[0]["id"]
            sb.table("ideas").update({
                "tagline": tagline,
                "status": idea_status,
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
    except Exception as e:
        print(f"[save-idea] Error: {type(e).__name__}: {e}", flush=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/branch-idea", methods=["POST"])
@require_auth
def branch_idea():
    try:
        data = request.json
        idea_id = data.get("ideaId")
        if not idea_id:
            return jsonify({"error": "No idea ID provided"}), 400

        sb = get_supabase()
        user_id = request.user.id

        # Check idea limit (tested in tests/test_utils.py::TestIdeaLimits)
        profile = sb.table("profiles").select("tier, idea_count").eq("id", user_id).single().execute()
        if not profile.data:
            return jsonify({"error": "Profile not found"}), 404

        tier = profile.data["tier"]
        idea_count = profile.data["idea_count"]

        if idea_limit_reached(idea_count, tier):
            return jsonify({"error": f"Idea limit reached ({max_ideas_for_tier(tier)}). Upgrade to Pro for more."}), 403

        # Get the source idea
        source = sb.table("ideas").select("*").eq("id", idea_id).eq("user_id", user_id).single().execute()
        if not source.data:
            return jsonify({"error": "Idea not found"}), 404

        # Get latest version of source
        versions = sb.table("idea_versions").select("*").eq("idea_id", idea_id).order("version_number", desc=True).limit(1).execute()
        if not versions.data:
            return jsonify({"error": "No versions found for this idea"}), 404

        latest = versions.data[0]

        # Domain generation tested in tests/test_utils.py::TestDomainHelpers
        branch_domain, _ = sanitize_domain(None)

        # Bump sort_order so branch lands at top
        existing_ideas = sb.table("ideas").select("id, sort_order").eq("user_id", user_id).neq("status", "trash").execute()
        for ei in existing_ideas.data:
            sb.table("ideas").update({"sort_order": (ei.get("sort_order") or 0) + 1}).eq("id", ei["id"]).execute()

        # Create the branched idea
        branch_name = (source.data.get("product_name") or "Untitled") + " (branch)"
        idea_result = sb.table("ideas").insert({
            "user_id": user_id,
            "domain": branch_domain,
            "product_name": branch_name,
            "tagline": source.data.get("tagline", ""),
            "status": source.data.get("status", "draft"),
            "sort_order": 0,
            "branched_from_id": idea_id,
        }).execute()

        new_idea_id = idea_result.data[0]["id"]

        # Copy the latest version to the new idea
        sb.table("idea_versions").insert({
            "idea_id": new_idea_id,
            "version_number": 1,
            "conversation": latest.get("conversation", []),
            "outputs": latest.get("outputs", {}),
        }).execute()

        return jsonify({
            "ideaId": new_idea_id,
            "parentId": idea_id,
            "parentName": source.data.get("product_name", "Untitled"),
        })
    except Exception as e:
        print(f"[branch-idea] Error: {type(e).__name__}: {e}", flush=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/restore-idea", methods=["POST"])
@require_auth
def restore_idea():
    try:
        data = request.json
        idea_id = data.get("ideaId")
        force = data.get("force", False)

        if not idea_id:
            return jsonify({"error": "No idea ID provided"}), 400

        sb = get_supabase()
        user_id = request.user.id

        # Get the trashed idea
        idea = sb.table("ideas").select("id, domain, product_name").eq("id", idea_id).eq("user_id", user_id).eq("status", "trash").single().execute()
        if not idea.data:
            return jsonify({"error": "Idea not found in trash"}), 404

        domain = idea.data["domain"]

        # Check if domain is now used by an active idea
        if domain and domain != "None":
            existing = sb.table("ideas").select("id, product_name").eq("user_id", user_id).eq("domain", domain).neq("status", "trash").execute()
            if existing.data and not force:
                return jsonify({
                    "conflict": True,
                    "existingId": existing.data[0]["id"],
                    "existingName": existing.data[0]["product_name"],
                    "domain": domain,
                }), 409

        # Restore: if force and domain conflict, append "-restored" to domain
        if force and domain and domain != "None":
            existing = sb.table("ideas").select("id").eq("user_id", user_id).eq("domain", domain).neq("status", "trash").execute()
            if existing.data:
                sb.table("ideas").update({
                    "status": "complete",
                    "domain": domain + "-restored",
                }).eq("id", idea_id).execute()
                return jsonify({"restored": True, "newDomain": domain + "-restored"})

        sb.table("ideas").update({"status": "complete"}).eq("id", idea_id).execute()
        return jsonify({"restored": True})
    except Exception as e:
        print(f"[restore-idea] Error: {type(e).__name__}: {e}", flush=True)
        return jsonify({"error": str(e)}), 500


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

        # Downgrade: revert to pioneer (early adopter) or free
        # Check if user was pioneer before upgrading
        profile = sb.table("profiles").select("created_at").eq("stripe_customer_id", customer_id).single().execute()
        # Early adopters (pioneer) keep pioneer status; others go to free
        # For now, all existing users are pioneers, so revert to pioneer
        sb.table("profiles").update({
            "tier": "pioneer",
            "stripe_subscription_id": None,
        }).eq("stripe_customer_id", customer_id).execute()

    return jsonify({"received": True})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    debug = os.getenv("RAILWAY_ENVIRONMENT") is None
    app.run(debug=debug, host="0.0.0.0", port=port)
