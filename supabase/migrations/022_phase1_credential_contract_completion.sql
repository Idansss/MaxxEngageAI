-- Maxx Engage - Migration 022: Complete Phase 1 credential contract
--
-- Migration 020 added most public credential fields but missed two prompt-level
-- fields: passed and graded_at. Credentials are only issued for passing
-- assessments, so existing credential rows are backfilled as passed.

ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS passed BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.credentials
SET
    passed = true,
    graded_at = COALESCE(graded_at, valid_from, created_at, now());

COMMENT ON COLUMN public.credentials.passed IS
    'Whether the credential represents a passed assessment result. Issued credentials are true.';
COMMENT ON COLUMN public.credentials.graded_at IS
    'Timestamp when the underlying assessment review was graded.';
