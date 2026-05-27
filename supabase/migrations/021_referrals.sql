-- Maxx Engage — Migration 021: Referral system
--
-- Each user gets a unique 8-char referral code.
-- Successful referrals are tracked and, once the referrer reaches 3,
-- they earn a +15 "referral" identity stamp.

-- ── referral_code on users ────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Backfill existing users
UPDATE public.users
SET referral_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- ── referrals table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES public.users(id),
  referee_id  UUID        NOT NULL REFERENCES public.users(id) UNIQUE,
  stamp_awarded BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'referrals_owner_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY referrals_owner_read ON public.referrals
        FOR SELECT USING (
          referrer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    $pol$;
  END IF;
END $$;

-- ── Extend stamps check constraint to include 'referral' ─────────────────────

DO $$ BEGIN
  ALTER TABLE public.stamps DROP CONSTRAINT IF EXISTS stamps_stamp_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.stamps
  ADD CONSTRAINT stamps_stamp_type_check
  CHECK (stamp_type IN ('email', 'phone', 'github', 'gitcoin_passport', 'referral'));
