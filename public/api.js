// ============================================
// DangerStorm — Supabase Data & Storage API
// ============================================

async function saveIdea(domain, productName, tagline, conversation, outputs) {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const response = await fetch("/api/save-idea", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ domain, productName, tagline, conversation, outputs }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to save idea");
    return data;
}

async function getIdeas() {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("ideas")
        .select("*, idea_versions(count)")
        .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

async function getIdea(ideaId) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("ideas")
        .select("*")
        .eq("id", ideaId)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

async function getIdeaVersions(ideaId) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("idea_versions")
        .select("*")
        .eq("idea_id", ideaId)
        .order("version_number", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

async function deleteIdea(ideaId) {
    const sb = getSupabase();
    const { error } = await sb
        .from("ideas")
        .delete()
        .eq("id", ideaId);

    if (error) throw new Error(error.message);

    // Refresh profile to update idea_count
    currentProfile = await fetchProfile();
}

async function uploadPpt(ideaId, versionNumber, pptBlob) {
    const sb = getSupabase();
    const user = getUser();
    const path = `${user.id}/${ideaId}/${versionNumber}/pitch-deck.pptx`;

    const { error } = await sb.storage
        .from("outputs")
        .upload(path, pptBlob, {
            contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            upsert: true,
        });

    if (error) throw new Error(error.message);

    // Update the version record with storage path
    await sb
        .from("idea_versions")
        .update({ ppt_storage_path: path })
        .eq("idea_id", ideaId)
        .eq("version_number", versionNumber);

    return path;
}

async function uploadZip(ideaId, versionNumber, zipBlob) {
    const sb = getSupabase();
    const user = getUser();
    const path = `${user.id}/${ideaId}/${versionNumber}/outputs.zip`;

    const { error } = await sb.storage
        .from("outputs")
        .upload(path, zipBlob, {
            contentType: "application/zip",
            upsert: true,
        });

    if (error) throw new Error(error.message);

    await sb
        .from("idea_versions")
        .update({ zip_storage_path: path })
        .eq("idea_id", ideaId)
        .eq("version_number", versionNumber);

    return path;
}

async function getDownloadUrl(storagePath) {
    const sb = getSupabase();
    const { data, error } = await sb.storage
        .from("outputs")
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) throw new Error(error.message);
    return data.signedUrl;
}

async function createCheckoutSession() {
    const token = await getAccessToken();
    const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to create checkout");
    return data.url;
}

async function createPortalSession() {
    const token = await getAccessToken();
    const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to open billing portal");
    return data.url;
}
