-- Maxx Engage — Migration 024: Peer Review Queue
--
-- Translation assessments that pass AI grading are held for human review before
-- a credential is issued.  This migration adds:
--   peer_review_queue        — one row per pending/completed review
--   peer_reviewer_reputation — running stats per reviewer
--
-- It also extends notification_type with 'peer_review_complete'.

-- ── notification_type extension ───────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'notification_type'
          AND e.enumlabel = 'peer_review_complete'
    ) THEN
        ALTER TYPE public.notification_type ADD VALUE 'peer_review_complete';
    END IF;
END $$;

-- ── peer_review_queue ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.peer_review_queue (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Submitter context
    user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    submission_id    UUID        REFERENCES public.submissions(id) ON DELETE SET NULL,
    review_id        UUID        REFERENCES public.reviews(id)     ON DELETE SET NULL,

    -- Skill context
    skill_path_slug  TEXT        NOT NULL,
    rubric_id        TEXT        NOT NULL,
    ai_score         NUMERIC(5,2),

    -- Workflow state
    status           TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','claimed','approved','rejected','expired')),

    -- Reviewer assignment
    claimed_by       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    claimed_at       TIMESTAMPTZ,
    claim_expires_at TIMESTAMPTZ, -- auto-release if reviewer doesn't submit by this time

    -- Verdict
    verdict          TEXT        CHECK (verdict IS NULL OR verdict IN ('approve','reject')),
    verdict_notes    TEXT,        -- required feedback when rejecting
    completed_at     TIMESTAMPTZ,

    -- Credential link (set on approval)
    credential_id    UUID        REFERENCES public.credentials(id) ON DELETE SET NULL,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.peer_review_queue IS 'Human review queue for translation submissions that pass AI grading.';
COMMENT ON COLUMN public.peer_review_queue.claim_expires_at IS 'Reviewer must submit verdict before this timestamp or the item returns to pending.';
COMMENT ON COLUMN public.peer_review_queue.verdict_notes    IS 'Required when verdict=reject; shown to submitter in notification.';

-- Prevent duplicate queue entries for the same submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_prq_submission_unique
    ON public.peer_review_queue(submission_id) WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prq_status        ON public.peer_review_queue(status, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_prq_user          ON public.peer_review_queue(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prq_claimed_by    ON public.peer_review_queue(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prq_review        ON public.peer_review_queue(review_id);

ALTER TABLE public.peer_review_queue ENABLE ROW LEVEL SECURITY;

-- Submitters see their own queue items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'peer_review_queue'
          AND policyname = 'Submitters see own queue items'
    ) THEN
        EXECUTE $pol$
            CREATE POLICY "Submitters see own queue items"
                ON public.peer_review_queue FOR SELECT
                USING (
                    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
                )
        $pol$;
    END IF;
END $$;

-- ── peer_reviewer_reputation ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.peer_reviewer_reputation (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id         UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    reviews_completed   INTEGER     NOT NULL DEFAULT 0,
    reviews_approved    INTEGER     NOT NULL DEFAULT 0,
    reviews_rejected    INTEGER     NOT NULL DEFAULT 0,
    last_active_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.peer_reviewer_reputation IS 'Running review stats per human reviewer. Used for quality weighting.';

CREATE INDEX IF NOT EXISTS idx_prr_reviewer ON public.peer_reviewer_reputation(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_prr_completed ON public.peer_reviewer_reputation(reviews_completed DESC);

ALTER TABLE public.peer_reviewer_reputation ENABLE ROW LEVEL SECURITY;

-- Reviewers see their own reputation row
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'peer_reviewer_reputation'
          AND policyname = 'Reviewers see own reputation'
    ) THEN
        EXECUTE $pol$
            CREATE POLICY "Reviewers see own reputation"
                ON public.peer_reviewer_reputation FOR SELECT
                USING (
                    reviewer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
                )
        $pol$;
    END IF;
END $$;

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trg_prq_updated_at'
          AND event_object_table = 'peer_review_queue'
    ) THEN
        CREATE TRIGGER trg_prq_updated_at
            BEFORE UPDATE ON public.peer_review_queue
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trg_prr_updated_at'
          AND event_object_table = 'peer_reviewer_reputation'
    ) THEN
        CREATE TRIGGER trg_prr_updated_at
            BEFORE UPDATE ON public.peer_reviewer_reputation
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;
