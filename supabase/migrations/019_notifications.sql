-- 019_notifications.sql
-- In-app notification bell: credential_earned, human_review_done, vouch_received

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'notification_type'
    ) THEN
        CREATE TYPE public.notification_type AS ENUM (
            'credential_earned',
            'human_review_done',
            'vouch_received'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type       public.notification_type NOT NULL,
    title      TEXT        NOT NULL,
    body       TEXT,
    href       TEXT,
    is_read    BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata   JSONB
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
    ON public.notifications(user_id, is_read, created_at DESC);

-- RLS: each user sees only their own rows
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
          AND policyname = 'Users see own notifications'
    ) THEN
        EXECUTE 'CREATE POLICY "Users see own notifications"
            ON public.notifications FOR SELECT
            USING (
                user_id IN (
                    SELECT id FROM public.users WHERE auth_id = auth.uid()
                )
            )';
    END IF;
END $$;
