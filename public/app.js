const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const filePreview = document.getElementById("file-preview");
const filePreviewName = document.getElementById("file-preview-name");
const fileRemoveBtn = document.getElementById("file-remove-btn");
const outputsContainer = document.getElementById("outputs-container");
const refineBtn = document.getElementById("refine-btn");
const startOverBtn = document.getElementById("start-over-btn");

const SESSION_KEY = "dangerstorm_session";
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

let conversationHistory = [];
let isWaiting = false;
let pendingFile = null; // { name, type, data } — data is base64 for images, text for text files
let userHasScrolled = false;
let sessionIP = null; // fetched once on load for message stamps

// Detect manual scroll: pause auto-scroll when user scrolls up
window.addEventListener("scroll", () => {
    const distFromBottom = document.body.scrollHeight - window.innerHeight - window.scrollY;
    userHasScrolled = distFromBottom > 150;
});

function autoScroll() {
    if (!userHasScrolled) {
        window.scrollTo(0, document.body.scrollHeight);
    }
}

function saveSession() {
    // Don't save file attachments to localStorage (too large for images)
    const saveable = conversationHistory.map((msg) => {
        if (typeof msg.content === "string") return msg;
        // For multi-part messages, save a text-only summary
        const textParts = msg.content
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n");
        const hasImage = msg.content.some((p) => p.type === "image");
        const summary = hasImage ? "[attached image]\n" + textParts : textParts;
        return { role: msg.role, content: summary };
    });
    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ ts: Date.now(), history: saveable })
    );
}

function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (Date.now() - session.ts > SESSION_TTL) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session.history;
    } catch {
        return null;
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// File handling
attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? 20 * 1024 * 1024 : 1 * 1024 * 1024; // 20MB images, 1MB text

    if (file.size > maxSize) {
        alert(`File too large. Max ${isImage ? "20MB" : "1MB"}.`);
        fileInput.value = "";
        return;
    }

    if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
            pendingFile = {
                name: file.name,
                type: file.type,
                data: reader.result.split(",")[1], // base64 without prefix
            };
            showFilePreview(file.name);
        };
        reader.readAsDataURL(file);
    } else {
        const text = await file.text();
        pendingFile = {
            name: file.name,
            type: "text",
            data: text,
        };
        showFilePreview(file.name);
    }
});

fileRemoveBtn.addEventListener("click", clearPendingFile);

function showFilePreview(name) {
    filePreviewName.textContent = name;
    filePreview.classList.remove("hidden");
    attachBtn.classList.add("has-file");
}

function clearPendingFile() {
    pendingFile = null;
    fileInput.value = "";
    filePreview.classList.add("hidden");
    attachBtn.classList.remove("has-file");
}

// Auto-resize textarea
inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
});

// Send on Enter (Shift+Enter for newline)
inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener("click", sendMessage);

// Copy buttons
document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const content = document.getElementById(targetId).textContent;
        navigator.clipboard.writeText(content).then(() => {
            btn.textContent = "Copied!";
            btn.classList.add("copied");
            setTimeout(() => {
                btn.textContent = "Copy";
                btn.classList.remove("copied");
            }, 2000);
        });
    });
});

// Refine button
refineBtn.addEventListener("click", () => {
    outputsContainer.classList.add("hidden");
    inputEl.placeholder = "Tell me what to change...";
    inputEl.focus();
});

// Start over (shared logic)
function doStartOver() {
    conversationHistory = [];
    clearSession();
    clearPendingFile();
    messagesEl.innerHTML = "";
    outputsContainer.classList.add("hidden");
    inputEl.placeholder = "Type your answer...";
    inputEl.focus();
    initConversation();
}

// Start over button (outputs section)
startOverBtn.addEventListener("click", doStartOver);

// Start over button (chat section)
document.getElementById("chat-start-over-btn").addEventListener("click", doStartOver);

