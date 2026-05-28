-- Maxx Engage — Migration 025: Seed new skill paths for Design, Business, Data, Operations, Science

-- ── UI/UX Design Foundations ─────────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'ux-design-foundations',
    'UI/UX Design Foundations',
    'design',
    'Design mobile and web interfaces that are clear, accessible, and context-appropriate — with a focus on emerging-market users.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "ux-design-001", "typical_duration_weeks": 8}
    ]'::jsonb,
    24,
    18,
    ARRAY['ux', 'ui', 'design', 'wireframing', 'accessibility', 'mobile-design']
)
ON CONFLICT (slug) DO NOTHING;

-- ── Business Analysis ────────────────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'business-analysis',
    'Business Analysis',
    'business',
    'Identify problems, analyse markets, design solutions, and reason about risk — grounded in African business realities.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "business-analysis-001", "typical_duration_weeks": 6}
    ]'::jsonb,
    24,
    18,
    ARRAY['business', 'analysis', 'strategy', 'market-research', 'problem-solving']
)
ON CONFLICT (slug) DO NOTHING;

-- ── Data Analysis & Storytelling ─────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'data-analysis',
    'Data Analysis & Storytelling',
    'data',
    'Turn raw numbers into decisions — analyse datasets, identify patterns, and communicate findings that drive action.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "data-analysis-001", "typical_duration_weeks": 8}
    ]'::jsonb,
    18,
    12,
    ARRAY['data-analysis', 'storytelling', 'insights', 'metrics', 'product-analytics']
)
ON CONFLICT (slug) DO NOTHING;

-- ── Operations & Process Design ───────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'ops-process-design',
    'Operations & Process Design',
    'ops',
    'Build lean, usable operational processes — SOPs, workflows, and playbooks that small teams can actually follow.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "ops-process-001", "typical_duration_weeks": 6}
    ]'::jsonb,
    30,
    24,
    ARRAY['operations', 'process', 'sop', 'workflow', 'startup-ops']
)
ON CONFLICT (slug) DO NOTHING;

-- ── Science Communication ─────────────────────────────────────────────────────
INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'science-communication',
    'Science Communication',
    'science',
    'Translate complex scientific ideas into clear, accurate, trust-building explanations for non-expert audiences.',
    '[
        {"level": 1, "label": "Foundations", "rubric_id": "science-comm-001", "typical_duration_weeks": 6}
    ]'::jsonb,
    36,
    24,
    ARRAY['science', 'communication', 'health', 'public-understanding', 'writing']
)
ON CONFLICT (slug) DO NOTHING;
