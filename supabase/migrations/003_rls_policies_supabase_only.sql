-- ProofOS — Migration 003: Auth-dependent RLS policies
-- SUPABASE ONLY — requires the auth schema injected by Supabase.
-- Apply this via the Supabase dashboard SQL editor, NOT the migration runner.

-- users: each user manages only their own row
CREATE POLICY "users_own_row"
    ON public.users FOR ALL
    USING (auth.uid()::text = id::text);

-- submissions: user can read/write their own
CREATE POLICY "submissions_own"
    ON public.submissions FOR ALL
    USING (auth.uid()::text = user_id::text);

-- reviews: readable by the submission owner
CREATE POLICY "reviews_read_by_submission_owner"
    ON public.reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.submissions s
            WHERE s.id = reviews.submission_id
              AND s.user_id::text = auth.uid()::text
        )
    );

-- credentials: user manages their own
CREATE POLICY "credentials_own"
    ON public.credentials FOR ALL
    USING (auth.uid()::text = user_id::text);
