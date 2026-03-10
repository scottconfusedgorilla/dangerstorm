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

    if (profile) {
        const max = profile.tier === "pro" ? 999 : 5;
        countEl.textContent = `${profile.idea_count} of ${max} ideas used`;
        if (profile.tier === "free" && profile.idea_count >= 3) {
            countEl.innerHTML += ' &mdash; <a href="/account" class="upgrade-link">Upgrade to Pro</a>';
        }
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
            const updated = new Date(idea.updated_at).toLocaleDateString();
            const domain = idea.domain === "None" ? "No domain" : idea.domain;

            return `
                <div class="idea-card" data-id="${idea.id}" draggable="true">
                    <div class="idea-card-header">
                        <span class="drag-handle" title="Drag to reorder">⠿</span>
                        <h3 class="idea-name">${escapeHtml(idea.product_name || "Untitled")}</h3>
                        <span class="idea-status ${idea.status}">${idea.status}</span>
                    </div>
                    <p class="idea-domain">${escapeHtml(domain)}</p>
                    <div class="idea-meta">
                        <span>${versionCount} version${versionCount !== 1 ? "s" : ""}</span>
                        <span>Updated ${updated}</span>
                    </div>
                    <div class="idea-actions">
                        <button class="action-btn" onclick="openIdea('${idea.id}')">Open</button>
                        <button class="action-btn danger" onclick="confirmDelete('${idea.id}', '${escapeHtml(idea.product_name || "this idea")}')">Delete</button>
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

async function confirmDelete(ideaId, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
        await deleteIdea(ideaId);
        await loadDashboard();
    } catch (err) {
        alert("Failed to delete: " + err.message);
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Drag and drop sorting
let draggedCard = null;

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
            // Remove all drop indicators
            grid.querySelectorAll(".idea-card").forEach((c) => c.classList.remove("drag-over"));
            // Persist new order
            saveOrder(grid);
        });

        card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (card !== draggedCard) {
                card.classList.add("drag-over");
            }
        });

        card.addEventListener("dragleave", () => {
            card.classList.remove("drag-over");
        });

        card.addEventListener("drop", (e) => {
            e.preventDefault();
            card.classList.remove("drag-over");
            if (card === draggedCard) return;

            // Determine position: insert before or after based on mouse position
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
