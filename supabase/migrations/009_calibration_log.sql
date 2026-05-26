-- Maxx Engage — Migration 009: Calibration log
--
-- Stores the results of every calibration run so we can track AI grading
-- quality over time. A "run" is one execution of run_calibration.py against
-- one or more eval JSONL files.
--
-- Key metrics tracked per case:
--   abs_error      = |ai_score − human_score|  (null when no human score)
--   in_range       = AI score inside expected_score_range band
--   pass_agreement = human_pass == ai_pass      (both agree on credential outcome)
--   bias           = ai_score − human_score     (positive = AI generous, negative = AI harsh)
--
-- Aggregate metrics (computed from rows sharing run_id):
--   MAE            = AVG(abs_error) WHERE human_score IS NOT NULL
--   within5        = share of cases where abs_error <= 5
--   pass_agreement = share of cases where human_pass == ai_pass
--   in_range_rate  = share of cases where in_range = true

CREATE TABLE IF NOT EXISTS public.calibration_log (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID        NOT NULL,   -- groups all cases in one execution
    eval_file           TEXT        NOT NULL,   -- e.g. "web-dev-html-001.jsonl"
    eval_case_id        TEXT        NOT NULL,   -- e.g. "web-dev-html-001-e01"
    skill_path_slug     TEXT        NOT NULL,
    level               INTEGER     NOT NULL,
    rubric_id           TEXT        NOT NULL,
    label               TEXT        NOT NULL,   -- excellent / good / passing_borderline / failing / very_poor
    expected_range_lo   INTEGER     NOT NULL,
    expected_range_hi   INTEGER     NOT NULL,
    human_score         FLOAT,                  -- NULL until a human grades this case
    human_pass          BOOLEAN,
    ai_score            FLOAT       NOT NULL,
    ai_confidence       FLOAT,
    ai_model            TEXT        NOT NULL,
    in_range            BOOLEAN     NOT NULL,   -- ai_score BETWEEN expected_range_lo AND expected_range_hi
    abs_error           FLOAT,                  -- |ai_score - human_score|; NULL when no human score
    bias                FLOAT,                  -- ai_score - human_score; positive = AI generous
    within5             BOOLEAN,                -- abs_error <= 5; NULL when no human score
    pass_agreement      BOOLEAN,                -- human_pass == ai_pass; NULL when no human score
    feedback_summary    TEXT,
    run_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.calibration_log IS
    'One row per eval case per calibration run. Aggregate to get MAE, pass agreement, bias, in-range rate.';
COMMENT ON COLUMN public.calibration_log.run_id IS
    'UUID shared by all cases in a single run_calibration.py execution.';
COMMENT ON COLUMN public.calibration_log.bias IS
    'Positive = AI grades higher than human (generous). Negative = AI grades lower (harsh).';

CREATE INDEX IF NOT EXISTS idx_calib_run_id          ON public.calibration_log(run_id);
CREATE INDEX IF NOT EXISTS idx_calib_skill_path      ON public.calibration_log(skill_path_slug, level);
CREATE INDEX IF NOT EXISTS idx_calib_run_at          ON public.calibration_log(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_calib_eval_case       ON public.calibration_log(eval_case_id);

-- Service role bypasses RLS; calibration data is admin-only — no user-facing policy needed.
ALTER TABLE public.calibration_log ENABLE ROW LEVEL SECURITY;
