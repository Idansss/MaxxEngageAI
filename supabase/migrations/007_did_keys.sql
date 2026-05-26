-- Maxx Engage — Migration 007: DID key material for users
-- Adds Ed25519 public key (multibase) and temporary private key custody columns.
--
-- Self-sovereignty model:
--   public_key_multibase  — always stored; forms the user's did:key DID
--   private_key_b64       — temporary platform custody; user downloads via /wallet/key-material
--                           and requests deletion; NULL once migrated out
--
-- When a client-side wallet is available (Phase 4), keypairs will be generated
-- in the browser and only the public key will reach this column.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS public_key_multibase TEXT,
    ADD COLUMN IF NOT EXISTS private_key_b64       TEXT;

COMMENT ON COLUMN public.users.public_key_multibase IS
    'Multibase-encoded Ed25519 public key (z + base58btc). Together with did:key method, forms the user''s W3C DID.';
COMMENT ON COLUMN public.users.private_key_b64 IS
    'Base64-encoded raw Ed25519 private key. Platform custody only — user should download and delete. NULL after migration.';

-- Non-null constraint not added for backward-compatibility with existing rows.
-- Application code ensures all new users always receive a public key at creation time.
