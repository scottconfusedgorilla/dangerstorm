// geek.js — X-Ray Mode Easter Egg
// Activated by clicking the DangerStorm logo after outputs are generated,
// or via the Geek Mode button on dashboard cards

(function () {
  const ANNOTATIONS = {
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

  // The actual system prompt sections with annotations explaining WHY each part works
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
      label: "Deck Structure",
      text: "## OUTPUT 1 — DECK PROMPT STRUCTURE:\n\nSlide 1 — TITLE: Product name, domain, tagline, attribution\nSlide 2 — THE PROBLEM: What pain, who feels it, why unsolved\nSlide 3 — THE SOLUTION: Plain language + THE KEY INSIGHT\nSlide 4 — HOW IT WORKS: 3-4 steps of user experience\nSlide 5 — WHO BUYS IT: Primary + secondary audiences\nSlide 6 — REVENUE MODEL: How it makes money\nSlide 7 — STATUS & PROOF: Current status, validation\nSlide 8 — CLOSING: Name + domain + pitch + contact",
      note: "Prompt-within-a-prompt. DangerStorm generates a prompt that another AI will execute. Each slide is specified with enough structure to prevent the downstream AI from improvising, but enough flexibility to adapt to any product. This is meta-prompting — the hardest and most powerful prompt engineering technique."
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
  let storedConversation = null; // conversation history for phrase highlighting

  // ── Init (idea editor page — logo click) ───────────────────────────────

  function init() {
    const brand = document.querySelector('.header-brand');
    if (!brand) return;
    brand.addEventListener('click', handleLogoClick);
  }

  function triggerPulse(conversation) {
    outputsReady = true;
    storedConversation = conversation || null;
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
    conversation.forEach(function (msg, idx) {
      if (msg.role !== 'user') return;
      var text = typeof msg.content === 'string' ? msg.content : '';
      if (!text) return;
      // Extract meaningful phrases (4+ words, 20+ chars) by splitting on sentence boundaries
      var sentences = text.split(/[.!?\n]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 20; });
      // Also try the full message if short enough
      if (text.length >= 20 && text.length <= 300) {
        phrases.push({ text: text.trim(), source: 'Message ' + (idx + 1), fullMessage: text.trim() });
      }
      sentences.forEach(function (sentence) {
        if (sentence.length >= 20 && sentence !== text.trim()) {
          phrases.push({ text: sentence, source: 'Message ' + (idx + 1), fullMessage: text.trim() });
        }
      });
    });
    return phrases;
  }

  function findMatchingPhrases(promptText, userPhrases) {
    // Find substrings from user input that appear (possibly paraphrased) in the prompt
    // Strategy: look for exact multi-word matches (3+ consecutive words from user input)
    var matches = [];
    var promptLower = promptText.toLowerCase();

    userPhrases.forEach(function (phrase) {
      var words = phrase.text.split(/\s+/);
      // Try progressively shorter word sequences, starting from the full phrase
      for (var len = Math.min(words.length, 12); len >= 3; len--) {
        for (var start = 0; start <= words.length - len; start++) {
          var snippet = words.slice(start, start + len).join(' ');
          if (snippet.length < 12) continue; // skip very short matches
          var idx = promptLower.indexOf(snippet.toLowerCase());
          if (idx !== -1) {
            // Get the actual case from the prompt
            var actual = promptText.substring(idx, idx + snippet.length);
            // Check for overlaps with existing matches
            var overlaps = false;
            for (var m = 0; m < matches.length; m++) {
              if (idx >= matches[m].start && idx < matches[m].end) { overlaps = true; break; }
              if (idx + snippet.length > matches[m].start && idx + snippet.length <= matches[m].end) { overlaps = true; break; }
              if (idx <= matches[m].start && idx + snippet.length >= matches[m].end) { overlaps = true; break; }
            }
            if (!overlaps) {
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

    // Sort by position
    matches.sort(function (a, b) { return a.start - b.start; });
    return matches;
  }

  function highlightPhrases(escapedHtml, sectionText, allMatches) {
    // Find matches that fall within this section's text range in the original prompt
    // We work on the escaped HTML, so we need to account for entity expansion
    // Simpler approach: find matches directly in the escaped text
    var result = escapedHtml;
    var sectionLower = sectionText.toLowerCase();

    // Collect matches relevant to this section
    var sectionMatches = [];
    allMatches.forEach(function (match) {
      var idx = sectionLower.indexOf(match.text.toLowerCase());
      if (idx !== -1) {
        sectionMatches.push({
          text: sectionText.substring(idx, idx + match.text.length),
          source: match.source,
          fullMessage: match.fullMessage
        });
      }
    });

    // Apply highlights (work backwards to preserve indices)
    sectionMatches.reverse().forEach(function (match) {
      var escaped = match.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var escapedMsg = match.fullMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      var idx = result.indexOf(escaped);
      if (idx !== -1) {
        var tooltip = 'From your input (' + match.source + ')';
        var replacement = '<span class="geek-user-phrase" data-tooltip="' + tooltip + '" data-source="' + escapedMsg + '">' + escaped + '</span>';
        result = result.substring(0, idx) + replacement + result.substring(idx + escaped.length);
      }
    });

    return result;
  }

  // ── Core rendering (shared between editor + overlay) ───────────────────

  function renderGeekView(promptText, conversation) {
    var userPhrases = extractUserPhrases(conversation);
    var allMatches = findMatchingPhrases(promptText, userPhrases);

    var legendHtml = allMatches.length > 0
      ? '<div class="geek-legend"><span class="geek-legend-swatch"></span> Highlighted text = phrases from your input (hover to see source)</div>'
      : '';

    var html =
      '<div class="geek-bar">' +
        '<span class="geek-bar-title">&#9889; X-RAY MODE &mdash; Why this prompt works</span>' +
      '</div>' +
      legendHtml +
      '<div class="geek-sections">' + buildAnnotatedView(promptText, allMatches) + '</div>' +
      '<div class="geek-deeper-wrap">' +
        '<a href="#" class="geek-deeper-link" onclick="event.preventDefault();window.__geekMode.showInception(this)">Go deeper &rarr; see the prompt that drives DangerStorm itself</a>' +
      '</div>';
    return html;
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

    const text = contentEl.textContent;
    contentEl.style.display = 'none';

    const geekView = document.createElement('div');
    geekView.id = 'geek-view';
    geekView.innerHTML = renderGeekView(text, storedConversation) +
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

  function launchGeekOverlay(promptText, ideaName, conversation) {
    var overlay = document.getElementById('geek-overlay');
    if (!overlay) return;

    var title = overlay.querySelector('.geek-panel-title');
    if (title) title.textContent = '⚡ X-RAY MODE — ' + (ideaName || 'Prompt Analysis');

    var content = overlay.querySelector('.geek-panel-content');
    if (content) {
      var geekView = document.createElement('div');
      geekView.id = 'geek-view';
      geekView.innerHTML = renderGeekView(promptText, conversation);
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

  function buildAnnotatedView(text, allMatches) {
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

    return sections.map(function (section) {
      const ann = ANNOTATIONS[section.key];
      var escaped = section.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (allMatches && allMatches.length > 0) {
        escaped = highlightPhrases(escaped, section.text, allMatches);
      }
      if (ann) {
        return '<div class="geek-section annotated">' +
          '<pre class="geek-text">' + escaped + '</pre>' +
          '<div class="geek-annotation">' +
            '<span class="geek-ann-label">' + ann.label + '</span>' +
            '<p class="geek-ann-note">' + ann.note + '</p>' +
          '</div>' +
        '</div>';
      }
      return '<div class="geek-section"><pre class="geek-text">' + escaped + '</pre></div>';
    }).join('');
  }

  function showInception(linkEl) {
    if (linkEl) linkEl.parentElement.style.display = 'none';

    const geekView = document.getElementById('geek-view');
    if (!geekView) return;

    const block = document.createElement('div');
    block.className = 'inception-block';
    block.innerHTML =
      '<div class="inception-header">THE PROMPT BEHIND THE PROMPT</div>' +
      '<p class="inception-intro">This entire conversation &mdash; every question DangerStorm asked, every pushback, every insight &mdash; was driven by a system prompt. Here it is, annotated section by section. This is the actual prompt.</p>';

    INCEPTION_SECTIONS.forEach(function (s) {
      const escaped = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      block.innerHTML +=
        '<div class="geek-section annotated inception-section">' +
          '<pre class="geek-text">' + escaped + '</pre>' +
          '<div class="geek-annotation">' +
            '<span class="geek-ann-label">' + s.label + '</span>' +
            '<p class="geek-ann-note">' + s.note + '</p>' +
          '</div>' +
        '</div>';
    });

    block.innerHTML +=
      '<p class="inception-meta">This experience you just had? It was driven by a prompt too. Now you know how to write one.</p>';

    geekView.appendChild(block);
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Exports ────────────────────────────────────────────────────────────

  window.__geekMode = {
    exit: exitGeekMode,
    showInception: showInception,
    launchOverlay: launchGeekOverlay,
    closeOverlay: closeGeekOverlay
  };
  window.triggerGeekPulse = triggerPulse;
  window.resetGeekMode = resetGeekMode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
