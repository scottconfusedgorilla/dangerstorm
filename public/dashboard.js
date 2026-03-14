// ============================================
// DangerStorm — Dashboard
// ============================================

async function onAuthChange(user, profile) {
    if (!user) {
        // Redirect to home if not logged in
        window.location.href = "/";
        return;
    }
    await loadDashboard();
}

async function loadDashboard() {
    const profile = await fetchProfile() || getProfile();
    const countEl = document.getElementById("idea-count");
    const loadingEl = document.getElementById("ideas-loading");
    const emptyEl = document.getElementById("ideas-empty");
    const gridEl = document.getElementById("ideas-grid");

    // Reset state
    loadingEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");
    gridEl.innerHTML = "";

    if (profile) {
        const isPremium = profile.tier === "pro" || profile.tier === "pioneer";
        const max = isPremium ? 99 : 19;
        countEl.textContent = `${profile.idea_count} of ${max} used`;

        // Show pro features for Pro/Pioneer
        const dlBtn = document.getElementById("download-all-dashboard-btn");
        if (dlBtn) dlBtn.classList.toggle("hidden", !isPremium);
        const portBtn = document.getElementById("portfolio-btn");
        if (portBtn) portBtn.classList.toggle("hidden", !isPremium);
    }

    // Clear search
    const searchEl = document.getElementById("idea-search");
    if (searchEl) searchEl.value = "";

    try {
        const ideas = await getIdeas();

        loadingEl.classList.add("hidden");

        if (ideas.length === 0) {
            emptyEl.classList.remove("hidden");
            return;
        }

        const filesUrl = profile?.files_url || "";

        gridEl.innerHTML = ideas.map((idea) => {
            const versionCount = idea.idea_versions?.[0]?.count || 0;
            const updated = new Date(idea.updated_at).toLocaleString();
            const rawDomain = (idea.domain === "None" || idea.domain.startsWith("none-")) ? "" : idea.domain;
            const domain = rawDomain || "No domain";
            const name = cleanName(idea.product_name) || "Untitled";
            const summary = idea.tagline || "";
            const parent = idea.parent;
            const branchedFrom = parent ? `<p class="idea-branch-from">Branched from <a href="javascript:openIdea('${parent.id}')">${escapeHtml(cleanName(parent.product_name) || "Untitled")}</a></p>` : "";
            const folderName = rawDomain || "No Domain";
            const folderHref = filesUrl
                ? `${escapeHtml(filesUrl.replace(/\/+$/, ""))}/${encodeURIComponent(folderName)}`
                : "/account";
            const folderTarget = filesUrl ? ' target="_blank" rel="noopener"' : '';
            const folderTitle = filesUrl ? "Open files folder" : "Set up your Junk Drawer folder";
            const folderIcon = `<svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 2.5V11.5C1.5 12.05 1.95 12.5 2.5 12.5H13.5C14.05 12.5 14.5 12.05 14.5 11.5V4.5C14.5 3.95 14.05 3.5 13.5 3.5H8L6.5 1.5H2.5C1.95 1.5 1.5 1.95 1.5 2.5Z"/></svg>`;
            const filesLink = `<a href="${folderHref}"${folderTarget} class="idea-files-link" title="${folderTitle}">${folderIcon}</a>`;

            return `
                <div class="idea-card" data-id="${idea.id}" draggable="true">
                    <div class="idea-card-header">
                        <span class="drag-handle" title="Drag to reorder">⠿</span>
                        <span class="nudge-arrows">
                            <button class="nudge-btn" onclick="nudgeIdea('${idea.id}', -1)" title="Move up">▲</button>
                            <button class="nudge-btn" onclick="nudgeIdea('${idea.id}', 1)" title="Move down">▼</button>
                        </span>
                        <h3 class="idea-name editable" onclick="editField(this, '${idea.id}', 'product_name')" title="Click to edit">${escapeHtml(name)}</h3>
                        <span class="idea-status ${idea.status}">${idea.status}</span>
                    </div>
                    <div class="idea-domain-row">
                        <p class="idea-domain editable" onclick="editField(this, '${idea.id}', 'domain')" title="Click to edit">${escapeHtml(domain)}</p>
                        ${filesLink}
                    </div>
                    ${branchedFrom}
                    ${summary ? `<p class="idea-summary">${escapeHtml(summary)}</p>` : ""}
                    <div class="idea-meta">
                        <span>${versionCount} version${versionCount !== 1 ? "s" : ""}</span>
                        <span>Updated ${updated}</span>
                    </div>
                    <div class="idea-actions">
                        <button class="action-btn" onclick="openIdea('${idea.id}')">Open</button>
                        <button class="action-btn" onclick="doBranch('${idea.id}', '${escapeAttr(name)}')">Branch</button>
                        <button class="action-btn danger" onclick="confirmTrash('${idea.id}', '${escapeAttr(name)}')">Delete</button>
                    </div>
                </div>
            `;
        }).join("");

        initDragAndDrop(gridEl);
    } catch (err) {
        loadingEl.textContent = "Failed to load ideas: " + err.message;
    }
}

