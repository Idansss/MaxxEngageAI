-- ProofOS — Migration 004: Seed diagnostic task for web-dev-frontend Level 1
-- Provides a real task_id for end-to-end assessment + credential testing.

INSERT INTO public.tasks (skill_path_id, level, type, prompt, rubric_id, difficulty_rating, authored_by)
SELECT
    sp.id,
    1,
    'diagnostic',
    '{
        "text": "Build a semantic, accessible, responsive HTML/CSS landing page for a fictional local business of your choice. The page must include: a navigation bar with at least 3 links, a hero section with a headline and call-to-action button, a features or services section with at least 3 items, and a footer with contact info. Use only HTML and CSS — no JavaScript required.",
        "context": "This is a diagnostic task to establish your current Frontend Web Development level. Work at your own pace — time is not scored.",
        "expected_output_format": "Paste the full HTML file (with embedded or inline CSS). External stylesheets are fine if you include the CSS content as a comment block.",
        "time_limit_minutes": 90
    }'::jsonb,
    'web-dev-html-001',
    0.35,
    'proofos_seed'
FROM public.skill_paths sp
WHERE sp.slug = 'web-dev-frontend'
ON CONFLICT DO NOTHING;
