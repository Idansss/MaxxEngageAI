-- Maxx Engage - Migration 020: Phase 1 credential/proof/verify contract
--
-- Keeps credentials.id as the internal UUID primary key, and introduces
-- credentials.public_id as the stable public credential ID shown to users and
-- employers, e.g. cred_abc123xyz.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User proof-page fields.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS location TEXT;

UPDATE public.users
SET bio = LEFT(bio, 140)
WHERE bio IS NOT NULL AND length(bio) > 140;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_bio_140'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_bio_140 CHECK (bio IS NULL OR length(bio) <= 140);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_location_80'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_location_80 CHECK (location IS NULL OR length(location) <= 80);
    END IF;
END $$;

ALTER TABLE public.users
    ALTER COLUMN public_profile SET DEFAULT true;

COMMENT ON COLUMN public.users.location IS
    'Optional user-controlled city/country label shown on /u/[username].';

-- Credential public contract fields.
ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS public_id TEXT,
    ADD COLUMN IF NOT EXISTS rubric_id TEXT,
    ADD COLUMN IF NOT EXISTS rubric_version TEXT NOT NULL DEFAULT '1',
    ADD COLUMN IF NOT EXISTS skill_name TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS pass_threshold NUMERIC(5,2) NOT NULL DEFAULT 70,
    ADD COLUMN IF NOT EXISTS scores_by_category JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS submission_hash TEXT,
    ADD COLUMN IF NOT EXISTS graded_by TEXT NOT NULL DEFAULT 'ai',
    ADD COLUMN IF NOT EXISTS human_reviewer_id UUID,
    ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS flag_reason TEXT,
    ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_reason TEXT,
    ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT true;

UPDATE public.credentials c
SET
    public_id = COALESCE(c.public_id, 'cred_' || substr(encode(digest(c.id::text, 'sha256'), 'hex'), 1, 12)),
    rubric_id = COALESCE(c.rubric_id, c.vc_document #>> '{credentialSubject,rubricId}'),
    skill_name = COALESCE(c.skill_name, sp.name),
    category = COALESCE(c.category, initcap(sp.domain)),
    scores_by_category = COALESCE(c.scores_by_category, '{}'::jsonb),
    public_visible = COALESCE(c.is_public, true)
FROM public.skill_paths sp
WHERE sp.id = c.skill_path_id;

ALTER TABLE public.credentials
    ALTER COLUMN public_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'credentials_public_id_format'
          AND conrelid = 'public.credentials'::regclass
    ) THEN
        ALTER TABLE public.credentials
            ADD CONSTRAINT credentials_public_id_format
            CHECK (public_id ~ '^cred_[a-zA-Z0-9_-]{10,32}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'credentials_graded_by_check'
          AND conrelid = 'public.credentials'::regclass
    ) THEN
        ALTER TABLE public.credentials
            ADD CONSTRAINT credentials_graded_by_check
            CHECK (graded_by IN ('ai', 'ai+human', 'human'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_public_id
    ON public.credentials(public_id);

CREATE INDEX IF NOT EXISTS idx_credentials_public_visible
    ON public.credentials(public_visible)
    WHERE public_visible = true;

CREATE INDEX IF NOT EXISTS idx_credentials_revoked
    ON public.credentials(revoked)
    WHERE revoked = true;

COMMENT ON COLUMN public.credentials.public_id IS
    'Stable public credential ID, e.g. cred_abc123xyz. Internal id remains UUID.';
COMMENT ON COLUMN public.credentials.submission_hash IS
    'SHA-256 hash of the original submission body for integrity checks.';
COMMENT ON COLUMN public.credentials.public_visible IS
    'Prompt-facing per-credential visibility flag. Mirrors is_public in application writes.';

-- Public verify endpoint telemetry. Stores anonymous request metadata only.
CREATE TABLE IF NOT EXISTS public.credential_verify_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    input_kind      TEXT        NOT NULL CHECK (input_kind IN ('credential', 'user', 'invalid')),
    credential_id   TEXT,
    username        TEXT,
    found           BOOLEAN     NOT NULL DEFAULT false,
    ip_hash         TEXT,
    user_agent_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_credential_verify_events_credential
    ON public.credential_verify_events(credential_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credential_verify_events_username
    ON public.credential_verify_events(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credential_verify_events_created
    ON public.credential_verify_events(created_at DESC);

ALTER TABLE public.credential_verify_events ENABLE ROW LEVEL SECURITY;
