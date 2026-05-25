-- Migration 005: Link Supabase Auth users to ProofOS profiles
-- Run this in Supabase SQL Editor or via supabase db push.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

COMMENT ON COLUMN public.users.auth_id IS 'Supabase auth.users.id — links the SSO session to this profile.';

-- Index for the /auth/me lookup
CREATE INDEX IF NOT EXISTS users_auth_id_idx ON public.users (auth_id);

-- RLS: let authenticated users read and update their own row via auth_id
CREATE POLICY IF NOT EXISTS "users: own row select"
    ON public.users FOR SELECT
    USING (auth_id = auth.uid());

CREATE POLICY IF NOT EXISTS "users: own row update"
    ON public.users FOR UPDATE
    USING (auth_id = auth.uid());
