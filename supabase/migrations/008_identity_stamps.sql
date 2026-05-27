-- Maxx Engage — Migration 008: Proof-of-personhood stamps + humanity score
--
-- Stamps are verifiable signals that a user is a real, unique human.
-- Each stamp type contributes a fixed number of points to humanity_score (0–100).
--
-- Score weights (see app/services/identity.py for authoritative values):
--   email             +10   (baseline — Supabase magic link = verified email)
--   phone             +20   (SMS OTP via Supabase Phone / Twilio)
--   github            +25   (account age ≥ 6 months, ≥ 1 repo or follower)
--     github_senior   +35   (account age ≥ 2 years AND ≥ 10 repos)
--   gitcoin_passport  +5 to +35 depending on Gitcoin score tier
--
-- A humanity_score ≥ 50 is required for a credential to carry full weight in
-- public rankings. Below 50, the credential is still valid but flagged as
-- "unverified identity" on the public profile.

-- ── stamps ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stamps (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES public.users(id),
    stamp_type          TEXT        NOT NULL CHECK (stamp_type IN (
                            'email', 'phone', 'github', 'gitcoin_passport'
                        )),
    -- The verified identifier (hashed for PII types like phone)
    stamp_value         TEXT,
    score_contribution  FLOAT       NOT NULL DEFAULT 0 CHECK (score_contribution >= 0),
    verified_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- NULL = never expires. Gitcoin stamps expire; GitHub stamps are refreshed yearly.
    expires_at          TIMESTAMPTZ,
    -- Raw response metadata for audit purposes (no PII in plain text)
    metadata            JSONB       NOT NULL DEFAULT '{}',

    -- One active stamp per type per user
    UNIQUE(user_id, stamp_type)
);

COMMENT ON TABLE  public.stamps IS
    'Proof-of-personhood signals. Each stamp contributes to humanity_score (0–100).';
COMMENT ON COLUMN public.stamps.stamp_value IS
    'Verified identifier for this stamp. PII (e.g. phone) stored as SHA-256 hash.';
COMMENT ON COLUMN public.stamps.metadata IS
    'Raw data from the verification provider, stripped of PII. Used for audit + re-scoring.';

CREATE INDEX IF NOT EXISTS idx_stamps_user_id   ON public.stamps(user_id);
CREATE INDEX IF NOT EXISTS idx_stamps_type      ON public.stamps(stamp_type);

ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stamps' AND policyname = 'stamps_owner_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY stamps_owner_read ON public.stamps
        FOR SELECT USING (
          user_id IN (
            SELECT id FROM public.users WHERE auth_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;

-- ── humanity_score on users ───────────────────────────────────────────────────
-- Derived from stamps. Recomputed by the application after each stamp change.
-- Public: verifiers can see this score to weight credential credibility.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS humanity_score FLOAT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.humanity_score IS
    'Proof-of-personhood score (0–100). Computed from stamps. ≥50 = full credential weight.';