// Download all button
document.getElementById("download-all-btn").addEventListener("click", async () => {
    const zip = new JSZip();

    const output1 = document.getElementById("output-1-content").textContent;
    const output2 = document.getElementById("output-2-content").textContent;
    const output3 = document.getElementById("output-3-content").textContent;
    const output6 = document.getElementById("output-6-content").textContent;

    if (output1) zip.file("01-pitch-deck-prompt.txt", output1);
    if (output2) zip.file("02-carrd-landing-page-copy.txt", output2);
    if (output3) zip.file("03-kit-signup-form-copy.txt", output3);
    if (output6) zip.file("04-claude-code-build-prompt.md", output6);

    // Include conversation history
    if (conversationHistory.length > 0) {
        let transcript = "";
        for (const msg of conversationHistory) {
            const role = msg.role === "user" ? "YOU" : "DANGERSTORM";
            const text = typeof msg.content === "string"
                ? msg.content
                : msg.content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
            // Skip output markers in transcript
            const clean = text.replace(/===OUTPUT_\d_START===[\s\S]*?===OUTPUT_\d_END===/g, "").trim();
            if (clean) transcript += `${role}:\n${clean}\n\n`;
        }
        zip.file("00-conversation.txt", transcript.trim());
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dangerstorm-outputs.zip";
    a.click();
    URL.revokeObjectURL(url);
});

function addMessageStamp() {
    const stamp = document.createElement("div");
    stamp.className = "message-stamp";
    const now = new Date().toLocaleString();
    stamp.textContent = sessionIP
        ? `Your IP: ${sessionIP} — ${now}`
        : now;
    messagesEl.appendChild(stamp);
}

function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    if (role === "user") addMessageStamp();
    autoScroll();
    return div;
}

function addMessageWithAttachment(role, text, fileName) {
    const div = document.createElement("div");
    div.className = `message ${role}`;

    const badge = document.createElement("div");
    badge.className = "file-badge";
    badge.textContent = fileName;
    div.appendChild(badge);

    const textNode = document.createElement("span");
    textNode.textContent = text;
    div.appendChild(textNode);

    messagesEl.appendChild(div);
    if (role === "user") addMessageStamp();
    autoScroll();
    return div;
}

function addTypingIndicator() {
    const div = document.createElement("div");
    div.className = "message typing";
    div.id = "typing-indicator";
    div.innerHTML = '<span class="typing-dots">Thinking</span>';
    messagesEl.appendChild(div);
    autoScroll();
    return div;
}

function removeTypingIndicator() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
}

function parseOutputs(text) {
    const output1Match = text.match(
        /===OUTPUT_1_START===([\s\S]*?)===OUTPUT_1_END===/
    );
    const output2Match = text.match(
        /===OUTPUT_2_START===([\s\S]*?)===OUTPUT_2_END===/
    );
    const output3Match = text.match(
        /===OUTPUT_3_START===([\s\S]*?)===OUTPUT_3_END===/
    );
    const output5Match = text.match(
        /===OUTPUT_5_START===([\s\S]*?)===OUTPUT_5_END===/
    );
    const output6Match = text.match(
        /===OUTPUT_6_START===([\s\S]*?)===OUTPUT_6_END===/
    );

    if (output1Match) {
        return {
            hasOutputs: true,
            output1: output1Match[1].trim(),
            output2: output2Match ? output2Match[1].trim() : "",
            output3: output3Match ? output3Match[1].trim() : "",
            output5: output5Match ? output5Match[1].trim() : "",
            output6: output6Match ? output6Match[1].trim() : "",
            conversationText: text
                .replace(/===OUTPUT_\d_START===[\s\S]*?===OUTPUT_\d_END===/g, "")
                .trim(),
        };
    }

    return { hasOutputs: false };
}

function openInClaude() {
    const prompt = document.getElementById("output-1-content").textContent;
    if (!prompt) return;
    window.open("https://claude.ai/new?q=" + encodeURIComponent(prompt), "_blank");
}

