// ============================================
// DangerStorm — Supabase Auth
// ============================================

const SUPABASE_URL = "https://detfoqtvhrmbizzdzenb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldGZvcXR2aHJtYml6emR6ZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjc4MzksImV4cCI6MjA4ODY0MzgzOX0.Yfcr3PabrD2HtoH2B7Tzl6O9mONmAaG-Ww7rK9WZHRE";

let supabase = null;
let currentUser = null;
let currentProfile = null;

function initSupabase() {
    try {
        if (!window.supabase || SUPABASE_URL === "REPLACE_ME") {
            console.warn("Supabase not configured — auth disabled");
            updateAuthUI();
            return;
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                currentUser = session.user;
                currentProfile = await fetchProfile();
            } else {
                currentUser = null;
                currentProfile = null;
            }
            updateAuthUI();
            if (typeof onAuthChange === "function") {
                onAuthChange(currentUser, currentProfile);
            }
        });
    } catch (err) {
        console.error("Supabase init failed:", err);
        updateAuthUI();
    }
}

async function fetchProfile() {
    if (!currentUser) return null;
    const { data, error } = await supabase
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
    return supabase;
}

async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
}

async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
    });
    if (error) console.error("Google sign-in error:", error);
}

async function signInWithEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
        console.error("Email sign-in error:", error);
        return { error };
    }
    return { error: null };
}

async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateAuthUI();
}

// ---- Auth UI ----

function updateAuthUI() {
    const authBar = document.getElementById("auth-bar");
    if (!authBar) return;

    if (currentUser) {
        const name = currentProfile?.display_name || currentUser.email;
        const tier = currentProfile?.tier || "free";
        const tierBadge = tier === "pro" ? '<span class="tier-badge pro">PRO</span>' : '<span class="tier-badge free">FREE</span>';
        authBar.innerHTML = `
            <div class="auth-user">
                ${tierBadge}
                <span class="auth-name">${name}</span>
                <a href="/dashboard" class="auth-link">Dashboard</a>
                <button id="sign-out-btn" class="auth-link-btn">Sign out</button>
            </div>
        `;
        document.getElementById("sign-out-btn").addEventListener("click", signOut);
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
            <h2>Sign in to DangerStorm</h2>
            <p class="modal-subtitle">Save ideas, download files, and generate pitch decks.</p>
            <button id="google-sign-in" class="auth-btn google-btn">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
            </button>
            <div class="auth-divider"><span>or</span></div>
            <form id="email-sign-in-form">
                <input type="email" id="auth-email" placeholder="your@email.com" required>
                <button type="submit" class="auth-btn email-btn">Send magic link</button>
            </form>
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

    document.getElementById("email-sign-in-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value.trim();
        if (!email) return;

        const submitBtn = e.target.querySelector("button[type=submit]");
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";

        const { error } = await signInWithEmail(email);
        const msg = document.getElementById("auth-message");
        msg.classList.remove("hidden");

        if (error) {
            msg.textContent = "Failed to send link. Try again.";
            msg.className = "auth-message error";
            submitBtn.disabled = false;
            submitBtn.textContent = "Send magic link";
        } else {
            msg.textContent = "Check your email for the magic link!";
            msg.className = "auth-message success";
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
    const max = currentProfile.tier === "pro" ? 999 : 5;
    if (currentProfile.idea_count >= max) {
        return { allowed: false, reason: "limit_reached", max };
    }
    return { allowed: true };
}
