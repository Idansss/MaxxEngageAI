-- Maxx Engage - Migration 012: Assessment job queue
--
-- Stores async grading jobs so HTTP requests do not wait for model calls.
-- The first implementation is Postgres-backed and can be processed by
-- FastAPI BackgroundTasks or backend/scripts/run_assessment_worker.py.

CREATE TABLE IF NOT EXISTS public.assessment_jobs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID,
    status        TEXT        NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    request       JSONB       NOT NULL,
    result        JSONB,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.assessment_jobs IS
    'Durable async grading jobs for submissions. Results contain the AssessResponse JSON.';

CREATE INDEX IF NOT EXISTS idx_assessment_jobs_user
    ON public.assessment_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_jobs_status
    ON public.assessment_jobs(status, created_at ASC);

ALTER TABLE public.assessment_jobs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; app routes enforce ownership before returning jobs.