function copyMarketResearch() {
    const deckPrompt = document.getElementById("output-1-content").textContent;
    if (!deckPrompt) return;
    const researchPrompt = `Based on the following product pitch deck prompt, conduct a thorough market research and business viability analysis. Cover:\n\n1. **Market Size** — TAM, SAM, SOM estimates with reasoning\n2. **Competitive Landscape** — Who are the closest competitors? What's the moat?\n3. **Revenue Projections** — Year 1-3 estimates based on the pricing model described\n4. **Key Risks** — What could kill this? Technical, market, regulatory risks\n5. **Go-to-Market Strategy** — How should this launch? First 90 days playbook\n6. **Verdict** — Is this worth building? Score it 1-10 and explain why.\n\nBe specific, use real comparable companies and data where possible. Be honest — if the idea has fatal flaws, say so.\n\n---\n\nHere is the pitch deck prompt:\n\n${deckPrompt}`;
    navigator.clipboard.writeText(researchPrompt).then(() => {
        const btn = document.querySelector(".research-btn");
        const orig = btn.textContent;
        btn.textContent = "\u2713";
        setTimeout(() => { btn.textContent = orig; }, 1500);
    });
}

function openDomainSearch() {
    const prompt = document.getElementById("output-1-content").textContent;
    // Extract domain from deck prompt text
    const match = prompt.match(/(?:domain[:\s]+|at\s+)([a-z0-9-]+\.[a-z]{2,})/i)
        || prompt.match(/([a-z0-9-]+\.(?:com|net|org|io|co|ai|app|dev|xyz))/i);
    const domain = match ? match[1] : "";
    window.open("https://www.godaddy.com/en-ca/domainsearch/find?domainToCheck=" + encodeURIComponent(domain), "_blank");
}

function showOutputs(output1, output2, output3, output5, output6) {
    document.getElementById("output-1-content").textContent = output1;
    document.getElementById("output-2-content").textContent = output2 || "";
    document.getElementById("output-3-content").textContent = output3 || "";
    document.getElementById("output-6-content").textContent = output6 || "";
    currentSummary = output5 || "";

    const extrasBlocks = document.querySelectorAll("#output-2, #output-3, #output-6");
    extrasBlocks.forEach((el) => {
        const content = el.querySelector(".output-content");
        el.classList.toggle("hidden", !content || !content.textContent);
    });

    outputsContainer.classList.remove("hidden");
    outputsContainer.scrollIntoView({ behavior: "smooth" });
}

async function sendMessage() {
    const text = inputEl.value.trim();
    if ((!text && !pendingFile) || isWaiting) return;

    userHasScrolled = false; // resume auto-scroll for new response
    const displayText = text || `[Attached: ${pendingFile.name}]`;
    const attachedFile = pendingFile;

    // Build the message content for the API
    let messageContent;
    if (attachedFile) {
        if (attachedFile.type === "text") {
            // Text file: include content inline
            const fileContext = `[Attached file: ${attachedFile.name}]\n\`\`\`\n${attachedFile.data}\n\`\`\``;
            messageContent = text
                ? `${text}\n\n${fileContext}`
                : fileContext;
        } else {
            // Image: use multipart content
            const parts = [];
            parts.push({
                type: "image",
                source: {
                    type: "base64",
                    media_type: attachedFile.type,
                    data: attachedFile.data,
                },
            });
            parts.push({ type: "text", text: text || `See attached image: ${attachedFile.name}` });
            messageContent = parts;
        }

        addMessageWithAttachment("user", text || "", attachedFile.name);
        clearPendingFile();
    } else {
        messageContent = text;
        addMessage("user", text);
    }

    conversationHistory.push({ role: "user", content: messageContent });

    inputEl.value = "";
    inputEl.style.height = "auto";
    isWaiting = true;
    sendBtn.disabled = true;

    addTypingIndicator();

    try {
        const response = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: conversationHistory, userEmail: getUser()?.email || "" }),
        });

        removeTypingIndicator();

        const msgDiv = addMessage("assistant", "");
        let fullText = "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.text) {
                            fullText += data.text;
                            // Show text without output markers during streaming
                            const displayText = fullText
                                .replace(/===OUTPUT_\d_(?:START|END)===/g, "")
                                .trim();
                            msgDiv.textContent = displayText;
                            autoScroll();
                        }
                        if (data.done) {
                            console.log("Stream complete:", data);
                        }
                        if (data.error) {
                            console.error("Stream error:", data.error);
                            msgDiv.textContent = "Something went wrong. Try again.";
                        }
                    } catch (e) {
                        // skip malformed JSON
                    }
                }
            }
        }

        conversationHistory.push({ role: "assistant", content: fullText });
        saveSession();

        // Check if outputs were generated
        const parsed = parseOutputs(fullText);
        if (parsed.hasOutputs) {
            // Update message to show only conversational text
            msgDiv.textContent = parsed.conversationText || "Here are your outputs:";
            showOutputs(parsed.output1, parsed.output2, parsed.output3, parsed.output5, parsed.output6);
        }
    } catch (err) {
        removeTypingIndicator();
        addMessage("assistant", "Connection error. Make sure the server is running.");
    }

    isWaiting = false;
    sendBtn.disabled = false;
    inputEl.focus();
}

