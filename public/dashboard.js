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
                <div class="idea-card" data-id="${idea.id}">
                    <div class="idea-card-header">
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
    } catch (err) {
        loadingEl.textContent = "Failed to load ideas: " + err.message;
    }
}

function openIdea(ideaId) {
    // Store the idea ID and redirect to chat page
    localStorage.setItem("dangerstorm_open_idea", ideaId);
    window.location.href = "/";
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

// Boot
initSupabase();
