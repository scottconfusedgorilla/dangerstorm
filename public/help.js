/* ============================================================
   DangerStorm Help System
   - Guided tour (first visit)
   - Help chatbot (floating ? button + slide-out panel)
   ============================================================ */

(function () {
  "use strict";

  // ── Guided Tour ──────────────────────────────────────────

  const TOUR_STEPS = [
    {
      target: "#user-input",
      title: "Start here",
      text: "Type your product idea and domain name. DangerStorm will ask you a few quick questions to understand your vision.",
      position: "top",
    },
    {
      target: "#messages",
      title: "The conversation",
      text: "DangerStorm asks one question at a time — like talking to a sharp product strategist, not filling out a form. Usually 3–5 exchanges.",
      position: "bottom",
    },
    {
      target: "#chat-actions",
      title: "Save & start over",
      text: "Save your work anytime, or start a fresh idea. Sign in to keep your ideas on your dashboard.",
      position: "top",
    },
    {
      target: "#attach-btn",
      title: "Attach files",
      text: "Drop in a competitor screenshot, product sketch, or any reference material to give DangerStorm more context.",
      position: "top",
    },
    {
      target: "#help-fab",
      title: "Need help?",
      text: "Click this anytime to chat with the help assistant. It knows everything about DangerStorm.",
      position: "left",
    },
  ];

  let tourOverlay = null;
  let tourStep = 0;

  function createTourOverlay() {
    // Backdrop
    const overlay = document.createElement("div");
    overlay.id = "tour-overlay";
    overlay.innerHTML = `
      <div id="tour-spotlight"></div>
      <div id="tour-tooltip">
        <div id="tour-title"></div>
        <div id="tour-text"></div>
        <div id="tour-nav">
          <span id="tour-progress"></span>
          <div id="tour-buttons">
            <button id="tour-skip">Skip tour</button>
            <button id="tour-next">Next</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    tourOverlay = overlay;

    document.getElementById("tour-skip").addEventListener("click", endTour);
    document.getElementById("tour-next").addEventListener("click", nextTourStep);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) nextTourStep();
    });
  }

  function showTourStep(index) {
    if (index >= TOUR_STEPS.length) {
      endTour();
      return;
    }
    tourStep = index;
    const step = TOUR_STEPS[index];
    const target = document.querySelector(step.target);
    if (!target) {
      // Skip missing targets
      showTourStep(index + 1);
      return;
    }

    const rect = target.getBoundingClientRect();
    const pad = 8;
    const spotlight = document.getElementById("tour-spotlight");
    spotlight.style.top = (rect.top - pad + window.scrollY) + "px";
    spotlight.style.left = (rect.left - pad) + "px";
    spotlight.style.width = (rect.width + pad * 2) + "px";
    spotlight.style.height = (rect.height + pad * 2) + "px";

    document.getElementById("tour-title").textContent = step.title;
    document.getElementById("tour-text").textContent = step.text;
    document.getElementById("tour-progress").textContent =
      `${index + 1} of ${TOUR_STEPS.length}`;

    const nextBtn = document.getElementById("tour-next");
    nextBtn.textContent = index === TOUR_STEPS.length - 1 ? "Got it!" : "Next";

    // Position tooltip
    const tooltip = document.getElementById("tour-tooltip");
    tooltip.style.top = "";
    tooltip.style.bottom = "";
    tooltip.style.left = "";
    tooltip.style.right = "";

    // Reset for measurement
    tooltip.style.visibility = "hidden";
    tooltip.style.display = "block";
    const ttRect = tooltip.getBoundingClientRect();
    tooltip.style.visibility = "";

    if (step.position === "top") {
      tooltip.style.top = Math.max(8, rect.top - ttRect.height - 16 + window.scrollY) + "px";
      tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - ttRect.width - 8)) + "px";
    } else if (step.position === "bottom") {
      tooltip.style.top = (rect.bottom + 16 + window.scrollY) + "px";
      tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - ttRect.width - 8)) + "px";
    } else if (step.position === "left") {
      tooltip.style.top = (rect.top + window.scrollY) + "px";
      tooltip.style.right = (window.innerWidth - rect.left + 16) + "px";
    }
  }

  function nextTourStep() {
    showTourStep(tourStep + 1);
  }

  function endTour() {
    if (tourOverlay) {
      tourOverlay.remove();
      tourOverlay = null;
    }
    localStorage.setItem("ds_tour_done", "1");
  }

  function startTour() {
    tourStep = 0;
    createTourOverlay();
    showTourStep(0);
  }

  // ── Help Chatbot ─────────────────────────────────────────

  let helpHistory = [];
  let helpWaiting = false;

  function createHelpUI() {
    // Floating action button
    const fab = document.createElement("button");
    fab.id = "help-fab";
    fab.title = "Help";
    fab.innerHTML = "?";
    fab.addEventListener("click", toggleHelpPanel);
    document.body.appendChild(fab);

    // Slide-out panel
    const panel = document.createElement("div");
    panel.id = "help-panel";
    panel.classList.add("help-closed");
    panel.innerHTML = `
      <div id="help-header">
        <span>DangerStorm Help</span>
        <div id="help-header-actions">
          <button id="help-tour-btn" title="Show tour again">Tour</button>
          <button id="help-close-btn" title="Close">&times;</button>
        </div>
      </div>
      <div id="help-messages">
        <div class="help-msg help-assistant">Hi! I'm the DangerStorm help assistant. Ask me anything about how to use DangerStorm, tips for great product pitches, or what the outputs mean.</div>
      </div>
      <div id="help-input-area">
        <textarea id="help-input" placeholder="Ask a question..." rows="1"></textarea>
        <button id="help-send-btn" title="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("help-close-btn").addEventListener("click", toggleHelpPanel);
    document.getElementById("help-tour-btn").addEventListener("click", function () {
      toggleHelpPanel();
      startTour();
    });
    document.getElementById("help-send-btn").addEventListener("click", sendHelpMessage);
    document.getElementById("help-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendHelpMessage();
      }
    });

    // Auto-resize textarea
    const helpInput = document.getElementById("help-input");
    helpInput.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 100) + "px";
    });
  }

  function toggleHelpPanel() {
    const panel = document.getElementById("help-panel");
    const fab = document.getElementById("help-fab");
    panel.classList.toggle("help-closed");
    if (!panel.classList.contains("help-closed")) {
      fab.classList.add("help-fab-hidden");
      document.getElementById("help-input").focus();
    } else {
      fab.classList.remove("help-fab-hidden");
    }
  }

  function addHelpMessage(role, text) {
    const container = document.getElementById("help-messages");
    const div = document.createElement("div");
    div.className = `help-msg help-${role}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  async function sendHelpMessage() {
    if (helpWaiting) return;
    const input = document.getElementById("help-input");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";
    addHelpMessage("user", text);
    helpHistory.push({ role: "user", content: text });

    helpWaiting = true;
    const msgDiv = addHelpMessage("assistant", "");
    msgDiv.classList.add("help-typing");
    msgDiv.textContent = "Thinking...";

    try {
      const token =
        typeof getAccessToken === "function" ? await getAccessToken() : null;
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch("/api/chat/stream", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: helpHistory,
          mode: "help",
        }),
      });

      if (!resp.ok) {
        msgDiv.textContent = "Sorry, something went wrong. Try again!";
        msgDiv.classList.remove("help-typing");
        helpWaiting = false;
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      msgDiv.textContent = "";
      msgDiv.classList.remove("help-typing");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              msgDiv.textContent = fullText;
              document.getElementById("help-messages").scrollTop =
                document.getElementById("help-messages").scrollHeight;
            }
            if (data.done) break;
          } catch (e) {
            // ignore parse errors
          }
        }
      }

      if (fullText) {
        helpHistory.push({ role: "assistant", content: fullText });
      }
    } catch (e) {
      msgDiv.textContent = "Connection error. Please try again.";
      msgDiv.classList.remove("help-typing");
    }
    helpWaiting = false;
  }

  // ── Init ─────────────────────────────────────────────────

  function init() {
    createHelpUI();

    // Show tour on first visit (with a slight delay so the page renders)
    // Skip tour if loading a saved idea (URL has /{userId}/{ideaId})
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const isLoadingSavedIdea = pathParts.length >= 2 && pathParts[0].length > 10;
    if (!localStorage.getItem("ds_tour_done") && !isLoadingSavedIdea) {
      setTimeout(startTour, 800);
    }
  }

  // Expose for footer link
  window.startDangerStormTour = startTour;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
