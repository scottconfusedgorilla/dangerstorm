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
        const max = profile.tier === "pro" ? 999 : 99;
        countEl.textContent = `${profile.idea_count} of ${max} ideas used`;
    }

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
                        <button class="action-btn danger" onclick="confirmTrash('${idea.id}', '${escapeHtml(name)}')">Delete</button>
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

    try {
        await trashIdea(ideaId);
        await loadDashboard();
    } catch (err) {
        dsAlert("Failed to trash: " + err.message);
    }
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
                        <button class="action-btn" onclick="confirmRestore('${idea.id}', '${escapeHtml(idea.product_name || "this idea")}')">Restore</button>
                        <button class="action-btn danger" onclick="confirmPermanentDelete('${idea.id}', '${escapeHtml(idea.product_name || "this idea")}')">Delete Forever</button>
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

// Boot
initSupabase();
