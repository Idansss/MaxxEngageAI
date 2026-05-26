-- Maxx Engage - Migration 011: Observability, safety, and audit log
--
-- Creates an append-only audit table for score, review, credential, and safety
-- events. The event_hash + previous_event_hash chain makes tampering evident.

CREATE TABLE IF NOT EXISTS public.audit_log (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type          TEXT        NOT NULL CHECK (actor_type IN ('system', 'ai', 'user', 'admin')),
    actor_id            TEXT,
    action              TEXT        NOT NULL,
    entity_type         TEXT        NOT NULL,
    entity_id           TEXT,
    old_values          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    new_values          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    request_id          TEXT,
    previous_event_hash TEXT,
    event_hash          TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
    'Append-only audit events for scoring, review decisions, credential changes, and safety checks.';
COMMENT ON COLUMN public.audit_log.event_hash IS
    'SHA-256 hash of the event payload plus previous_event_hash, computed by the API.';
COMMENT ON COLUMN public.audit_log.previous_event_hash IS
    'Hash of the previous audit event, forming a tamper-evident hash chain.';

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON public.audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON public.audit_log(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action
    ON public.audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at
    ON public.audit_log(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_event_hash
    ON public.audit_log(event_hash);

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON public.audit_log;
CREATE TRIGGER trg_prevent_audit_log_update
    BEFORE UPDATE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON public.audit_log;
CREATE TRIGGER trg_prevent_audit_log_delete
    BEFORE DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. No user-facing audit read policy is created.
