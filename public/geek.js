// geek.js — X-Ray Mode Easter Egg
// Activated by clicking the DangerStorm logo after outputs are generated,
// or via the Geek Mode button on dashboard cards

(function () {

  // ── Annotations for the deck prompt slides ─────────────────────────────

  const DECK_ANNOTATIONS = {
    intro: {
      label: "The Setup",
      note: "Context-first framing. The AI is told what to produce before it reads any details. This front-loads the output type so every downstream decision filters through 'I'm building a pitch deck' — not 'I'm answering a question.'"
    },
    'SLIDE 1': {
      label: "Slide 1 — Title",
      note: "Specificity beats vagueness. Real product name, real domain, real date. The more concrete the inputs, the less the AI has to invent — and invented details dilute your actual idea."
    },
    'SLIDE 2': {
      label: "Slide 2 — The Problem",
      note: "Problem-first narrative. Without an explicit problem slide, AI defaults to leading with features. This forces the 'why this matters' before the 'what it does.'"
    },
    'SLIDE 3': {
      label: "Slide 3 — The Solution",
      note: "The money slide. This is where DangerStorm spent the most time in your conversation — extracting the one insight that makes your idea different. The 'keep it simple' instruction prevents AI's tendency to overexplain."
    },
    'SLIDE 4': {
      label: "Slide 4 — How It Works",
      note: "Steps, not features. A 3-4 step flow is more persuasive than a feature list because it tells a story. The 4-step max constraint forces simplicity — if it takes more than 4 steps to explain, the product is too complex for one slide."
    },
    'SLIDE 5': {
      label: "Slide 5 — Who Buys It",
      note: "'Everyone' is not a market. Naming primary and secondary audiences — and why they'd pay — forces the AI to write for real humans, not an imagined average user."
    },
    'SLIDE 6': {
      label: "Slide 6 — Revenue Model",
      note: "Business model clarity. Investors read this slide before Slide 2. Without explicit prompting here, AI produces vague 'subscription model' boilerplate. Specific inputs produce specific outputs."
    },
    'SLIDE 7': {
      label: "Slide 7 — Status & Proof",
      note: "Credibility anchoring. Even an idea with zero users can show validation. This forces the AI to work with what actually exists, instead of hiding behind 'we're in stealth.'"
    },
    'SLIDE 8': {
      label: "Slide 8 — Closing",
      note: "The bookend. Repeating the core pitch on the closing slide is a proven technique. Claude doesn't do this by default — it needs to be told to close the loop."
    },
    design: {
      label: "Design Direction",
      note: "'Make it look good' produces generic results. Naming specific fonts, specific color strategies ('not generic blue'), and anti-patterns ('no bullet points on white backgrounds') gives the AI concrete constraints to design within. Constraints produce creativity — freedom produces mediocrity."
    }
  };

  // ── Annotations for the other outputs ──────────────────────────────────

  const OUTPUT_ANNOTATIONS = {
    output4: {
      title: "INTRO PITCH",
      subtitle: "The 75-word elevator pitch paragraph",
      note: "This output is constrained to 3-5 sentences, under 75 words. The structure is prescribed: open with the problem, pivot to the solution, land on why it matters. Without these constraints, AI produces either a single vague sentence or a 300-word essay. The word limit forces every sentence to earn its place."
    },
    output2: {
      title: "CARRD LANDING PAGE COPY",
      subtitle: "Ready-to-paste copy for a one-page Carrd.co site",
      note: "This output follows Carrd's actual formatting constraints: no headers, no HTML, just bold/italic/links. The structure (headline → subheadline → 3 bullets → social proof → CTA → footer) mirrors every high-converting landing page. The 150-word limit prevents AI from writing a novel when you need a billboard."
    },
    output3: {
      title: "KIT SIGNUP FORM COPY",
      subtitle: "Email capture form for Kit (ConvertKit)",
      note: "Five micro-copy elements that most people agonize over: headline, description, placeholder, button text, and privacy line. Each one is constrained to be specific and action-oriented. 'Get early access' converts better than 'Submit' because it tells people what they're getting, not what they're doing."
    },
    output6: {
      title: "CLAUDE CODE BUILD PROMPT",
      subtitle: "Direct instructions for an AI to build the MVP",
      note: "This is the most powerful output. It takes everything DangerStorm learned about your product and translates it into build instructions: tech stack, core features, user flow, UI direction. Under 30 lines, ending with 'Build this as a working MVP.' This is a prompt that produces a working product — meta-prompting at its most practical."
    }
  };

  // ── Actual system prompt sections for inception ─────────────────────────

  const INCEPTION_SECTIONS = [
    {
      label: "Identity & Voice",
      text: "You are DangerStorm — a confident, direct, product-savvy AI that helps people turn product ideas into professional pitch deck prompts in under 90 seconds.\n\nYour voice: You talk like a senior product manager who's evaluated a thousand ideas and knows instantly what makes one work. Confident, direct, excited when you see a great angle, and willing to push back when something is vague.",
      note: "Role definition. Giving an AI a specific persona produces dramatically different outputs than a generic request. 'You are a senior product manager' activates a completely different response pattern than 'help me with a pitch.' Identity shapes every word choice, every reaction, every judgment call."
    },
    {
      label: "Conversation Rules",
      text: "## CONVERSATION RULES (STRICT)\n\n1. Always ask ONLY ONE question per response. Never bundle questions.\n2. Be extremely aggressive about extracting info from previous answers. If the user already provided or strongly implied something, skip that question entirely — don't mention you skipped it.\n3. Max 5 total exchanges (including opener). Often 3–4 is enough.\n4. After each user reply: acknowledge/react conversationally, then either ask exactly one next question OR generate all three outputs if you have enough.",
      note: "Behavioral constraints. Without rule #1, AI asks everything at once — efficient for the AI, terrible for the human. Rule #2 prevents the annoying 'you already told me this' problem. Rule #3 forces a bias toward action over interrogation. Rule #4 creates the conversational rhythm: acknowledge → react → advance."
    },
    {
      label: "Question Sequence",
      text: "## CONVERSATION SEQUENCE (ask adaptively, never show as a list):\n\n1. Elevator pitch + domain (ask together in opener)\n2. Primary user / who buys it (only if not clear from pitch)\n3. Revenue model (only if not obvious)\n4. The one key differentiator / insight (almost always ask — it's the heart of Slide 3)\n5. Contact email for the slides\n6. Competitor/reference URL (truly optional)\n7. Current status (often inferable or skippable)",
      note: "Adaptive sequencing. The parenthetical skip conditions are critical — they prevent the AI from robotically marching through every question. 'Only if not clear from pitch' teaches the AI to listen, not just ask. Most prompt engineers forget to tell the AI when NOT to do something."
    },
    {
      label: "Reaction Style",
      text: "## REACTION STYLE:\n\n- Paraphrase to confirm: \"OK, so [domain] — [what it does]. I like the angle.\"\n- Push back if vague: \"That's still pretty broad. Nail the one thing it does better than anything else. What's that?\"\n- Show excitement: \"Boom — that's the insight nobody else has. That's your Slide 3 money.\"\n- If they give a URL: \"Got it — so this is similar to [X] but your angle is [differentiator]. Sharp.\"",
      note: "Few-shot examples. Instead of saying 'be conversational,' the prompt shows exactly what that sounds like. These examples anchor the AI's tone — it will pattern-match against them for every response. The pushback example is especially important: it gives the AI permission to challenge the user, which most AI systems won't do unprompted."
    },
    {
      label: "Output Markers",
      text: "## WHEN YOU HAVE ENOUGH INFO (usually after 3-5 exchanges):\n\nGenerate ALL SIX outputs in one response. Use these exact markers so the frontend can parse them:\n\n===OUTPUT_1_START===\n[The complete deck prompt]\n===OUTPUT_1_END===\n\n===OUTPUT_2_START===\n[Carrd landing page copy]\n===OUTPUT_2_END===\n\n...and so on for all 6 outputs.",
      note: "Structured output parsing. The ===MARKERS=== are a contract between the AI and the code. The frontend splits on these exact strings to extract each output into its own display block. Without them, you'd need fragile regex or manual copy-paste. This is the bridge between 'AI conversation' and 'usable product.'"
    },
    {
      label: "Output 1 — Deck Structure",
      text: "## OUTPUT 1 — DECK PROMPT STRUCTURE:\n\nGenerate a detailed prompt that will produce an 8-slide pitch deck when pasted into Claude or ChatGPT:\n\nSlide 1 — TITLE: Product name (large), domain, one-line tagline, \"[user's name or email] | [today's date]\"\nSlide 2 — THE PROBLEM: What pain, who feels it, why unsolved\nSlide 3 — THE SOLUTION: What it does in plain language, THE KEY INSIGHT that makes it different\nSlide 4 — HOW IT WORKS: 3-4 steps of user experience, each with icon concept + short title + one-line description\nSlide 5 — WHO BUYS IT: Primary audience, secondary audiences, why they'd pay\nSlide 6 — REVENUE MODEL: How it makes money, pricing tiers if applicable, unit economics at scale\nSlide 7 — STATUS & PROOF: Current status, any validation, what's needed next\nSlide 8 — CLOSING: Product name + domain, one-line pitch repeated, contact email",
      note: "Prompt-within-a-prompt. DangerStorm generates a prompt that another AI will execute. Each slide is specified with enough structure to prevent the downstream AI from improvising, but enough flexibility to adapt to any product. This is meta-prompting — the hardest and most powerful prompt engineering technique."
    },
    {
      label: "Output 2 — Carrd Landing Page",
      text: "===OUTPUT_2_START===\n[Carrd landing page copy — plain text, under 150 words. Headline (8 words max), subheadline, 3 benefit-focused bullets with **bold** lead word, social proof placeholder, CTA, footer. Carrd-compatible: **bold**, *italic*, [links](URL) only.]",
      note: "Platform-specific constraints. Carrd.co only supports bold, italic, and links — no headers, no HTML, no lists. Specifying these real-world limitations prevents the AI from generating beautiful copy that can't actually be pasted into the target platform. The 150-word limit prevents verbosity."
    },
    {
      label: "Output 3 — Kit Signup Form",
      text: "===OUTPUT_3_START===\n[Kit signup form copy — Form headline (\"Be the first to know when [product] launches\"), description, email placeholder, button text, privacy line.]",
      note: "Micro-copy engineering. Five tiny text fields that most founders agonize over for hours. By specifying the exact structure and giving an example headline format, the AI produces copy that's ready to paste directly into Kit (ConvertKit). The specificity ('button text', 'privacy line') prevents generic output."
    },
    {
      label: "Output 4 — Intro Pitch",
      text: "===OUTPUT_4_START===\n[One-paragraph introductory pitch — 3-5 sentences that you could read aloud to introduce this product to an investor or audience. Open with the problem, pivot to the solution, land on why it matters. Confident, polished, no jargon. Under 75 words.]",
      note: "Narrative structure in 75 words. The instruction 'open with the problem, pivot to the solution, land on why it matters' prescribes a three-act structure within a single paragraph. 'You could read aloud' forces conversational language. Without 'no jargon', AI defaults to buzzwords."
    },
    {
      label: "Output 5 — Summary Label",
      text: "===OUTPUT_5_START===\n[One sentence summarizing the product idea, under 15 words. This is used as the saved idea label. Example: \"AI photo dating tool for scanned family archives\". Do NOT include the domain or product name — describe what it DOES.]",
      note: "Internal utility output. Users never see this directly — it becomes the idea card description on the dashboard. The negative instruction ('do NOT include the domain or product name') prevents redundancy since those are displayed separately. The example anchors the format."
    },
    {
      label: "Output 6 — Claude Code Build Prompt",
      text: "===OUTPUT_6_START===\n[Claude Code build prompt — direct instructions for building an MVP. Specify tech stack, core features, user flow, UI direction. Under 30 lines. End with \"Build this as a working MVP.\"]",
      note: "The most powerful output. This turns a product idea into a buildable specification. 'Under 30 lines' forces brutal prioritization — only the essential MVP scope survives. 'End with Build this as a working MVP' is the trigger phrase that tells Claude Code to actually execute, not just plan."
    },
    {
      label: "Design Constraints",
      text: "The prompt should also specify:\n- A bold color palette appropriate to the product category (not generic blue)\n- Dark title and closing slides, light content slides (sandwich structure)\n- Clean typography: Trebuchet MS or Georgia for headers, Calibri for body\n- Each slide must have a visual element\n- No bullet points on white backgrounds. Every slide should be designed, not just typed.\n- 16:9 format",
      note: "'Make it look good' produces generic results. Naming specific fonts, specific color strategies ('not generic blue'), and anti-patterns ('no bullet points on white backgrounds') gives the AI concrete constraints to design within. Constraints produce creativity — freedom produces mediocrity."
    },
    {
      label: "Guardrails",
      text: "## IMPORTANT:\n- Never break character. You ARE DangerStorm.\n- Never show the question sequence as a list.\n- If the user says something off-topic, gently redirect.\n- Keep your conversational responses SHORT — 1-3 sentences max before asking the next question.\n- CRITICAL: When ready, generate ALL outputs in one response. Do not truncate or skip any slide.",
      note: "Failure mode prevention. Every guardrail here addresses a specific way the AI tends to fail: breaking character when confused, revealing its internal structure, going verbose, or generating incomplete output. Good prompts anticipate failure modes and block them explicitly."
    }
  ];

  let geekModeActive = false;
  let outputsReady = false;
  let storedConversation = null;
  let storedOutputs = null;

  // ── Init (idea editor page — logo click) ───────────────────────────────

  function init() {
    const brand = document.querySelector('.header-brand');
    if (!brand) return;
    brand.addEventListener('click', handleLogoClick);
  }

  function triggerPulse(conversation) {
    outputsReady = true;
    storedConversation = conversation || null;
    // Grab all outputs from the DOM for editor-page use
    storedOutputs = {
      output1: (document.getElementById('output-1-content') || {}).textContent || '',
      output2: (document.getElementById('output-2-content') || {}).textContent || '',
      output3: (document.getElementById('output-3-content') || {}).textContent || '',
      output4: (document.getElementById('output-4-content') || {}).textContent || '',
      output6: (document.getElementById('output-6-content') || {}).textContent || ''
    };
    const bolt = document.querySelector('.header-bolt');
    const brand = document.querySelector('.header-brand');
    if (!bolt || !brand) return;
    bolt.classList.add('geek-pulse');
    brand.classList.add('geek-clickable');
    brand.title = 'Click to see why this prompt works →';
  }

  function resetGeekMode() {
    outputsReady = false;
    geekModeActive = false;
    storedConversation = null;
    storedOutputs = null;
    const bolt = document.querySelector('.header-bolt');
    const brand = document.querySelector('.header-brand');
    if (bolt) { bolt.classList.remove('geek-pulse', 'geek-active'); }
    if (brand) { brand.classList.remove('geek-clickable'); brand.title = ''; }
    const geekView = document.getElementById('geek-view');
    if (geekView) geekView.remove();
    const contentEl = document.getElementById('output-1-content');
    if (contentEl) contentEl.style.display = '';
  }

  function handleLogoClick() {
    if (!outputsReady) return;
    if (geekModeActive) {
      exitGeekMode();
    } else {
      enterGeekMode();
    }
  }

  // ── User phrase extraction ─────────────────────────────────────────────

  function extractUserPhrases(conversation) {
    if (!conversation || !conversation.length) return [];
    var phrases = [];
    var msgNum = 0;
    conversation.forEach(function (msg) {
      if (msg.role !== 'user') return;
      msgNum++;
      var text = typeof msg.content === 'string' ? msg.content : '';
      if (!text) return;
      var label = 'Message ' + msgNum;

      // Extract individual tokens: emails, domains, proper names, URLs
      // Emails
      var emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emailMatch) emailMatch.forEach(function (e) {
        phrases.push({ text: e, source: label, fullMessage: text.trim(), type: 'email' });
      });

      // Domains (word.tld patterns)
      var domainMatch = text.match(/[a-zA-Z0-9-]+\.(?:com|net|org|io|co|ai|app|dev|xyz|vc|me|info|biz|us|ca|uk)/gi);
      if (domainMatch) domainMatch.forEach(function (d) {
        phrases.push({ text: d, source: label, fullMessage: text.trim(), type: 'domain' });
      });

      // Split on common delimiters to find distinct phrases/names
      var chunks = text.split(/[,.\n;:!?]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 3; });
      chunks.forEach(function (chunk) {
        // Short chunks (3-19 chars) — likely names, single terms
        if (chunk.length >= 3 && chunk.length < 20) {
          phrases.push({ text: chunk, source: label, fullMessage: text.trim(), type: 'short' });
        }
        // Longer chunks — sentence-level phrases
        if (chunk.length >= 20) {
          phrases.push({ text: chunk, source: label, fullMessage: text.trim(), type: 'phrase' });
        }
      });

      // Also the full message for multi-word matching
      if (text.trim().length >= 10) {
        phrases.push({ text: text.trim(), source: label, fullMessage: text.trim(), type: 'full' });
      }
    });
    return phrases;
  }

  function findMatchingPhrases(promptText, userPhrases) {
    var matches = [];
    var promptLower = promptText.toLowerCase();

    userPhrases.forEach(function (phrase) {
      // For short items (names, domains, emails): exact match, case-insensitive
      if (phrase.type === 'email' || phrase.type === 'domain' || phrase.type === 'short') {
        var searchTerm = phrase.text.toLowerCase();
        if (searchTerm.length < 3) return;
        var startIdx = 0;
        while (true) {
          var idx = promptLower.indexOf(searchTerm, startIdx);
          if (idx === -1) break;
          // For short matches, require word boundaries to avoid false positives
          if (phrase.type === 'short' && phrase.text.length < 8) {
            var before = idx > 0 ? promptText[idx - 1] : ' ';
            var after = idx + searchTerm.length < promptText.length ? promptText[idx + searchTerm.length] : ' ';
            if (/[a-zA-Z0-9]/.test(before) || /[a-zA-Z0-9]/.test(after)) {
              startIdx = idx + 1;
              continue;
            }
          }
          var actual = promptText.substring(idx, idx + searchTerm.length);
          if (!hasOverlap(matches, idx, idx + searchTerm.length)) {
            matches.push({
              start: idx,
              end: idx + searchTerm.length,
              text: actual,
              source: phrase.source,
              fullMessage: phrase.fullMessage
            });
          }
          startIdx = idx + searchTerm.length;
        }
        return;
      }

      // For longer phrases: sliding window of word sequences
      var words = phrase.text.split(/\s+/);
      for (var len = Math.min(words.length, 12); len >= 2; len--) {
        for (var start = 0; start <= words.length - len; start++) {
          var snippet = words.slice(start, start + len).join(' ');
          if (snippet.length < 8) continue;
          var idx = promptLower.indexOf(snippet.toLowerCase());
          if (idx !== -1) {
            var actual = promptText.substring(idx, idx + snippet.length);
            if (!hasOverlap(matches, idx, idx + snippet.length)) {
              matches.push({
                start: idx,
                end: idx + snippet.length,
                text: actual,
                source: phrase.source,
                fullMessage: phrase.fullMessage
              });
            }
          }
        }
      }
    });

    matches.sort(function (a, b) { return a.start - b.start; });
    return matches;
  }

  function hasOverlap(matches, start, end) {
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      if (start < m.end && end > m.start) return true;
    }
    return false;
  }

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightPhrases(ignoredEscaped, sectionText, allMatches) {
    // Work on RAW text with position indices, escape each segment individually
    var sectionLower = sectionText.toLowerCase();

    // Find all matches within this section
    var sectionMatches = [];
    allMatches.forEach(function (match) {
      var searchIdx = 0;
      var matchLower = match.text.toLowerCase();
      while (true) {
        var idx = sectionLower.indexOf(matchLower, searchIdx);
        if (idx === -1) break;
        sectionMatches.push({
          start: idx,
          end: idx + match.text.length,
          source: match.source,
          fullMessage: match.fullMessage
        });
        searchIdx = idx + match.text.length;
      }
    });

    if (sectionMatches.length === 0) return esc(sectionText);

    // Sort by start position, then by length descending (prefer longer matches)
    sectionMatches.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });

    // Remove overlaps (keep first/longest)
    var filtered = [sectionMatches[0]];
    for (var i = 1; i < sectionMatches.length; i++) {
      if (sectionMatches[i].start >= filtered[filtered.length - 1].end) {
        filtered.push(sectionMatches[i]);
      }
    }

    // Build result by walking through the raw text
    var result = '';
    var cursor = 0;
    filtered.forEach(function (match) {
      // Text before this match
      if (match.start > cursor) {
        result += esc(sectionText.substring(cursor, match.start));
      }
      // The highlighted match
      var matchText = sectionText.substring(match.start, match.end);
      var escapedMsg = match.fullMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      var tooltip = 'From your input (' + match.source + ')';
      result += '<span class="geek-user-phrase" data-tooltip="' + tooltip + '" data-source="' + escapedMsg + '">' + esc(matchText) + '</span>';
      cursor = match.end;
    });
    // Remaining text after last match
    if (cursor < sectionText.length) {
      result += esc(sectionText.substring(cursor));
    }

    return result;
  }

  // ── Help system prompt sections for Level 2 ─────────────────────────────

  const HELP_PROMPT_SECTIONS = [
    {
      label: "Identity Switch",
      text: "You are DangerStorm's built-in help assistant. You help users understand how to use DangerStorm effectively.",
      note: "Same AI, different persona. The help chatbot uses the same Claude model as the main conversation, but this single line transforms it from an aggressive product strategist into a friendly guide. One sentence of role definition, completely different behavior."
    },
    {
      label: "Product Knowledge",
      text: "## ABOUT DANGERSTORM\nDangerStorm is a conversational tool that takes a product idea and a domain name and generates a professional product pitch deck prompt in under 90 seconds.\n\n## HOW IT WORKS\n1. The user types their product idea and domain name in the chat\n2. DangerStorm asks 3-5 follow-up questions (one at a time)\n3. Once it has enough info, it generates multiple outputs:\n   - Pitch Deck Prompt\n   - Intro Pitch\n   - Carrd Landing Page Copy\n   - Kit Signup Form Copy\n   - Build Prompt",
      note: "Grounding context. Without this section, the help bot would hallucinate features that don't exist. By spelling out exactly what DangerStorm does and how, every answer stays accurate. This is the difference between a help bot that guesses and one that knows."
    },
    {
      label: "Feature Reference",
      text: "## KEY FEATURES\n- Save Ideas — sign in to save your ideas to a personal dashboard\n- Refine — after outputs are generated, click \"Refine\" to re-enter the conversation\n- Branch — create a variation of an existing idea\n- Download All — download all outputs as a zip file\n- Attach Files — attach images or documents for context\n- Free tier — 3 conversations without signing in; unlimited with a free account",
      note: "Explicit feature list. AI can't discover features by using the product — it needs to be told what exists. Each feature is described in user-facing language ('click Refine') not developer language ('POST /api/refine'). The bot answers like a user who knows the product, not an engineer who built it."
    },
    {
      label: "Usage Tips",
      text: "## TIPS FOR GREAT RESULTS\n- Be specific about what makes your product different — that's the heart of Slide 3\n- Have a domain in mind (even if you haven't bought it yet)\n- If DangerStorm asks a question you've already answered, just say \"I already told you\"\n- The more concrete your elevator pitch, the fewer follow-up questions needed\n- You can paste the deck prompt into Claude, ChatGPT, or any AI to generate the actual slides",
      note: "Proactive guidance. These tips aren't just answers to FAQs — they teach users how to get better results. Tip #3 is especially important: it tells users they can push back on the AI, which most people don't realize is an option."
    },
    {
      label: "Behavioral Guardrails",
      text: "## YOUR BEHAVIOR\n- Be friendly, concise, and helpful\n- Answer questions about DangerStorm's features, workflow, and tips\n- If the user asks something unrelated to DangerStorm, gently redirect\n- Keep answers short — 2-4 sentences max unless they ask for detail\n- Use a warm, approachable tone (not the aggressive product-strategist voice of the main chat)",
      note: "Tone calibration. The parenthetical '(not the aggressive product-strategist voice)' is doing heavy lifting — it explicitly contrasts this persona with the main chat persona. Without it, the help bot might bleed the main character's pushback style into support answers. Negative examples are as important as positive ones."
    }
  ];

  // ── Core rendering (shared between editor + overlay) ───────────────────

  function renderGeekView(outputs, conversation) {
    var userPhrases = extractUserPhrases(conversation);

    // ── Level 0: Output X-ray ──
    var level0Html = buildLevel0(outputs, userPhrases);

    // ── Level 1: System prompt ──
    var level1Html = buildLevel1();

    // ── Level 2: Help prompt ──
    var level2Html = buildLevel2();

    var html =
      '<div class="geek-levels">' +
        '<button class="geek-level-tab active" data-level="0" onclick="window.__geekMode.switchLevel(this)"><span class="level-emoji">&#128269;</span> X-Ray</button>' +
        '<button class="geek-level-tab" data-level="1" onclick="window.__geekMode.switchLevel(this)"><span class="level-emoji">&#128165;</span> Full Inception</button>' +
        '<button class="geek-level-tab" data-level="2" onclick="window.__geekMode.switchLevel(this)"><span class="level-emoji">&#9889;</span> Help Prompt</button>' +
      '</div>' +
      '<div class="geek-level-content active" data-level="0">' + level0Html + '</div>' +
      '<div class="geek-level-content" data-level="1">' + level1Html + '</div>' +
      '<div class="geek-level-content" data-level="2">' + level2Html + '</div>';
    return html;
  }

  function buildLevel0(outputs, userPhrases) {
    // Build filing cabinet tabs for each output
    var tabs = [];
    if (outputs.output1) tabs.push({ key: 'output1', label: 'Pitch Deck' });
    if (outputs.output6) tabs.push({ key: 'output6', label: 'Build Prompt' });
    if (outputs.output4) tabs.push({ key: 'output4', label: 'Intro Pitch' });
    if (outputs.output2) tabs.push({ key: 'output2', label: 'Landing Page' });
    if (outputs.output3) tabs.push({ key: 'output3', label: 'Signup Form' });

    var tabBarHtml = '';
    if (tabs.length > 1) {
      tabBarHtml = '<div class="geek-tabs">';
      tabs.forEach(function (tab, i) {
        tabBarHtml += '<button class="geek-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + tab.key + '" onclick="window.__geekMode.switchTab(this)">' + tab.label + '</button>';
      });
      tabBarHtml += '</div>';
    }

    var tabContentHtml = '';
    tabs.forEach(function (tab, i) {
      var text = outputs[tab.key];
      var allMatches = findMatchingPhrases(text, userPhrases);

      var legendHtml = allMatches.length > 0
        ? '<div class="geek-legend"><span class="geek-legend-swatch"></span> Highlighted = from your input (hover for source)</div>'
        : '';

      var bodyHtml = (tab.key === 'output1')
        ? buildDeckAnnotatedView(text, allMatches)
        : buildOutputAnnotatedView(tab.key, text, allMatches);

      tabContentHtml += '<div class="geek-tab-content' + (i === 0 ? ' active' : '') + '" data-tab="' + tab.key + '">' +
        legendHtml + bodyHtml + '</div>';
    });

    return tabBarHtml + tabContentHtml;
  }

  function buildLevel1() {
    var html = '<div class="inception-block" style="border:none;padding:0;margin:0;">' +
      '<div class="inception-header">FULL INCEPTION &mdash; THE SYSTEM PROMPT</div>' +
      '<p class="inception-intro">This is the actual system prompt that drove your conversation. Every question DangerStorm asked, every pushback, every moment of excitement &mdash; all of it came from these instructions.</p>';

    INCEPTION_SECTIONS.forEach(function (s) {
      var escaped = esc(s.text);
      html +=
        '<div class="geek-section annotated inception-section">' +
          '<div class="geek-annotation">' +
            '<span class="geek-ann-label">' + s.label + '</span>' +
            '<p class="geek-ann-note">' + s.note + '</p>' +
          '</div>' +
          '<pre class="geek-text">' + escaped + '</pre>' +
        '</div>';
    });

    html += '<p class="inception-meta">This experience you just had? It was driven by a prompt too. Now you know how to write one.</p>';
    html += '</div>';
    return html;
  }

  function buildLevel2() {
    var html = '<div class="inception-block" style="border:none;padding:0;margin:0;">' +
      '<div class="inception-header">THE HELP PROMPT</div>' +
      '<p class="inception-intro">DangerStorm has a second AI personality &mdash; the help chatbot (the ? button). Same model, completely different prompt. Here\'s how one system prompt creates two distinct experiences.</p>';

    HELP_PROMPT_SECTIONS.forEach(function (s) {
      var escaped = esc(s.text);
      html +=
        '<div class="geek-section annotated inception-section">' +
          '<div class="geek-annotation">' +
            '<span class="geek-ann-label">' + s.label + '</span>' +
            '<p class="geek-ann-note">' + s.note + '</p>' +
          '</div>' +
          '<pre class="geek-text">' + escaped + '</pre>' +
        '</div>';
    });

    html += '<p class="inception-meta">Two prompts. Two personalities. One AI. That\'s the power of prompt engineering.</p>';
    html += '</div>';
    return html;
  }

  function switchLevel(btn) {
    var level = btn.getAttribute('data-level');
    var container = btn.closest('#geek-view') || btn.closest('.geek-panel-content');
    if (!container) return;

    container.querySelectorAll('.geek-level-tab').forEach(function (t) { t.classList.remove('active'); });
    container.querySelectorAll('.geek-level-content').forEach(function (c) { c.classList.remove('active'); });
    btn.classList.add('active');
    var target = container.querySelector('.geek-level-content[data-level="' + level + '"]');
    if (target) target.classList.add('active');
  }

  function switchTab(btn) {
    var tabKey = btn.getAttribute('data-tab');
    var container = btn.closest('.geek-level-content') || btn.closest('#geek-view');
    if (!container) return;

    container.querySelectorAll('.geek-tab').forEach(function (t) { t.classList.remove('active'); });
    container.querySelectorAll('.geek-tab-content').forEach(function (c) { c.classList.remove('active'); });
    btn.classList.add('active');
    var target = container.querySelector('.geek-tab-content[data-tab="' + tabKey + '"]');
    if (target) target.classList.add('active');
  }

  // ── Editor-page geek mode (logo click) ─────────────────────────────────

  function enterGeekMode() {
    geekModeActive = true;
    localStorage.setItem('ds-geek-discovered', '1');

    const bolt = document.querySelector('.header-bolt');
    if (bolt) { bolt.classList.remove('geek-pulse'); bolt.classList.add('geek-active'); }

    const output1 = document.getElementById('output-1');
    const contentEl = document.getElementById('output-1-content');
    if (!output1 || !contentEl) return;

    contentEl.style.display = 'none';

    const geekView = document.createElement('div');
    geekView.id = 'geek-view';
    geekView.innerHTML = renderGeekView(storedOutputs || { output1: contentEl.textContent }, storedConversation) +
      '<div style="text-align:center;margin-top:8px;">' +
        '<button class="geek-close-btn" onclick="window.__geekMode.exit()">Exit X-ray</button>' +
      '</div>';

    output1.appendChild(geekView);
    geekView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitGeekMode() {
    geekModeActive = false;
    const geekView = document.getElementById('geek-view');
    if (geekView) geekView.remove();
    const contentEl = document.getElementById('output-1-content');
    if (contentEl) contentEl.style.display = '';
    const bolt = document.querySelector('.header-bolt');
    if (bolt) { bolt.classList.remove('geek-active'); bolt.classList.add('geek-pulse'); }
  }

  // ── Dashboard overlay mode ─────────────────────────────────────────────

  function launchGeekOverlay(outputs, ideaName, conversation) {
    var overlay = document.getElementById('geek-overlay');
    if (!overlay) return;

    var title = overlay.querySelector('.geek-panel-title');
    if (title) title.textContent = '\u26A1 X-RAY MODE \u2014 ' + (ideaName || 'Prompt Analysis');

    var content = overlay.querySelector('.geek-panel-content');
    if (content) {
      var geekView = document.createElement('div');
      geekView.id = 'geek-view';
      geekView.innerHTML = renderGeekView(outputs, conversation);
      content.innerHTML = '';
      content.appendChild(geekView);
    }

    overlay.classList.remove('hidden');
    localStorage.setItem('ds-geek-discovered', '1');
  }

  function closeGeekOverlay() {
    var overlay = document.getElementById('geek-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      var content = overlay.querySelector('.geek-panel-content');
      if (content) content.innerHTML = '';
    }
  }

  // ── Shared helpers ─────────────────────────────────────────────────────

  function buildDeckAnnotatedView(text, allMatches) {
    const sections = [];
    const firstSlide = text.search(/SLIDE 1/i);

    if (firstSlide > 0) {
      sections.push({ key: 'intro', text: text.substring(0, firstSlide).trim() });
    }

    const slideText = firstSlide >= 0 ? text.substring(firstSlide) : text;
    const parts = slideText.split(/(?=SLIDE \d+)/i);

    parts.forEach(function (part) {
      const m = part.match(/^(SLIDE \d+)/i);
      if (m) {
        sections.push({ key: m[1].toUpperCase(), text: part.trim() });
      } else if (part.trim()) {
        sections.push({ key: 'design', text: part.trim() });
      }
    });

    if (sections.length === 0) {
      sections.push({ key: 'intro', text: text.trim() });
    }

    return '<div class="geek-sections">' + sections.map(function (section) {
      const ann = DECK_ANNOTATIONS[section.key];
      var html = (allMatches && allMatches.length > 0)
        ? highlightPhrases(null, section.text, allMatches)
        : esc(section.text);
      if (ann) {
        return '<div class="geek-section annotated">' +
          '<div class="geek-annotation">' +
            '<span class="geek-ann-label">' + ann.label + '</span>' +
            '<p class="geek-ann-note">' + ann.note + '</p>' +
          '</div>' +
          '<pre class="geek-text">' + html + '</pre>' +
        '</div>';
      }
      return '<div class="geek-section"><pre class="geek-text">' + html + '</pre></div>';
    }).join('') + '</div>';
  }

  function buildOutputAnnotatedView(outputKey, text, allMatches) {
    var ann = OUTPUT_ANNOTATIONS[outputKey];
    var escaped = (allMatches && allMatches.length > 0)
      ? highlightPhrases(null, text, allMatches)
      : esc(text);

    var html = '<div class="geek-sections">';
    html += '<div class="geek-section annotated">';
    if (ann) {
      html += '<div class="geek-annotation">' +
        '<span class="geek-ann-label">' + ann.subtitle + '</span>' +
        '<p class="geek-ann-note">' + ann.note + '</p>' +
      '</div>';
    }
    html += '<pre class="geek-text">' + escaped + '</pre>';
    html += '</div></div>';
    return html;
  }

  // ── Exports ────────────────────────────────────────────────────────────

  window.__geekMode = {
    exit: exitGeekMode,
    launchOverlay: launchGeekOverlay,
    closeOverlay: closeGeekOverlay,
    switchTab: switchTab,
    switchLevel: switchLevel
  };
  window.triggerGeekPulse = triggerPulse;
  window.resetGeekMode = resetGeekMode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
