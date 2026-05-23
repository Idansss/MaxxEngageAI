-- ProofOS — Migration 002: Seed first skill path
-- web-dev-frontend is the MVP domain.

INSERT INTO public.skill_paths (slug, name, domain, description, levels, decay_half_life_months, decay_refresh_months, tags)
VALUES (
    'web-dev-frontend',
    'Frontend Web Development',
    'technology',
    'Build responsive, accessible, semantic web interfaces — from HTML foundations to production-ready React components.',
    '[
        {"level": 1, "label": "Foundations",  "rubric_id": "web-dev-html-001", "typical_duration_weeks": 8},
        {"level": 2, "label": "Practitioner", "rubric_id": "web-dev-practitioner-001", "typical_duration_weeks": 10},
        {"level": 3, "label": "Advanced",     "rubric_id": "web-dev-advanced-001",     "typical_duration_weeks": 12},
        {"level": 4, "label": "Expert",       "rubric_id": "web-dev-expert-001",       "typical_duration_weeks": 16}
    ]'::jsonb,
    18,   -- half-life: 18 months (frontend moves fast)
    12,   -- refresh required after 12 months of inactivity
    ARRAY['html', 'css', 'javascript', 'react', 'responsive-design', 'accessibility']
)
ON CONFLICT (slug) DO NOTHING;
