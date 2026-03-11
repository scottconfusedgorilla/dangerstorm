// ============================================
// DangerStorm — Account Page
// ============================================

async function onAuthChange(user, profile) {
    if (!user) {
        window.location.href = "/";
        return;
    }
    renderAccount(user, profile);
}

function renderAccount(user, profile) {
    document.getElementById("account-name").textContent = profile?.display_name || "User";
    document.getElementById("account-email").textContent = user.email;

    const tierSection = document.getElementById("account-tier-section");

    const tier = profile?.tier || "free";
    const ideaCount = profile?.idea_count || 0;
    const isPremium = tier === "pro" || tier === "pioneer";
    const max = isPremium ? 99 : 19;

    if (tier === "pro") {
        tierSection.innerHTML = `
            <div class="tier-display pro">
                <span class="tier-badge pro">PRO</span>
                <span>$9/month &mdash; ${ideaCount} of ${max} ideas used</span>
            </div>
            <button id="manage-billing-btn" class="action-btn">Manage Billing</button>
        `;
        document.getElementById("manage-billing-btn").addEventListener("click", async () => {
            try {
                const url = await createPortalSession();
                window.location.href = url;
            } catch (err) {
                showMessage("Failed to open billing portal: " + err.message, "error");
            }
        });
    } else if (tier === "pioneer") {
        tierSection.innerHTML = `
            <div class="tier-display pioneer">
                <span class="tier-badge pioneer">PIONEER</span>
                <span>Free forever &mdash; ${ideaCount} of ${max} ideas used</span>
            </div>
            <p class="text-muted" style="margin-top:8px;">You're an early adopter. Enjoy Pro-level access for life.</p>
            <div class="coming-soon-card">
                <h3>Pro &mdash; $ Coming</h3>
                <p class="text-muted">Pro subscriptions are on the way. As a Pioneer, you'll keep full access free forever&mdash;no action needed.</p>
            </div>
        `;
    } else {
        tierSection.innerHTML = `
            <div class="tier-display free">
                <span class="tier-badge free">FREE</span>
                <span>${ideaCount} of ${max} ideas used</span>
            </div>
            <div class="upgrade-card">
                <h3>Upgrade to Pro</h3>
                <p class="text-muted">$9/month &mdash; save up to 99 product ideas with full version history and bulk download.</p>
                <button id="upgrade-btn" class="action-btn primary">Upgrade to Pro &mdash; $9/mo</button>
            </div>
        `;
        document.getElementById("upgrade-btn").addEventListener("click", async () => {
            const btn = document.getElementById("upgrade-btn");
            btn.disabled = true;
            btn.textContent = "Redirecting...";
            try {
                const url = await createCheckoutSession();
                window.location.href = url;
            } catch (err) {
                showMessage("Failed to start checkout: " + err.message, "error");
                btn.disabled = false;
                btn.textContent = "Upgrade to Pro — $9/mo";
            }
        });
    }

    // Files URL (Junk Drawer)
    const filesInput = document.getElementById("files-url-input");
    filesInput.value = profile?.files_url || "";
    document.getElementById("files-url-save").addEventListener("click", async () => {
        const val = filesInput.value.trim();
        try {
            const sb = getSupabase();
            await sb.from("profiles").update({ files_url: val || null }).eq("id", user.id);
            showMessage("Junk Drawer link saved!", "success");
        } catch (err) {
            showMessage("Failed to save: " + err.message, "error");
        }
    });

    // Check for success/cancel URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
        showMessage("Welcome to Pro! Your account has been upgraded.", "success");
        window.history.replaceState({}, "", "/account");
    } else if (params.get("canceled") === "1") {
        showMessage("Checkout canceled. No changes made.", "error");
        window.history.replaceState({}, "", "/account");
    }
}

document.getElementById("sign-out-account-btn").addEventListener("click", async () => {
    await signOut();
    window.location.href = "/";
});

function showMessage(text, type) {
    const el = document.getElementById("account-message");
    el.textContent = text;
    el.className = `save-status ${type}`;
    setTimeout(() => el.classList.add("hidden"), 5000);
}

// Boot
initSupabase();
