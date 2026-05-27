-- Maxx Engage — Migration 014: Seed three new skill paths
-- Adds Backend Development, Copywriting (English), and Local Language Translation (Yoruba).

-- ── Backend Development ───────────────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'backend-api',
    'Backend Development',
    'technology',
    'Design and build REST APIs with correct HTTP semantics, input validation, error handling, and clean code structure.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "backend-api-001", "typical_duration_weeks": 8}
    ]'::jsonb,
    18,
    12,
    ARRAY['rest-api', 'node', 'python', 'fastapi', 'express', 'http', 'backend']
)
ON CONFLICT (slug) DO NOTHING;

-- ── Copywriting (English) ─────────────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'copywriting-en',
    'Copywriting (English)',
    'writing',
    'Write persuasive, audience-aware marketing copy: headlines, feature bullets, CTAs, and landing page sections.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "copy-en-001", "typical_duration_weeks": 6}
    ]'::jsonb,
    24,
    18,
    ARRAY['copywriting', 'landing-pages', 'marketing', 'writing', 'persuasion']
)
ON CONFLICT (slug) DO NOTHING;

-- ── Local Language Translation (Yoruba) ───────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'translation-yo-en',
    'Local Language Translation (Yoruba)',
    'writing',
    'Translate English passages into natural, register-appropriate Yoruba across formal, casual, and commercial contexts.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "translate-yo-en-001", "typical_duration_weeks": 6}
    ]'::jsonb,
    24,
    18,
    ARRAY['yoruba', 'translation', 'language', 'writing', 'localisation']
)
ON CONFLICT (slug) DO NOTHING;
