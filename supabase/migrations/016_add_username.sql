-- Maxx Engage — Migration 016: Add username and proof page visibility to users
--
-- username: unique handle for public proof pages (/u/[username])
--   - nullable (users without a username fall back to /profile/[userId])
--   - 3–20 chars, lowercase alphanumeric + underscore
-- proof_page_visibility: user-controlled visibility of /u/[username]
--   - 'public'   — allow indexing; visible to anyone
--   - 'unlisted' — link works but robots.txt noindex
--   - 'private'  — only the owner can view; returns 404 to others

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS username TEXT,
    ADD COLUMN IF NOT EXISTS proof_page_visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (proof_page_visibility IN ('public', 'unlisted', 'private'));

-- Enforce valid format at the DB level.
-- Postgres does not support ADD CONSTRAINT IF NOT EXISTS.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_username_format'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_username_format
            CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
    ON public.users(username)
    WHERE username IS NOT NULL;

COMMENT ON COLUMN public.users.username IS
    'Optional public handle. 3-20 chars, lowercase alphanumeric + underscore. Used in /u/[username] proof page URL.';

COMMENT ON COLUMN public.users.proof_page_visibility IS
    'public = indexed and visible, unlisted = accessible by link only (noindex), private = 404 to all but owner.';