async function doBranch(ideaId, name) {
    if (!await dsConfirm(`Branch "${name}" into a new idea?`, "Branch it")) return;

    try {
        const result = await branchIdea(ideaId);
        // Open the new branched idea
        openIdea(result.ideaId);
    } catch (err) {
        dsAlert("Failed to branch: " + err.message);
    }
}

function openIdea(ideaId) {
    const user = getUser();
    if (!user) return;
    window.location.href = `/${user.id}/${ideaId}`;
}

async function confirmTrash(ideaId, name) {
    const card = document.querySelector(`.idea-card[data-id="${ideaId}"]`);
    if (card) await animateTrash(card);

    try {
        await trashIdea(ideaId);
        await loadDashboard();
    } catch (err) {
        dsAlert("Failed to trash: " + err.message);
    }
}

function animateTrash(card) {
    return new Promise((resolve) => {
        const h = card.offsetHeight;
        card.style.height = h + "px";
        card.style.transition = "transform 0.4s ease-in, opacity 0.4s ease-in";
        card.style.overflow = "hidden";

        // Slide down toward the trash button
        requestAnimationFrame(() => {
            card.style.transform = "translateY(60px) scale(0.95)";
            card.style.opacity = "0";

            // Light up the trash button
            const trashBtn = document.getElementById("trash-toggle-btn");
            if (trashBtn) {
                trashBtn.classList.add("flash");
                setTimeout(() => trashBtn.classList.remove("flash"), 1500);
            }

            // Collapse the space
            setTimeout(() => {
                card.style.transition = "height 0.3s ease, margin 0.3s ease, padding 0.3s ease";
                card.style.height = "0px";
                card.style.margin = "0";
                card.style.padding = "0";
            }, 350);
        });

        setTimeout(() => resolve(), 700);
    });
}

async function confirmRestore(ideaId, name) {
    try {
        const result = await restoreIdea(ideaId);
        if (result && result.conflict) {
            const choice = await dsConfirm(
                `The domain "${result.domain}" is now used by "${result.existingName}".\n\nRestore anyway? The domain will be renamed to "${result.domain}-restored".`,
                "Restore anyway"
            );
            if (!choice) return;
            await restoreIdea(ideaId, true);
        }
        await loadTrash();
    } catch (err) {
        dsAlert("Failed to restore: " + err.message);
    }
}

async function confirmPermanentDelete(ideaId, name) {
    if (!await dsConfirm(`Permanently delete "${name}"? This cannot be undone.`, "Delete forever")) return;

    try {
        await deleteIdeaPermanently(ideaId);
        await loadTrash();
    } catch (err) {
        dsAlert("Failed to delete: " + err.message);
    }
}

let showingTrash = false;

function toggleTrash() {
    showingTrash = !showingTrash;
    const btn = document.getElementById("trash-toggle-btn");
    btn.classList.toggle("active", showingTrash);
    const label = btn.querySelector(".trash-label");
    if (showingTrash) {
        if (label) label.textContent = "Back to Ideas";
        loadTrash();
    } else {
        if (label) label.textContent = "Crappy Ideas";
        loadDashboard();
    }
}

