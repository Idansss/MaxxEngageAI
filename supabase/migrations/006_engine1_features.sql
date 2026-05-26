-- Maxx Engage — Migration 006: Engine 1 missing pieces
-- Adds: trust vouching table, trust_score on users,
--       score_commitment + consistency + attempt_count on credentials.
-- Safe to re-run (all ADD COLUMN / CREATE TABLE use IF NOT EXISTS).

-- ── Vouches table (Sybil resistance) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouches (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id  UUID        NOT NULL REFERENCES public.users(id),
    vouchee_id  UUID        NOT NULL REFERENCES public.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    CONSTRAINT  no_self_vouch CHECK (voucher_id <> vouchee_id),
    UNIQUE(voucher_id, vouchee_id)
);

COMMENT ON TABLE public.vouches IS
    'Trust-network vouching for Sybil resistance. A voucher attests that a vouchee is a real, unique human they know.';

CREATE INDEX IF NOT EXISTS idx_vouches_vouchee ON public.vouches(vouchee_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_vouches_voucher ON public.vouches(voucher_id);

ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vouches' AND policyname = 'vouches_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY "vouches_public_read" ON public.vouches FOR SELECT USING (status = ''active'')';
  END IF;
END $$;

-- ── trust_score on users ──────────────────────────────────────────────────────
-- Derived aggregate: (credential_count * 10) + (active_vouch_count * 5), capped at 100.
-- Recomputed in application code; never manually set.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS trust_score FLOAT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.trust_score IS
    'Computed trust score. Updated after each credential issuance or vouch. Range 0–100.';

-- ── credentials: score_commitment, consistency, attempt_count ─────────────────
-- percentile already exists from migration 001.
ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS score_commitment   TEXT,
    ADD COLUMN IF NOT EXISTS consistency_score  FLOAT,
    ADD COLUMN IF NOT EXISTS consistency_rating TEXT CHECK (
        consistency_rating IN ('first_attempt','consistent','variable','inconsistent')
    ),
    ADD COLUMN IF NOT EXISTS attempt_count      INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.credentials.score_commitment IS
    'HMAC-SHA256(secret, credential_id:score) — lets verifiers confirm a disclosed score without the platform revealing it.';
COMMENT ON COLUMN public.credentials.consistency_score IS
    '0–100 score measuring stability of performance across multiple attempts. NULL on first attempt.';
COMMENT ON COLUMN public.credentials.consistency_rating IS
    'Human-readable consistency label derived from score std-dev across attempts.';
COMMENT ON COLUMN public.credentials.attempt_count IS
    'Number of assessed submissions the user has made for this skill path at time of credential issuance.';
