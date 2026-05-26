-- Maxx Engage — Migration 013: Credential anchoring metadata
--
-- Stores tamper-evident hash data for every issued credential and, when
-- configured, the IPFS CID returned by the pinning provider.

ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS content_hash    TEXT,
    ADD COLUMN IF NOT EXISTS ipfs_cid        TEXT,
    ADD COLUMN IF NOT EXISTS anchor_provider TEXT NOT NULL DEFAULT 'sha256',
    ADD COLUMN IF NOT EXISTS anchor_status   TEXT NOT NULL DEFAULT 'hashed_only'
        CHECK (anchor_status IN ('hashed_only', 'pinned', 'failed')),
    ADD COLUMN IF NOT EXISTS anchor_url      TEXT;

COMMENT ON COLUMN public.credentials.content_hash IS
    'SHA-256 hash of the canonical credential JSON at issuance time.';
COMMENT ON COLUMN public.credentials.ipfs_cid IS
    'IPFS CID when the credential JSON is pinned to IPFS.';
COMMENT ON COLUMN public.credentials.anchor_status IS
    'hashed_only = local tamper-evidence only; pinned = available on IPFS; failed = pinning failed but hash exists.';

CREATE INDEX IF NOT EXISTS idx_credentials_content_hash ON public.credentials(content_hash);
CREATE INDEX IF NOT EXISTS idx_credentials_ipfs_cid ON public.credentials(ipfs_cid) WHERE ipfs_cid IS NOT NULL;
