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
    const output4 = document.getElementById("output-4-content").textContent;
    const output5 = document.getElementById("output-5-content").textContent;
    const output6 = document.getElementById("output-6-content").textContent;

    if (output1) zip.file("01-pitch-deck-prompt.txt", output1);
    if (output2) zip.file("02-carrd-landing-page-copy.txt", output2);
    if (output3) zip.file("03-kit-signup-form-copy.txt", output3);
    if (output4) zip.file("04-landing-page-mockup.html", output4);
    if (output5) zip.file("05-signup-form-mockup.html", output5);
    if (output6) zip.file("06-claude-code-build-prompt.md", output6);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dangerstorm-outputs.zip";
    a.click();
    URL.revokeObjectURL(url);
});

// Generate PPT button
document.getElementById("generate-ppt-btn").addEventListener("click", async () => {
    const btn = document.getElementById("generate-ppt-btn");
    const status = document.getElementById("ppt-status");
    const deckPrompt = document.getElementById("output-1-content").textContent;

    if (!deckPrompt) return;

    btn.disabled = true;
    btn.textContent = "Generating...";
    btn.classList.add("generating");
    status.textContent = "Sending deck prompt to AI for structured slide data...";
    status.className = "ppt-status";

    try {
        const response = await fetch("/api/generate-ppt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deckPrompt }),
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        status.textContent = "Building PowerPoint file...";
        buildPptx(data);

        status.textContent = "PPT downloaded!";
        setTimeout(() => status.classList.add("hidden"), 3000);
    } catch (err) {
        status.textContent = "Failed to generate PPT: " + err.message;
        status.className = "ppt-status error";
    } finally {
        btn.disabled = false;
        btn.textContent = "Generate PPT";
        btn.classList.remove("generating");
    }
});

function buildPptx(data) {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "DangerStorm";
    pptx.title = data.title || "Pitch Deck";

    const p = data.palette || {};
    const darkBg = p.dark || "#1a1a2e";
    const primaryColor = p.primary || "#e94560";
    const lightBg = p.light || "#f5f5f5";
    const textLight = p.text_light || "#ffffff";
    const textDark = p.text_dark || "#1a1a2e";

    for (const slide of data.slides) {
        const s = pptx.addSlide();

        if (slide.type === "title" || slide.type === "closing") {
            // Dark background slides
            s.background = { color: darkBg };

            s.addText(slide.title || "", {
                x: 0.5, y: 1.5, w: "90%", h: 1.5,
                fontSize: 44, fontFace: "Trebuchet MS",
                color: primaryColor, bold: true, align: "center",
            });

            s.addText(slide.subtitle || "", {
                x: 0.5, y: 3.2, w: "90%", h: 0.8,
                fontSize: 22, fontFace: "Calibri",
                color: textLight, align: "center",
            });

            if (slide.footer) {
                s.addText(slide.footer, {
                    x: 0.5, y: 4.8, w: "90%", h: 0.5,
                    fontSize: 14, fontFace: "Calibri",
                    color: textLight, align: "center", italic: true,
                });
            }
        } else if (slide.type === "steps") {
            // Steps/How it works slide
            s.background = { color: lightBg };

            s.addText(slide.heading || "", {
                x: 0.5, y: 0.3, w: "90%", h: 0.8,
                fontSize: 32, fontFace: "Trebuchet MS",
                color: darkBg, bold: true,
            });

            const steps = slide.steps || [];
            const stepWidth = 11 / Math.max(steps.length, 1);
            steps.forEach((step, i) => {
                const xPos = 0.5 + i * stepWidth;

                s.addText(step.icon || String(i + 1), {
                    x: xPos, y: 1.4, w: stepWidth - 0.3, h: 0.8,
                    fontSize: 28, fontFace: "Trebuchet MS",
                    color: primaryColor, bold: true,
                });

                s.addText(step.title || "", {
                    x: xPos, y: 2.2, w: stepWidth - 0.3, h: 0.6,
                    fontSize: 18, fontFace: "Calibri",
                    color: darkBg, bold: true,
                });

                s.addText(step.description || "", {
                    x: xPos, y: 2.8, w: stepWidth - 0.3, h: 1.2,
                    fontSize: 14, fontFace: "Calibri",
                    color: textDark,
                });
            });
        } else {
            // Content slides
            s.background = { color: lightBg };

            s.addText(slide.heading || "", {
                x: 0.5, y: 0.3, w: "90%", h: 0.8,
                fontSize: 32, fontFace: "Trebuchet MS",
                color: darkBg, bold: true,
            });

            const bullets = slide.bullets || [];
            const bulletText = bullets.map((b) => ({
                text: b,
                options: { bullet: { code: "25CF", color: primaryColor }, indentLevel: 0 },
            }));

            s.addText(bulletText, {
                x: 0.5, y: 1.3, w: "55%", h: 3.5,
                fontSize: 18, fontFace: "Calibri",
                color: textDark, lineSpacingMultiple: 1.5,
                valign: "top",
            });

            if (slide.callout) {
                s.addShape(pptx.ShapeType.roundRect, {
                    x: 7.5, y: 1.5, w: 4.5, h: 2.5,
                    fill: { color: darkBg }, rectRadius: 0.2,
                });

                s.addText(slide.callout, {
                    x: 7.7, y: 1.7, w: 4.1, h: 2.1,
                    fontSize: 18, fontFace: "Calibri",
                    color: primaryColor, bold: true,
                    align: "center", valign: "middle",
                });
            }
        }

        // Branding on every slide
        const isDark = slide.type === "title" || slide.type === "closing";
        s.addText("Manage your pitch ideas at dangerstorm.net", {
            x: 6.5, y: 5.1, w: 6, h: 0.3,
            fontSize: 8, fontFace: "Calibri",
            color: isDark ? textLight : textDark,
            align: "right", italic: true,
            transparency: 50,
        });
    }

    const fileName = (data.title || "pitch-deck").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    pptx.writeFile({ fileName: `${fileName}-pitch-deck.pptx` });
}

function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    window.scrollTo(0, document.body.scrollHeight);
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
    window.scrollTo(0, document.body.scrollHeight);
    return div;
}

