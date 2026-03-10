-- ============================================
-- DangerStorm — Prompt log for IP/timestamp tracking
-- ============================================

-- Log every user prompt with IP and timestamp (patent/IP documentation)
CREATE TABLE prompt_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email      TEXT,
    ip_address      TEXT NOT NULL,
    prompt_text     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_log_user_id ON prompt_log(user_id);
CREATE INDEX idx_prompt_log_created_at ON prompt_log(created_at DESC);
CREATE INDEX idx_prompt_log_ip ON prompt_log(ip_address);

-- RLS: only service role can insert/read (server-side only)
ALTER TABLE prompt_log ENABLE ROW LEVEL SECURITY;

-- No public policies — this table is only accessible via the service key
