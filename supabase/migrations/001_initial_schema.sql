-- Maxx Engage — Migration 001: Initial Schema
-- Applies to: Postgres 15+ (Neon / Supabase)
-- All tables use UUID PKs, JSONB for nested structures, RLS from day one.
-- Service role key bypasses RLS automatically — only anon/user tokens are restricted.

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── 1. users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    did                         TEXT        UNIQUE NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- profile
    display_name                TEXT        NOT NULL,
    bio                         TEXT,
    country_code                CHAR(2)     NOT NULL,
    preferred_language          TEXT        NOT NULL DEFAULT 'en',
    avatar_url                  TEXT,
    public_profile              BOOLEAN     NOT NULL DEFAULT false,

    -- sybil resistance signals
    gitcoin_passport_score      NUMERIC(5,2),
    vouched_by                  UUID[]      NOT NULL DEFAULT '{}',
    phone_verified              BOOLEAN     NOT NULL DEFAULT false,
    email_verified              BOOLEAN     NOT NULL DEFAULT false,

    -- aggregate reputation (derived, never manually set)
    overall_score               NUMERIC(7,2) NOT NULL DEFAULT 0,
    reputation_last_computed_at TIMESTAMPTZ
);

COMMENT ON TABLE  public.users IS 'Maxx Engage users. Platform is the renter; user owns their data via DID.';
COMMENT ON COLUMN public.users.did IS 'W3C Decentralized Identifier the user controls. E.g. did:key:z6Mk...';

-- ── 2. skill_paths ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_paths (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    TEXT        UNIQUE NOT NULL,
    name                    TEXT        NOT NULL,
    domain                  TEXT        NOT NULL CHECK (domain IN (
                                'technology','design','data','writing','business','ops','science'
                            )),
    description             TEXT,
    levels                  JSONB       NOT NULL DEFAULT '[]',
    decay_half_life_months  INTEGER     NOT NULL,
    decay_refresh_months    INTEGER,
    tags                    TEXT[]      NOT NULL DEFAULT '{}',
    active                  BOOLEAN     NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.skill_paths IS 'Config-driven skill domains. New domains = new rows, no code change.';
COMMENT ON COLUMN public.skill_paths.levels IS 'Array of {level, label, rubric_id, typical_duration_weeks}.';

-- ── 3. tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_path_id     UUID        NOT NULL REFERENCES public.skill_paths(id),
    level             INTEGER     NOT NULL CHECK (level BETWEEN 1 AND 10),
    type              TEXT        NOT NULL CHECK (type IN ('diagnostic','learning','assessment','refresh')),
    prompt            JSONB       NOT NULL,
    rubric_id         TEXT        NOT NULL,
    difficulty_rating NUMERIC(3,2) CHECK (difficulty_rating BETWEEN 0 AND 1),
    authored_by       TEXT        NOT NULL DEFAULT 'ai_generated',
    active            BOOLEAN     NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.tasks.prompt    IS '{text, context, attachments, expected_output_format, time_limit_minutes}';
COMMENT ON COLUMN public.tasks.rubric_id IS 'Filename slug referencing /rubrics/<id>.json';

-- ── 4. submissions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES public.users(id),
    task_id             UUID        NOT NULL REFERENCES public.tasks(id),
    content             JSONB       NOT NULL,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    time_spent_minutes  INTEGER     CHECK (time_spent_minutes >= 0),
    status              TEXT        NOT NULL DEFAULT 'pending_ai_review' CHECK (status IN (
                            'pending_ai_review','ai_reviewed','pending_human_review',
                            'human_reviewed','appealed','final'
                        )),
    review_id           UUID,
    attempt_number      INTEGER     NOT NULL DEFAULT 1 CHECK (attempt_number >= 1)
);

COMMENT ON COLUMN public.submissions.content IS '{type, body, url, file_cid, language}';
COMMENT ON COLUMN public.submissions.status  IS 'Pipeline state: pending_ai_review → ai_reviewed → (human_reviewed) → final';

-- ── 5. reviews ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id          UUID        NOT NULL REFERENCES public.submissions(id),
    reviewer_type          TEXT        NOT NULL CHECK (reviewer_type IN ('ai','human')),
    reviewer_id            TEXT        NOT NULL,
    rubric_id              TEXT        NOT NULL,
    scores                 JSONB       NOT NULL DEFAULT '[]',
    overall_score          NUMERIC(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    confidence             NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
    feedback               JSONB       NOT NULL,
    reviewed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    credential_eligible    BOOLEAN     NOT NULL DEFAULT false,
    human_review_requested BOOLEAN     NOT NULL DEFAULT false,
    appeal_reason          TEXT,
    model_version          TEXT,
    prompt_hash            TEXT
);

COMMENT ON COLUMN public.reviews.scores   IS 'Array of {dimension, score, max_score, rationale, evidence_quotes}';
COMMENT ON COLUMN public.reviews.feedback IS '{summary, strengths[], improvements[], next_steps[]}';
COMMENT ON COLUMN public.reviews.reviewer_id IS 'Model name (e.g. claude-sonnet-4-6) for AI; user UUID for humans.';

-- ── 6. credentials ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credentials (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES public.users(id),
    submission_id       UUID        NOT NULL REFERENCES public.submissions(id),
    review_id           UUID        NOT NULL REFERENCES public.reviews(id),
    holder_did          TEXT        NOT NULL,
    skill_path_id       UUID        NOT NULL REFERENCES public.skill_paths(id),
    level               INTEGER     NOT NULL,
    level_label         TEXT        NOT NULL,
    score               NUMERIC(5,2) NOT NULL,
    percentile          NUMERIC(5,2),
    verified_by_human   BOOLEAN     NOT NULL DEFAULT false,
    zk_proof_available  BOOLEAN     NOT NULL DEFAULT false,
    vc_document         JSONB       NOT NULL,
    valid_from          TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.credentials.vc_document  IS 'Full W3C VC 2.0 JSON document. User owns this; platform is custodian.';
COMMENT ON COLUMN public.credentials.holder_did   IS 'The user DID that is the credential subject.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_skill_path_id        ON public.tasks(skill_path_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type_level           ON public.tasks(type, level);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id        ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id        ON public.submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status         ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_reviews_submission_id      ON public.reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_credential_eligible ON public.reviews(credential_eligible) WHERE credential_eligible = true;
CREATE INDEX IF NOT EXISTS idx_credentials_user_id        ON public.credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_skill_path_id  ON public.credentials(skill_path_id);
CREATE INDEX IF NOT EXISTS idx_users_did                  ON public.users(did);
CREATE INDEX IF NOT EXISTS idx_users_public_profile       ON public.users(public_profile) WHERE public_profile = true;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on all tables. Policies that reference auth.uid() are in
-- 003_rls_policies.sql which must be applied via the Supabase dashboard
-- (Supabase injects the auth schema; plain Postgres / Neon do not have it).
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_paths  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials  ENABLE ROW LEVEL SECURITY;

-- Non-auth policies safe on any Postgres:
CREATE POLICY "skill_paths_public_read"
    ON public.skill_paths FOR SELECT
    USING (active = true);

CREATE POLICY "tasks_public_read"
    ON public.tasks FOR SELECT
    USING (active = true);

CREATE POLICY "credentials_public_read"
    ON public.credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = credentials.user_id
              AND u.public_profile = true
        )
    );
