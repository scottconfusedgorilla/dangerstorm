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
    const profile = getProfile();
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

        // Show bulk download for Pro/Pioneer
        const dlBtn = document.getElementById("download-all-dashboard-btn");
        if (dlBtn) dlBtn.classList.toggle("hidden", !isPremium);
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

        gridEl.innerHTML = ideas.map((idea) => {
            const versionCount = idea.idea_versions?.[0]?.count || 0;
            const updated = new Date(idea.updated_at).toLocaleString();
            const domain = (idea.domain === "None" || idea.domain.startsWith("none-")) ? "No domain" : idea.domain;
            const name = cleanName(idea.product_name) || "Untitled";
            const summary = idea.tagline || "";

            return `
                <div class="idea-card" data-id="${idea.id}" draggable="true">
                    <div class="idea-card-header">
                        <span class="drag-handle" title="Drag to reorder">⠿</span>
                        <h3 class="idea-name editable" onclick="editField(this, '${idea.id}', 'product_name')" title="Click to edit">${escapeHtml(name)}</h3>
                        <span class="idea-status ${idea.status}">${idea.status}</span>
                    </div>
                    <p class="idea-domain editable" onclick="editField(this, '${idea.id}', 'domain')" title="Click to edit">${escapeHtml(domain)}</p>
                    ${summary ? `<p class="idea-summary">${escapeHtml(summary)}</p>` : ""}
                    <div class="idea-meta">
                        <span>${versionCount} version${versionCount !== 1 ? "s" : ""}</span>
                        <span>Updated ${updated}</span>
                    </div>
                    <div class="idea-actions">
                        <button class="action-btn" onclick="openIdea('${idea.id}')">Open</button>
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

function openIdea(ideaId) {
    const user = getUser();
    if (!user) return;
    window.location.href = `/${user.id}/${ideaId}`;
}

async function confirmTrash(ideaId, name) {
    if (!await dsConfirm(`Move "${name}" to trash?`, "Trash it")) return;

    // Animate the card crumpling and flying to the trash can
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
        const rect = card.getBoundingClientRect();
        const trashBtn = document.getElementById("trash-toggle-btn");
        const trashRect = trashBtn.getBoundingClientRect();
        const trashX = trashRect.left + trashRect.width / 2;
        const trashY = trashRect.top + trashRect.height / 2;
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        // Create a flying clone
        const clone = card.cloneNode(true);
        clone.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            margin: 0;
            z-index: 9999;
            pointer-events: none;
            transition: all 0.6s cubic-bezier(0.5, 0, 0.7, 1);
            transform-origin: center center;
        `;
        document.body.appendChild(clone);

        // Hide the original
        card.style.opacity = "0";
        card.style.height = card.offsetHeight + "px";
        card.style.transition = "height 0.4s ease 0.2s, margin 0.4s ease 0.2s, padding 0.4s ease 0.2s";

        // Trigger the animation on next frame
        requestAnimationFrame(() => {
            const dx = trashX - startX;
            const dy = trashY - startY;
            clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.05) rotate(720deg)`;
            clone.style.opacity = "0";
            clone.style.borderRadius = "50%";

            // Collapse the original's space
            card.style.height = "0px";
            card.style.margin = "0";
            card.style.padding = "0";
            card.style.overflow = "hidden";

            // Briefly flash the trash can
            setTimeout(() => {
                trashBtn.style.transition = "transform 0.15s ease";
                trashBtn.style.transform = "scale(1.2)";
                setTimeout(() => {
                    trashBtn.style.transform = "";
                }, 150);
            }, 500);
        });

        setTimeout(() => {
            clone.remove();
            resolve();
        }, 700);
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
    return escapeHtml(text).replace(/'/g, "&#39;");
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

// Drag and drop sorting
let draggedCard = null;

function clearDropIndicators(grid) {
    grid.querySelectorAll(".idea-card").forEach((c) => c.classList.remove("drag-over-top", "drag-over-bottom"));
}

function initDragAndDrop(grid) {
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

// Boot
initSupabase();
