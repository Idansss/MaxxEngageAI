-- Maxx Engage — Migration 015: Seed Level 1 diagnostic tasks for the three new skill paths.

-- ── Backend Development — Level 1 task ───────────────────────────────────────
INSERT INTO public.tasks (skill_path_id, level, type, prompt, rubric_id, difficulty_rating, authored_by)
SELECT
    sp.id,
    1,
    'diagnostic',
    '{
        "text": "Build a small REST API for a task tracker with these endpoints:\n- POST /tasks (fields: title, description, status, dueDate)\n- GET /tasks (support ?status= filter)\n- GET /tasks/:id\n- PATCH /tasks/:id\n- DELETE /tasks/:id\n\nRequirements:\n- Node.js + Express, Python + FastAPI, or Python + Flask (your choice)\n- Validate input; return correct HTTP status codes (200, 201, 400, 404)\n- Handle errors gracefully — no stack traces leaked to clients\n- In-memory store only (no database needed)\n- Include a README comment at the top: how to run, sample curl commands\n\nPaste your complete code below. Work at your own pace — time is not scored.",
        "context": "This is a diagnostic task to establish your current Backend Development level.",
        "expected_output_format": "code",
        "time_limit_minutes": 90
    }'::jsonb,
    'backend-api-001',
    0.40,
    'Maxx Engage_seed'
FROM public.skill_paths sp
WHERE sp.slug = 'backend-api'
ON CONFLICT DO NOTHING;

-- ── Copywriting (English) — Level 1 task ─────────────────────────────────────
INSERT INTO public.tasks (skill_path_id, level, type, prompt, rubric_id, difficulty_rating, authored_by)
SELECT
    sp.id,
    1,
    'diagnostic',
    '{
        "text": "Write landing-page copy for FarmConnect — a mobile app that helps small-scale Nigerian farmers sell directly to restaurants in their city, skipping middlemen.\n\nDeliver:\n1. A headline (max 12 words)\n2. A subheadline (max 25 words)\n3. Three feature bullets (4-word title + one-sentence description each)\n4. A call-to-action button label (max 4 words)\n5. A 60-word \"Why FarmConnect\" paragraph\n\nWrite for the farmer, not the investor. Clear, specific, no jargon.",
        "context": "This is a diagnostic task to establish your current Copywriting level.",
        "expected_output_format": "text",
        "time_limit_minutes": 45
    }'::jsonb,
    'copy-en-001',
    0.35,
    'Maxx Engage_seed'
FROM public.skill_paths sp
WHERE sp.slug = 'copywriting-en'
ON CONFLICT DO NOTHING;

-- ── Local Language Translation (Yoruba) — Level 1 task ───────────────────────
INSERT INTO public.tasks (skill_path_id, level, type, prompt, rubric_id, difficulty_rating, authored_by)
SELECT
    sp.id,
    1,
    'diagnostic',
    '{
        "text": "Translate the following three passages from English to Yoruba. Preserve meaning, tone, and register. Do not transliterate — translate.\n\nPassage 1 (formal — health notice):\n\"The Lagos State Ministry of Health advises all residents to receive the annual flu vaccine before the rainy season begins. The vaccine is free at all public health centers.\"\n\nPassage 2 (casual — text message):\n\"Hey! I am running late, the bus is taking forever. Can we push the meeting to 4pm? Sorry for the trouble.\"\n\nPassage 3 (commercial — product description):\n\"This skincare cream is made with natural shea butter and aloe vera. It moisturizes deeply, fights dryness, and is safe for sensitive skin. Apply twice daily for best results.\"\n\nPaste all three translations clearly labeled. Then in one short paragraph (English, 50 words max), explain one translation choice you made and why.\n\nNote: Your result will be reviewed by a human translator within 48 hours.",
        "context": "This is a diagnostic task to establish your current Translation level.",
        "expected_output_format": "text",
        "time_limit_minutes": 45
    }'::jsonb,
    'translate-yo-en-001',
    0.45,
    'Maxx Engage_seed'
FROM public.skill_paths sp
WHERE sp.slug = 'translation-yo-en'
ON CONFLICT DO NOTHING;
