-- Migration 005: Link Supabase Auth users to Maxx Engage profiles
-- Run this in Supabase SQL Editor or via supabase db push.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

COMMENT ON COLUMN public.users.auth_id IS 'Supabase auth.users.id — links the SSO session to this profile.';

-- Index for the /auth/me lookup
CREATE INDEX IF NOT EXISTS users_auth_id_idx ON public.users (auth_id);

-- RLS: let authenticated users read and update their own row via auth_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND policyname = 'users: own row select'
    ) THEN
        EXECUTE 'CREATE POLICY "users: own row select"
            ON public.users FOR SELECT
            USING (auth_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND policyname = 'users: own row update'
    ) THEN
        EXECUTE 'CREATE POLICY "users: own row update"
            ON public.users FOR UPDATE
            USING (auth_id = auth.uid())';
    END IF;
END $$;