function initConversation() {
    const opener =
        "Alright, hit me. What's the product? Give me the elevator pitch in one or two sentences, and what's the domain?";
    addMessage("assistant", opener);
    conversationHistory.push({ role: "assistant", content: opener });
    inputEl.focus();
}

function restoreSession() {
    const saved = loadSession();
    if (!saved || saved.length === 0) {
        initConversation();
        return;
    }

    conversationHistory = saved;

    // Replay messages into the UI
    for (const msg of saved) {
        const text =
            typeof msg.content === "string"
                ? msg.content
                : msg.content
                      .filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("\n");

        const parsed = parseOutputs(text);
        if (msg.role === "assistant" && parsed.hasOutputs) {
            const displayText = parsed.conversationText || "Here are your outputs:";
            addMessage("assistant", displayText);
            showOutputs(parsed.output1, parsed.output2, parsed.output3, parsed.output5, parsed.output6);
        } else if (msg.role === "user" && text.startsWith("[attached image]")) {
            addMessageWithAttachment("user", text.replace("[attached image]\n", ""), "image attachment");
        } else {
            addMessage(msg.role, text);
        }
    }

    inputEl.focus();
}

// ---- Save Idea ----
let currentIdeaId = null;
let currentVersionNumber = null;
let currentSummary = ""; // one-sentence summary from OUTPUT_5

document.getElementById("save-idea-btn").addEventListener("click", async () => {
    if (!requireAuth("save")) return;

    const limit = checkIdeaLimit();
    if (!limit.allowed) {
        if (limit.reason === "limit_reached") {
            showSaveStatus(`You've hit the ${limit.max}-idea limit. Upgrade to Pro for more.`, "error");
        }
        return;
    }

    const btn = document.getElementById("save-idea-btn");
    const outputs = {
        output1: document.getElementById("output-1-content").textContent,
        output2: document.getElementById("output-2-content").textContent,
        output3: document.getElementById("output-3-content").textContent,
        output6: document.getElementById("output-6-content").textContent,
    };

    // Try to extract domain and product name from the deck prompt
    const deckText = outputs.output1;
    const domainMatch = deckText.match(/domain[:\s]+([a-z0-9.-]+\.[a-z]{2,})/i);
    const domain = domainMatch ? domainMatch[1] : "None";
    const nameMatch = deckText.match(/product\s*name[:\s]+([^\n]+)/i);
    const productName = nameMatch ? nameMatch[1].trim().replace(/\*+/g, "") : "Untitled Idea";
    const tagline = currentSummary || "";

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        const result = await saveIdea(domain, productName, tagline, conversationHistory, outputs);

        // Handle domain conflict
        if (result.conflict) {
            const action = confirm(
                `"${result.existingName}" already uses ${result.domain}.\n\nClick OK to save as a new version of that idea, or Cancel to open it instead.`
            );
            if (action) {
                // Force save as new version
                const forced = await saveIdea(domain, productName, "", conversationHistory, outputs, true);
                currentIdeaId = forced.ideaId;
                currentVersionNumber = forced.versionNumber;
                updateIdeaUrl(getUser().id, forced.ideaId);
                showSaveStatus("Saved as new version!", "success");
                currentProfile = await fetchProfile();
            } else {
                // Open existing idea via URL
                window.location.href = `/${getUser().id}/${result.existingId}`;
            }
            btn.disabled = false;
            btn.textContent = "Save Idea";
            return;
        }

        currentIdeaId = result.ideaId;
        currentVersionNumber = result.versionNumber;
        updateIdeaUrl(getUser().id, result.ideaId);
        showSaveStatus("Idea saved! Find it in your Dashboard.", "success");
        // Refresh profile to get updated idea_count
        currentProfile = await fetchProfile();
    } catch (err) {
        showSaveStatus("Failed to save: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Idea";
    }
});

