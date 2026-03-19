// geek.js — X-Ray Mode Easter Egg
// Activated by clicking the DangerStorm logo after outputs are generated

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
      note: "'Make it look good' produces generic slides. Specific color palette, typography names, and the sandwich structure (dark/light/dark) forces a designed result. 'No bullet points on white backgrounds' directly counters Claude's default behavior."
    }
  };

  const INCEPTION_SECTIONS = [
    {
      text: "You are DangerStorm — a sharp product strategist who interviews founders and generates pitch deck prompts.",
      note: "Role definition. Giving Claude a persona ('you are a sharp product strategist') produces sharper outputs than asking it to 'help with a pitch.' Identity shapes behavior."
    },
    {
      text: "Ask only one question at a time. Be aggressive about extracting and remembering information from previous answers. If the answer is already clear, skip the question entirely.",
      note: "Behavioral constraint. Without this rule, AI asks everything at once — efficient for the AI, terrible for the human. Single-question discipline is the hardest thing to make an AI do consistently."
    },
    {
      text: "Push back when ideas are vague: \"That's too broad. What's the ONE thing it does best?\"",
      note: "The pushback rule. This is what makes DangerStorm feel like a product person, not a form. Most AI assistants validate everything — this one challenges."
    },
    {
      text: "After 3–5 exchanges, generate three outputs: a pitch deck prompt, Carrd landing page copy, and a Kit signup form.",
      note: "Exit condition. Without a clear 'when to stop asking and start generating,' AI interrogates you forever. This sets the upper bound and forces a bias toward output."
    }
  ];

  let geekModeActive = false;
  let outputsReady = false;

  function init() {
    const brand = document.querySelector('.header-brand');
    if (!brand) return;
    brand.addEventListener('click', handleLogoClick);
  }

  function triggerPulse() {
    outputsReady = true;
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
    geekView.innerHTML =
      '<div class="geek-bar">' +
        '<span class="geek-bar-title">&#9889; X-RAY MODE &mdash; Why this prompt works</span>' +
        '<button class="geek-close-btn" onclick="window.__geekMode.exit()">Exit X-ray</button>' +
      '</div>' +
      '<div class="geek-sections">' + buildAnnotatedView(text) + '</div>' +
      '<div class="geek-deeper-wrap">' +
        '<a href="#" class="geek-deeper-link" onclick="event.preventDefault();window.__geekMode.showInception(this)">Go deeper &rarr; see the prompt that drives DangerStorm itself</a>' +
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

  function buildAnnotatedView(text) {
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
      const escaped = section.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      '<p class="inception-intro">This entire conversation &mdash; every question DangerStorm asked, every pushback, every insight &mdash; was generated by following a prompt. Here are the key rules that drove it.</p>';

    INCEPTION_SECTIONS.forEach(function (s) {
      const escaped = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      block.innerHTML +=
        '<div class="geek-section annotated inception-section">' +
          '<pre class="geek-text">' + escaped + '</pre>' +
          '<div class="geek-annotation">' +
            '<p class="geek-ann-note">' + s.note + '</p>' +
          '</div>' +
        '</div>';
    });

    block.innerHTML +=
      '<p class="inception-meta">You just built one yourself.</p>';

    geekView.appendChild(block);
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.__geekMode = { exit: exitGeekMode, showInception: showInception };
  window.triggerGeekPulse = triggerPulse;
  window.resetGeekMode = resetGeekMode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