async function loadTrash() {
    const loadingEl = document.getElementById("ideas-loading");
    const emptyEl = document.getElementById("ideas-empty");
    const gridEl = document.getElementById("ideas-grid");

    loadingEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");
    gridEl.innerHTML = "";

    try {
        const ideas = await getTrashedIdeas();
        loadingEl.classList.add("hidden");

        if (ideas.length === 0) {
            emptyEl.classList.remove("hidden");
            emptyEl.innerHTML = "<p>Trash is empty.</p>";
            return;
        }

        gridEl.innerHTML = ideas.map((idea) => {
            const updated = new Date(idea.updated_at).toLocaleString();
            const domain = (idea.domain === "None" || idea.domain.startsWith("none-")) ? "No domain" : idea.domain;

            return `
                <div class="idea-card trashed">
                    <div class="idea-card-header">
                        <h3 class="idea-name">${escapeHtml(idea.product_name || "Untitled")}</h3>
                        <span class="idea-status trash">trash</span>
                    </div>
                    <p class="idea-domain">${escapeHtml(domain)}</p>
                    <div class="idea-meta">
                        <span>Deleted ${updated}</span>
                    </div>
                    <div class="idea-actions">
                        <button class="action-btn" onclick="confirmRestore('${idea.id}', '${escapeAttr(idea.product_name || "this idea")}')">Restore</button>
                        <button class="action-btn danger" onclick="confirmPermanentDelete('${idea.id}', '${escapeAttr(idea.product_name || "this idea")}')">Delete Forever</button>
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        loadingEl.textContent = "Failed to load trash: " + err.message;
    }
}

function cleanName(text) {
    return (text || "").replace(/\*+/g, "").trim();
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

// Search / filter
function filterIdeas(query) {
    const q = query.toLowerCase().trim();
    const cards = document.querySelectorAll("#ideas-grid .idea-card");
    cards.forEach((card) => {
        if (!q) {
            card.classList.remove("hidden");
            return;
        }
        const name = (card.querySelector(".idea-name")?.textContent || "").toLowerCase();
        const domain = (card.querySelector(".idea-domain")?.textContent || "").toLowerCase();
        const summary = (card.querySelector(".idea-summary")?.textContent || "").toLowerCase();
        const match = name.includes(q) || domain.includes(q) || summary.includes(q);
        card.classList.toggle("hidden", !match);
    });
}

// Inline editing
function editField(el, ideaId, field) {
    if (el.querySelector("input")) return; // already editing

    const current = el.textContent.trim();
    const isNoData = current === "No domain" || current === "Untitled";
    const input = document.createElement("input");
    input.type = "text";
    input.value = isNoData ? "" : current;
    input.className = "inline-edit";
    input.placeholder = field === "domain" ? "example.com" : "Idea name";

    // Disable drag on the card while editing
    const card = el.closest(".idea-card");
    if (card) card.setAttribute("draggable", "false");

    el.textContent = "";
    el.appendChild(input);
    input.focus();
    input.select();

    // Prevent drag events from stealing focus
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("dragstart", (e) => e.preventDefault());

    async function save() {
        const val = input.value.trim();
        if (val && val !== current) {
            try {
                await updateIdeaField(ideaId, field, val);
            } catch (err) {
                console.warn("Failed to update:", err.message);
            }
        }
        el.textContent = val || current;
        if (card) card.setAttribute("draggable", "true");
    }

    input.addEventListener("blur", save);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
        if (e.key === "Escape") { input.value = current; input.blur(); }
    });
}

// Nudge (click to reorder)
async function nudgeIdea(ideaId, direction) {
    const grid = document.getElementById("ideas-grid");
    const card = grid.querySelector(`.idea-card[data-id="${ideaId}"]`);
    if (!card) return;

    const sibling = direction === -1 ? card.previousElementSibling : card.nextElementSibling;
    if (!sibling || !sibling.classList.contains("idea-card")) return;

    // Animate the swap
    const cardRect = card.getBoundingClientRect();
    const sibRect = sibling.getBoundingClientRect();
    const dy = sibRect.top - cardRect.top;

    card.style.transition = "transform 0.2s ease";
    sibling.style.transition = "transform 0.2s ease";
    card.style.transform = `translateY(${dy}px)`;
    sibling.style.transform = `translateY(${-dy}px)`;

    await new Promise(r => setTimeout(r, 200));

    card.style.transition = "";
    card.style.transform = "";
    sibling.style.transition = "";
    sibling.style.transform = "";

    // Move in DOM and scroll to keep card under cursor
    const oldTop = card.getBoundingClientRect().top;

    if (direction === -1) {
        grid.insertBefore(card, sibling);
    } else {
        grid.insertBefore(sibling, card);
    }

    const newTop = card.getBoundingClientRect().top;
    const scrollEl = document.getElementById("app");
    scrollEl.scrollTop += (newTop - oldTop);

    saveOrder(grid);
}

// Drag and drop sorting
let draggedCard = null;

function clearDropIndicators(grid) {
    grid.querySelectorAll(".idea-card").forEach((c) => c.classList.remove("drag-over-top", "drag-over-bottom"));
}

function initDragAndDrop(grid) {
    // Allow dropping anywhere in the grid (gaps between cards)
    grid.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    });

    const cards = grid.querySelectorAll(".idea-card");

    cards.forEach((card) => {
        card.addEventListener("dragstart", (e) => {
            draggedCard = card;
            card.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });

        card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            draggedCard = null;
            clearDropIndicators(grid);
            saveOrder(grid);
        });

        card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (card === draggedCard) return;

            clearDropIndicators(grid);
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                card.classList.add("drag-over-top");
            } else {
                card.classList.add("drag-over-bottom");
            }
        });

        card.addEventListener("dragleave", () => {
            card.classList.remove("drag-over-top", "drag-over-bottom");
        });

        card.addEventListener("drop", (e) => {
            e.preventDefault();
            clearDropIndicators(grid);
            if (card === draggedCard) return;

            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                grid.insertBefore(draggedCard, card);
            } else {
                grid.insertBefore(draggedCard, card.nextSibling);
            }
        });
    });
}

async function saveOrder(grid) {
    const cards = grid.querySelectorAll(".idea-card");
    const updates = [];
    cards.forEach((card, i) => {
        updates.push(updateIdeaOrder(card.dataset.id, i));
    });
    try {
        await Promise.all(updates);
    } catch (err) {
        console.warn("Failed to save order:", err.message);
    }
}

// Bulk download (Pro + Pioneer)
async function downloadAllIdeas() {
    const btn = document.getElementById("download-all-dashboard-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Exporting..."; }

    try {
        const ideas = await getIdeas();
        if (!ideas.length) {
            dsAlert("No ideas to download.");
            return;
        }

        const zip = new JSZip();
        const csvRows = [["Name", "Domain", "Tagline", "Status", "Created", "Updated"]];
        const jsonExport = [];

        for (const idea of ideas) {
            const name = cleanName(idea.product_name) || "Untitled";
            const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
            const domain = (idea.domain === "None" || idea.domain?.startsWith("none-")) ? "" : idea.domain;

            // Get latest version outputs
            let outputs = {};
            try {
                const versions = await getIdeaVersions(idea.id);
                if (versions.length) outputs = versions[0].outputs || {};
            } catch (e) { /* skip */ }

            // Add text files per idea
            const folder = zip.folder(safeName);
            if (outputs.output1) folder.file("pitch-deck.txt", outputs.output1);
            if (outputs.output2) folder.file("carrd-copy.txt", outputs.output2);
            if (outputs.output3) folder.file("kit-copy.txt", outputs.output3);
            if (outputs.output6) folder.file("build-prompt.txt", outputs.output6);

            // CSV row
            csvRows.push([
                name,
                domain,
                idea.tagline || "",
                idea.status,
                idea.created_at,
                idea.updated_at,
            ]);

            // JSON entry
            jsonExport.push({
                id: idea.id,
                name,
                domain,
                tagline: idea.tagline || "",
                status: idea.status,
                created_at: idea.created_at,
                updated_at: idea.updated_at,
                outputs,
            });
        }

        // Add CSV
        const csvContent = csvRows.map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ).join("\n");
        zip.file("ideas-export.csv", csvContent);

        // Add JSON
        zip.file("ideas-export.json", JSON.stringify(jsonExport, null, 2));

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dangerstorm-ideas.zip";
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        dsAlert("Download failed: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Download All"; }
    }
}

// Portfolio prompt generation
async function generatePortfolio() {
    const btn = document.getElementById("portfolio-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }

    try {
        const ideas = await getIdeas();
        const complete = ideas.filter(i => i.status === "complete");

        if (!complete.length) {
            dsAlert("No completed ideas to build a portfolio from.");
            return;
        }

        // Gather details for each idea
        const entries = [];
        for (const idea of complete) {
            const name = cleanName(idea.product_name) || "Untitled";
            const domain = (idea.domain === "None" || idea.domain?.startsWith("none-")) ? "" : idea.domain;
            const tagline = idea.tagline || "";

            let outputs = {};
            try {
                const versions = await getIdeaVersions(idea.id);
                if (versions.length) outputs = versions[0].outputs || {};
            } catch (e) { /* skip */ }

            entries.push({ name, domain, tagline, outputs });
        }

        const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const ideaSlides = entries.map((e, i) => {
            const domainLine = e.domain ? `   - Domain: ${e.domain}` : "";
            const taglineLine = e.tagline ? `   - Tagline: "${e.tagline}"` : "";
            // Pull the problem/solution from the deck prompt if available
            const deckPrompt = e.outputs.output1 || "";
            return `
### Slide ${i + 2}: ${e.name}
   - Product name: ${e.name}${domainLine}${taglineLine}
   - Use the following generated deck prompt for context on the problem, solution, audience, and revenue model:
${deckPrompt ? "   ```\n   " + deckPrompt.substring(0, 1500).replace(/\n/g, "\n   ") + "\n   ```" : "   (No deck prompt available — use the tagline and product name to infer.)"}`;
        }).join("\n");

        const prompt = `Create a professional product portfolio presentation in PowerPoint (16:9 format).

This is a portfolio of ${entries.length} product ideas from DangerStorm.net — a product idea studio by Scott Welch / Atomic Maple.

## Design Direction
- Bold, dark theme: #0F172A background, white text, #F97316 (electric orange) accents
- Clean typography: Trebuchet MS or Georgia for headers, Calibri for body
- Every slide should be designed, not just typed — use icon concepts, visual elements, stat callouts
- Dark title and closing slides, slightly lighter content slides

## Slide Structure

### Slide 1: TITLE
   - "Product Portfolio"
   - "Scott Welch | atomicmaple.vc | ${today}"
   - Subtitle: "${entries.length} Ideas. ${entries.length} Domains. ${entries.length} Decks."
${ideaSlides}

### Slide ${entries.length + 2}: CLOSING
   - "DangerStorm.net"
   - "One idea. One domain. One deck."
   - "Scott Welch | atomicmaple.vc"

## Per-Idea Slide Format
Each product slide should include:
- Product name (large) and domain
- One-line tagline
- 2-3 bullet summary of the problem it solves and the key insight
- Target audience
- Revenue model (one line)
- A visual element: icon concept, color accent bar, or category badge

Keep each idea to ONE slide. This is a portfolio overview, not a deep dive. Think investor summary, not pitch deck.`;

        document.getElementById("portfolio-output").textContent = prompt;
        document.getElementById("portfolio-overlay").classList.remove("hidden");
    } catch (err) {
        dsAlert("Failed to generate portfolio: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Portfolio"; }
    }
}

function copyPortfolio() {
    const text = document.getElementById("portfolio-output").textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector(".portfolio-panel .copy-btn");
        if (btn) { btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy", 1500); }
    });
}

function closePortfolio() {
    document.getElementById("portfolio-overlay").classList.add("hidden");
}

// Close portfolio on overlay click
document.getElementById("portfolio-overlay")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("portfolio-overlay")) closePortfolio();
});

// Boot
initSupabase();
