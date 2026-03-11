// ============================================
// DangerStorm — Supabase Auth
// ============================================

// Register service worker for PWA
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
}

const SUPABASE_URL = "https://detfoqtvhrmbizzdzenb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldGZvcXR2aHJtYml6emR6ZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjc4MzksImV4cCI6MjA4ODY0MzgzOX0.Yfcr3PabrD2HtoH2B7Tzl6O9mONmAaG-Ww7rK9WZHRE";

let sbClient = null;
let currentUser = null;
let currentProfile = null;

function initSupabase() {
    try {
        if (!window.supabase || SUPABASE_URL === "REPLACE_ME") {
            console.warn("Supabase not configured — auth disabled");
            updateAuthUI();
            return;
        }
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        sbClient.auth.onAuthStateChange((event, session) => {
            // IMPORTANT: Do NOT await inside this callback.
            // Supabase SDK v2.98 uses navigator.locks internally;
            // an async callback can deadlock signInWithPassword.
            if (session?.user) {
                currentUser = session.user;
                // Fetch profile in background — don't block the callback
                fetchProfile().then((profile) => {
                    currentProfile = profile;
                    updateAuthUI();
                    if (typeof onAuthChange === "function") {
                        onAuthChange(currentUser, currentProfile);
                    }
                });
                // Update UI immediately with user info (before profile loads)
                updateAuthUI();
            } else {
                currentUser = null;
                currentProfile = null;
                updateAuthUI();
                if (typeof onAuthChange === "function") {
                    onAuthChange(currentUser, currentProfile);
                }
            }
        });

        // Show sign-in button immediately (don't wait for auth state event)
        updateAuthUI();
    } catch (err) {
        console.error("Supabase init failed:", err);
        updateAuthUI();
    }
}

async function fetchProfile() {
    if (!currentUser) return null;
    const { data, error } = await sbClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
    if (error) {
        console.error("Failed to fetch profile:", error);
        return null;
    }
    return data;
}

function getUser() {
    return currentUser;
}

function getProfile() {
    return currentProfile;
}

function getSupabase() {
    return sbClient;
}

async function getAccessToken() {
    const { data } = await sbClient.auth.getSession();
    return data?.session?.access_token || null;
}

async function signInWithGoogle() {
    const { error } = await sbClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
    });
    if (error) console.error("Google sign-in error:", error);
}

async function signInWithPassword(email, password) {
    console.log("[auth] signInWithPassword called, sbClient:", !!sbClient);
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sign-in timed out after 15 seconds. Supabase may be unreachable.")), 15000)
    );
    try {
        const result = await Promise.race([
            sbClient.auth.signInWithPassword({ email, password }),
            timeoutPromise,
        ]);
        console.log("[auth] signInWithPassword result:", result);
        if (result.error) {
            console.error("[auth] sign-in error:", result.error);
            return { error: result.error };
        }
        return { error: null };
    } catch (err) {
        console.error("[auth] signInWithPassword threw:", err);
        return { error: { message: err.message } };
    }
}

async function signUpWithPassword(email, password) {
    console.log("[auth] signUpWithPassword called, sbClient:", !!sbClient);
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sign-up timed out after 15 seconds. Supabase may be unreachable.")), 15000)
    );
    try {
        const result = await Promise.race([
            sbClient.auth.signUp({ email, password }),
            timeoutPromise,
        ]);
        console.log("[auth] signUpWithPassword result:", result);
        if (result.error) {
            console.error("[auth] sign-up error:", result.error);
            return { error: result.error };
        }
        return { error: null };
    } catch (err) {
        console.error("[auth] signUpWithPassword threw:", err);
        return { error: { message: err.message } };
    }
}

async function signOut() {
    await sbClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateAuthUI();
}

// ---- Auth UI ----