function showSaveStatus(message, type) {
    const el = document.getElementById("save-status");
    el.textContent = message;
    el.className = `save-status ${type}`;
    setTimeout(() => el.classList.add("hidden"), 5000);
}

function updateIdeaUrl(userId, ideaId) {
    history.replaceState(null, "", `/${userId}/${ideaId}`);
}

// ---- Load saved idea from URL ----
async function loadSavedIdea(ideaId) {
    try {
        const idea = await getIdea(ideaId);
        const versions = await getIdeaVersions(ideaId);
        if (!versions.length) {
            initConversation();
            return;
        }

        const latest = versions[0]; // already sorted desc by version_number
        currentIdeaId = ideaId;
        currentVersionNumber = latest.version_number;

        // Restore conversation from saved version
        if (latest.conversation && latest.conversation.length > 0) {
            conversationHistory = latest.conversation;
            for (const msg of conversationHistory) {
                const text = typeof msg.content === "string"
                    ? msg.content
                    : msg.content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
                const parsed = parseOutputs(text);
                if (msg.role === "assistant" && parsed.hasOutputs) {
                    addMessage("assistant", parsed.conversationText || "Here are your outputs:");
                    showOutputs(parsed.output1, parsed.output2, parsed.output3, parsed.output5, parsed.output6);
                } else if (msg.role === "user" && text.startsWith("[attached image]")) {
                    addMessageWithAttachment("user", text.replace("[attached image]\n", ""), "image attachment");
                } else {
                    addMessage(msg.role, text.replace(/===OUTPUT_\d_(?:START|END)===/g, "").trim());
                }
            }
        } else {
            initConversation();
        }

        // Restore outputs if saved separately
        if (latest.outputs) {
            const o = latest.outputs;
            if (o.output1) showOutputs(o.output1, o.output2 || "", o.output3 || "", o.output5 || "", o.output6 || "");
        }

        inputEl.placeholder = "Tell me what to change...";
    } catch (err) {
        console.error("Failed to load idea:", err);
        initConversation();
    }
}

// ---- Auth callback ----
function onAuthChange(user, profile) {
    // Could refresh UI elements based on auth state
}

// Fetch IP once for message stamps
fetch("/api/session-info")
    .then((r) => r.json())
    .then((info) => { sessionIP = info.ip || null; })
    .catch(() => {});

// Boot
try { initSupabase(); } catch (e) { console.error("Supabase init error:", e); }

// Parse URL to determine boot mode
const urlParams = new URLSearchParams(window.location.search);
const pathParts = window.location.pathname.split("/").filter(Boolean);

if (urlParams.get("new") === "1") {
    // Dashboard "New Idea" — start fresh
    clearSession();
    history.replaceState(null, "", "/");
    initConversation();
} else if (pathParts.length === 2) {
    // URL like /{userId}/{ideaId} — load saved idea
    clearSession();
    loadSavedIdea(pathParts[1]);
} else {
    restoreSession();
}
