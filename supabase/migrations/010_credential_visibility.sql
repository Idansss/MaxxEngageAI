-- Maxx Engage — Migration 010: Per-credential visibility toggle
--
-- Adds is_public (default true) to credentials so users can hide individual
-- credentials from their public profile without affecting other credentials.
--
-- The existing credentials_public_read RLS policy already requires
-- u.public_profile = true; this adds a second gate at the credential level.
-- Both conditions must be true for a credential to appear publicly:
--   1. users.public_profile = true
--   2. credentials.is_public = true

ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.credentials.is_public IS
    'User-controlled visibility. false = hidden from public profile and verifiers. Default true.';

CREATE INDEX IF NOT EXISTS idx_credentials_is_public ON public.credentials(is_public) WHERE is_public = true;