function updateAuthUI() {
    const authBar = document.getElementById("auth-bar");
    if (!authBar) return;

    if (currentUser) {
        const email = currentUser.email;
        const tier = currentProfile?.tier || "free";
        const tierLabel = { pro: "Pro", pioneer: "Pioneer", free: "Free" }[tier] || "Free";
        authBar.innerHTML = `
            <div class="auth-user">
                <a href="/dashboard" class="auth-dashboard-btn" title="Dashboard">
                    <svg class="header-bolt" width="12" height="16" viewBox="0 0 24 40" fill="currentColor"><polygon points="14,0 6,18 14,18 4,40 22,16 13,16 20,0"/></svg>
                    Dashboard
                </a>
                <a href="/account" class="auth-identity" title="Account">${email} · ${tierLabel}</a>
                <div class="auth-kebab-wrap">
                    <button class="auth-kebab-btn" title="More">⋮</button>
                    <div class="auth-kebab-menu hidden">
                        <a href="/account" class="auth-kebab-item">Account</a>
                        <a href="mailto:codewrangler@dangerstorm.net" class="auth-kebab-item">Feedback</a>
                        <button id="sign-out-btn" class="auth-kebab-item">Sign out</button>
                        <span class="auth-kebab-item build-label">build 061</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById("sign-out-btn").addEventListener("click", signOut);
        const buildStandalone = document.getElementById("build-number-standalone");
        if (buildStandalone) buildStandalone.classList.add("hidden");
        const kebabBtn = authBar.querySelector(".auth-kebab-btn");
        const kebabMenu = authBar.querySelector(".auth-kebab-menu");
        kebabBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            kebabMenu.classList.toggle("hidden");
        });
        // Close menu on any outside click
        if (window._kebabClose) document.removeEventListener("click", window._kebabClose);
        window._kebabClose = () => kebabMenu.classList.add("hidden");
        document.addEventListener("click", window._kebabClose);
    } else {
        authBar.innerHTML = `
            <button id="sign-in-btn" class="auth-link-btn">Sign in</button>
        `;
        document.getElementById("sign-in-btn").addEventListener("click", showAuthModal);
    }
}

function showAuthModal() {
    // Remove existing modal if present
    const existing = document.getElementById("auth-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close">&times;</button>
            <h2 id="auth-title">Sign in to DangerStorm</h2>
            <p class="modal-subtitle">Save ideas, download files, and generate pitch decks.</p>
            <button id="google-sign-in" class="auth-btn google-btn">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
            </button>
            <div class="auth-divider"><span>or</span></div>
            <form id="email-sign-in-form">
                <input type="email" id="auth-email" placeholder="your@email.com" required>
                <input type="password" id="auth-password" placeholder="Password (min 6 chars)" minlength="6" required>
                <button type="submit" class="auth-btn email-btn" id="auth-submit-btn">Sign in</button>
            </form>
            <p class="auth-toggle">
                <span id="auth-toggle-text">Don't have an account?</span>
                <a href="#" id="auth-toggle-link">Create one</a>
            </p>
            <p id="auth-message" class="auth-message hidden"></p>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector(".modal-close").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
    });

    document.getElementById("google-sign-in").addEventListener("click", () => {
        signInWithGoogle();
    });

    let isSignUp = false;

    document.getElementById("auth-toggle-link").addEventListener("click", (e) => {
        e.preventDefault();
        isSignUp = !isSignUp;
        document.getElementById("auth-title").textContent = isSignUp ? "Create an account" : "Sign in to DangerStorm";
        document.getElementById("auth-submit-btn").textContent = isSignUp ? "Create account" : "Sign in";
        document.getElementById("auth-toggle-text").textContent = isSignUp ? "Already have an account?" : "Don't have an account?";
        document.getElementById("auth-toggle-link").textContent = isSignUp ? "Sign in" : "Create one";
        document.getElementById("auth-message").classList.add("hidden");
    });

    document.getElementById("email-sign-in-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value.trim();
        const password = document.getElementById("auth-password").value;
        if (!email || !password) return;

        const submitBtn = document.getElementById("auth-submit-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = isSignUp ? "Creating..." : "Signing in...";

        let result;
        try {
            result = isSignUp
                ? await signUpWithPassword(email, password)
                : await signInWithPassword(email, password);
        } catch (err) {
            console.error("Auth call threw:", err);
            result = { error: { message: err.message || "Auth request failed." } };
        }

        const error = result.error;
        const msg = document.getElementById("auth-message");
        msg.classList.remove("hidden");

        if (error) {
            msg.textContent = error.message || "Something went wrong. Try again.";
            msg.className = "auth-message error";
            submitBtn.disabled = false;
            submitBtn.textContent = isSignUp ? "Create account" : "Sign in";
        } else if (isSignUp) {
            msg.textContent = "Account created! Check your email to confirm, then sign in.";
            msg.className = "auth-message success";
            submitBtn.disabled = false;
            submitBtn.textContent = "Create account";
        } else {
            // Signed in — modal will be removed by auth state change
            modal.remove();
        }
    });
}

function requireAuth(action) {
    if (currentUser) return true;
    showAuthModal();
    return false;
}

function checkIdeaLimit() {
    if (!currentProfile) return { allowed: false, reason: "not_authenticated" };
    const tier = currentProfile.tier;
    const max = (tier === "pro" || tier === "pioneer") ? 99 : 19;
    if (currentProfile.idea_count >= max) {
        return { allowed: false, reason: "limit_reached", max };
    }
    return { allowed: true };
}

// ---- Custom Modal (replaces confirm/alert) ----
function dsModal(message, buttons) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("ds-modal-overlay");
        const msgEl = document.getElementById("ds-modal-message");
        const actionsEl = document.getElementById("ds-modal-actions");

        msgEl.textContent = message;
        actionsEl.innerHTML = "";

        buttons.forEach((btn) => {
            const b = document.createElement("button");
            b.textContent = btn.label;
            b.className = `action-btn${btn.primary ? " primary" : ""}${btn.danger ? " danger" : ""}`;
            b.addEventListener("click", () => {
                overlay.classList.add("hidden");
                resolve(btn.value);
            });
            actionsEl.appendChild(b);
        });

        overlay.classList.remove("hidden");

        // Close on overlay click (outside modal)
        overlay.addEventListener("click", function handler(e) {
            if (e.target === overlay) {
                overlay.classList.add("hidden");
                overlay.removeEventListener("click", handler);
                resolve(null);
            }
        });
    });
}

function dsConfirm(message, okLabel = "OK", cancelLabel = "Cancel") {
    return dsModal(message, [
        { label: cancelLabel, value: false },
        { label: okLabel, value: true, primary: true },
    ]);
}

function dsAlert(message, label = "OK") {
    return dsModal(message, [
        { label, value: true, primary: true },
    ]);
}