function addTypingIndicator() {
    const div = document.createElement("div");
    div.className = "message typing";
    div.id = "typing-indicator";
    div.innerHTML = '<span class="typing-dots">Thinking</span>';
    messagesEl.appendChild(div);
    window.scrollTo(0, document.body.scrollHeight);
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
    const output4Match = text.match(
        /===OUTPUT_4_START===([\s\S]*?)===OUTPUT_4_END===/
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
            output4: output4Match ? output4Match[1].trim() : "",
            output5: output5Match ? output5Match[1].trim() : "",
            output6: output6Match ? output6Match[1].trim() : "",
            conversationText: text
                .replace(/===OUTPUT_\d_START===[\s\S]*?===OUTPUT_\d_END===/g, "")
                .trim(),
        };
    }

    return { hasOutputs: false };
}

function renderMockup(iframeId, html) {
    const iframe = document.getElementById(iframeId);
    if (!iframe || !html) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    // Auto-resize iframe to content height after load
    iframe.onload = () => {
        try {
            const height = doc.documentElement.scrollHeight;
            iframe.style.height = Math.min(Math.max(height, 300), 1200) + "px";
        } catch (e) {
            // fallback height already set in CSS
        }
    };
    // Trigger resize for inline content
    setTimeout(() => {
        try {
            const height = doc.documentElement.scrollHeight;
            iframe.style.height = Math.min(Math.max(height, 300), 1200) + "px";
        } catch (e) {}
    }, 100);
}

function showOutputs(output1, output2, output3, output4, output5, output6) {
    document.getElementById("output-1-content").textContent = output1;
    document.getElementById("output-2-content").textContent = output2;
    document.getElementById("output-3-content").textContent = output3;
    document.getElementById("output-6-content").textContent = output6 || "";

    if (output4) {
        document.getElementById("output-4-content").textContent = output4;
        renderMockup("output-4-preview", output4);
    }
    if (output5) {
        document.getElementById("output-5-content").textContent = output5;
        renderMockup("output-5-preview", output5);
    }

    outputsContainer.classList.remove("hidden");
    outputsContainer.scrollIntoView({ behavior: "smooth" });
}

async function sendMessage() {
    const text = inputEl.value.trim();
    if ((!text && !pendingFile) || isWaiting) return;

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
            body: JSON.stringify({ messages: conversationHistory }),
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
                            window.scrollTo(0, document.body.scrollHeight);
                        }
                        if (data.error) {
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
            showOutputs(parsed.output1, parsed.output2, parsed.output3, parsed.output4, parsed.output5, parsed.output6);
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
            showOutputs(parsed.output1, parsed.output2, parsed.output3, parsed.output4, parsed.output5, parsed.output6);
        } else {
            addMessage(msg.role, text);
        }
    }

    inputEl.focus();
}

// ---- Save Idea ----
let currentIdeaId = null;
let currentVersionNumber = null;

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
        output4: document.getElementById("output-4-content").textContent,
        output5: document.getElementById("output-5-content").textContent,
        output6: document.getElementById("output-6-content").textContent,
    };

    // Try to extract domain and product name from the deck prompt
    const deckText = outputs.output1;
    const domainMatch = deckText.match(/domain[:\s]+([a-z0-9.-]+\.[a-z]{2,})/i);
    const domain = domainMatch ? domainMatch[1] : "None";
    const nameMatch = deckText.match(/product\s*name[:\s]+([^\n]+)/i);
    const productName = nameMatch ? nameMatch[1].trim() : "Untitled Idea";

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        const result = await saveIdea(domain, productName, "", conversationHistory, outputs);
        currentIdeaId = result.ideaId;
        currentVersionNumber = result.versionNumber;
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

// ---- Auth callback ----
function onAuthChange(user, profile) {
    // Could refresh UI elements based on auth state
}

// Boot
try { initSupabase(); } catch (e) { console.error("Supabase init error:", e); }
restoreSession();
