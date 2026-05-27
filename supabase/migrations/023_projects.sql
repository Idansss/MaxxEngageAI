-- Maxx Engage — Migration 023: Phase 2 Projects
--
-- Adds multi-day project briefs. Each brief has a linked task record so the
-- existing grading + credential pipeline works without changes.

-- Allow 'project' as a task type
ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_type_check;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_type_check
    CHECK (type IN ('diagnostic','learning','assessment','refresh','project'));

-- ── project_briefs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_briefs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             TEXT        UNIQUE NOT NULL,
    skill_path_id    UUID        NOT NULL REFERENCES public.skill_paths(id),
    task_id          UUID        REFERENCES public.tasks(id),
    title            TEXT        NOT NULL,
    summary          TEXT        NOT NULL,
    brief_markdown   TEXT        NOT NULL,
    deliverables     JSONB       NOT NULL DEFAULT '[]',
    rubric_id        TEXT        NOT NULL,
    level            INTEGER     NOT NULL DEFAULT 1,
    estimated_days   INTEGER     NOT NULL DEFAULT 5,
    pass_threshold   INTEGER     NOT NULL DEFAULT 70,
    active           BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.project_briefs IS 'Multi-day real-world project briefs. Each links to a task record for grading.';
COMMENT ON COLUMN public.project_briefs.brief_markdown IS 'Full brief shown to the user, in Markdown.';
COMMENT ON COLUMN public.project_briefs.deliverables   IS '[{title, description, required}] list of what the user must submit.';
COMMENT ON COLUMN public.project_briefs.task_id        IS 'FK to tasks table so the existing assessment job pipeline can grade the submission.';

CREATE INDEX IF NOT EXISTS idx_project_briefs_skill_path ON public.project_briefs(skill_path_id);
CREATE INDEX IF NOT EXISTS idx_project_briefs_active      ON public.project_briefs(active) WHERE active = true;

ALTER TABLE public.project_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_briefs_public_read"
    ON public.project_briefs FOR SELECT USING (active = true);

-- ── Seed: 4 project briefs (one per Phase 1 skill path) ───────────────────────

-- We insert the task first, then the brief referencing it.
-- Using DO $$ blocks so we can capture the generated UUIDs.

DO $$
DECLARE
    sp_frontend UUID;
    sp_backend  UUID;
    sp_copy     UUID;
    sp_trans    UUID;
    t_frontend  UUID;
    t_backend   UUID;
    t_copy      UUID;
    t_trans     UUID;
BEGIN
    -- Look up skill path IDs
    SELECT id INTO sp_frontend FROM public.skill_paths WHERE slug = 'web-dev-frontend';
    SELECT id INTO sp_backend  FROM public.skill_paths WHERE slug = 'backend-api';
    SELECT id INTO sp_copy     FROM public.skill_paths WHERE slug = 'copywriting-en';
    SELECT id INTO sp_trans    FROM public.skill_paths WHERE slug = 'translation-yo-en';

    -- Only seed if the skill paths exist
    IF sp_frontend IS NULL OR sp_backend IS NULL OR sp_copy IS NULL OR sp_trans IS NULL THEN
        RAISE NOTICE 'Skill paths not found — skipping project brief seed.';
        RETURN;
    END IF;

    -- ── Task records (type='project') ─────────────────────────────────────────
    INSERT INTO public.tasks (id, skill_path_id, level, type, prompt, rubric_id, authored_by)
    VALUES (
        gen_random_uuid(), sp_frontend, 1, 'project',
        '{"text": "Build a portfolio page for a Lagos-based freelance web developer. Submit index.html, styles.css, and a brief README.md.", "expected_output_format": "multi-file"}'::jsonb,
        'web-dev-html-001', 'seed'
    ) RETURNING id INTO t_frontend;

    INSERT INTO public.tasks (id, skill_path_id, level, type, prompt, rubric_id, authored_by)
    VALUES (
        gen_random_uuid(), sp_backend, 1, 'project',
        '{"text": "Build a persistent task manager API. Submit your complete code and a README with setup instructions.", "expected_output_format": "multi-file"}'::jsonb,
        'backend-api-001', 'seed'
    ) RETURNING id INTO t_backend;

    INSERT INTO public.tasks (id, skill_path_id, level, type, prompt, rubric_id, authored_by)
    VALUES (
        gen_random_uuid(), sp_copy, 1, 'project',
        '{"text": "Write a product launch campaign for ChopNow, a food delivery app in Kano. Submit landing copy, 3 social posts, and a subject line.", "expected_output_format": "multi-file"}'::jsonb,
        'copy-en-001', 'seed'
    ) RETURNING id INTO t_copy;

    INSERT INTO public.tasks (id, skill_path_id, level, type, prompt, rubric_id, authored_by)
    VALUES (
        gen_random_uuid(), sp_trans, 1, 'project',
        '{"text": "Translate 8 Nigerian fintech app UI strings from English to Yoruba. Submit labeled translations, a 100-word rationale, and notes on cultural adaptations.", "expected_output_format": "multi-file"}'::jsonb,
        'translate-yo-en-001', 'seed'
    ) RETURNING id INTO t_trans;

    -- ── Project briefs ─────────────────────────────────────────────────────────
    INSERT INTO public.project_briefs
        (slug, skill_path_id, task_id, title, summary, brief_markdown, deliverables, rubric_id, level, estimated_days, pass_threshold)
    VALUES (
        'frontend-portfolio',
        sp_frontend,
        t_frontend,
        'Build a Freelancer Portfolio',
        'Design and build a complete, accessible HTML/CSS portfolio for a Lagos-based web developer.',
        E'## The Brief\n\nYour client is **Adaeze**, a Lagos-based freelance web developer looking for her first international clients. She needs a clean, professional portfolio page that works on mobile and showcases three projects.\n\n## What to Build\n\nA single-page portfolio including:\n- A hero section with her name, title, and a 2-sentence bio\n- A skills grid (at least 6 skills)\n- A projects section with 3 cards (each: title, 1-line description, tech tags, and a placeholder link)\n- A contact section with a mailto link\n\n## Requirements\n- Semantic HTML (use `<header>`, `<main>`, `<section>`, `<footer>`, etc.)\n- Responsive layout: looks good on 375px and 1280px\n- Accessible: every image has alt text, contrast passes WCAG AA, interactive elements are keyboard-focusable\n- No JS required — HTML and CSS only\n- No external CSS frameworks\n\n## Deliverables\nSubmit three files: `index.html`, `styles.css`, and a `README.md` explaining one design decision you made.',
        '[{"title": "index.html", "description": "Semantic, accessible HTML file", "required": true}, {"title": "styles.css", "description": "All styles — no inline or framework CSS", "required": true}, {"title": "README.md", "description": "One paragraph explaining a design decision", "required": true}]'::jsonb,
        'web-dev-html-001', 1, 3, 70
    );

    INSERT INTO public.project_briefs
        (slug, skill_path_id, task_id, title, summary, brief_markdown, deliverables, rubric_id, level, estimated_days, pass_threshold)
    VALUES (
        'backend-task-api',
        sp_backend,
        t_backend,
        'Build a Persistent Task Manager API',
        'Extend the task tracker with file-based persistence, filtering, and clean error handling.',
        E'## The Brief\n\nBuild a REST API for a task manager that **persists data to disk** so it survives restarts.\n\n## Endpoints\n\n| Method | Path | Description |\n|--------|------|-------------|\n| POST | /tasks | Create a task (title, description, status, dueDate) |\n| GET | /tasks | List all tasks — support `?status=` and `?due_before=` filters |\n| GET | /tasks/:id | Get one task |\n| PATCH | /tasks/:id | Update status or any field |\n| DELETE | /tasks/:id | Delete a task |\n\n## Requirements\n- Node.js + Express **or** Python + FastAPI **or** Python + Flask\n- Persist data to a local JSON file or SQLite database — no in-memory-only store\n- Validate all inputs; return HTTP 400 with a JSON error body for bad requests\n- Return 404 when a task ID is not found\n- Never leak stack traces to clients\n- Include a README comment at the top with: how to run, how to run tests (even if manual curl), sample requests\n\n## Deliverables\nSubmit your complete code file(s) and a README.',
        '[{"title": "app code", "description": "Your complete API code (app.py, app.js, etc.)", "required": true}, {"title": "README.md", "description": "How to run, sample curl commands", "required": true}]'::jsonb,
        'backend-api-001', 1, 5, 70
    );

    INSERT INTO public.project_briefs
        (slug, skill_path_id, task_id, title, summary, brief_markdown, deliverables, rubric_id, level, estimated_days, pass_threshold)
    VALUES (
        'copywriting-campaign',
        sp_copy,
        t_copy,
        'Write a Product Launch Campaign',
        'Write a full marketing campaign for ChopNow — a food delivery app launching in Kano, Nigeria.',
        E'## The Brief\n\n**ChopNow** is a new food delivery app launching in Kano, Nigeria. It connects home cooks and local restaurants to customers within a 5km radius. Delivery is under 30 minutes. The first month is free delivery.\n\n## Target Audience\nWorking adults aged 22–45 in Kano. They use WhatsApp daily, prefer Hausa over English in casual settings, but are comfortable reading English. They are price-conscious and skeptical of promises.\n\n## What to Write\n\n### 1. Landing page copy\n- Headline (max 10 words)\n- Subheadline (max 20 words)\n- Three feature bullets (4-word title + one sentence each)\n- CTA button label (max 4 words)\n- "Why ChopNow?" paragraph (max 60 words)\n\n### 2. Three social media posts\n- One launch announcement (Twitter/X format, max 280 chars)\n- One customer story post (Facebook format, 2–3 sentences)\n- One offer post highlighting free delivery (Instagram caption, 2–3 sentences + 3 hashtags)\n\n### 3. Email teaser\n- Subject line (max 8 words)\n- Preview text (max 15 words)\n\nWrite for the customer, not the investor. Be specific. Avoid generic startup language.',
        '[{"title": "Landing page copy", "description": "Headline, subheadline, bullets, CTA, Why paragraph", "required": true}, {"title": "Social media posts", "description": "Launch tweet, Facebook story, Instagram offer", "required": true}, {"title": "Email teaser", "description": "Subject line + preview text", "required": true}]'::jsonb,
        'copy-en-001', 1, 3, 70
    );

    INSERT INTO public.project_briefs
        (slug, skill_path_id, task_id, title, summary, brief_markdown, deliverables, rubric_id, level, estimated_days, pass_threshold)
    VALUES (
        'translation-fintech-ui',
        sp_trans,
        t_trans,
        'Localise a Fintech App to Yoruba',
        'Translate 8 UI strings from a Nigerian mobile banking app into natural, register-appropriate Yoruba.',
        E'## The Brief\n\nA Nigerian fintech startup is localising their mobile banking app into Yoruba. You will translate 8 UI strings. Each string has a **register** — match it.\n\n## Strings to Translate\n\n1. **[Formal — onboarding screen]** "Welcome to SafeVault. Your money is protected by bank-grade security."\n2. **[Action button]** "Send Money"\n3. **[Error message]** "Transaction failed. Please check your balance and try again."\n4. **[Casual — push notification]** "Hey! Your friend just sent you ₦2,000."\n5. **[Formal — terms]** "By continuing, you agree to our Terms of Service and Privacy Policy."\n6. **[Status label]** "Pending"\n7. **[Success message]** "Transfer successful! ₦5,000 has been sent to Chidi Okeke."\n8. **[Help text]** "Enter the 6-digit PIN you set when you created your account."\n\n## Requirements\n- Do not transliterate — translate\n- Match register: formal strings stay formal, casual strings can use everyday Yoruba\n- For terms with no direct Yoruba equivalent, render naturally rather than borrowing English\n- Label each translation clearly: **String 1:**, **String 2:**, etc.\n\n## Deliverables\n1. All 8 labeled translations\n2. A 100-word rationale explaining one register decision you made\n3. A short note on any cultural adaptations (e.g., how you handled currency amounts or names)',
        '[{"title": "8 labeled translations", "description": "String 1 through String 8, clearly labeled", "required": true}, {"title": "Rationale", "description": "100 words on one register decision", "required": true}, {"title": "Cultural adaptation notes", "description": "Brief notes on adaptations made", "required": false}]'::jsonb,
        'translate-yo-en-001', 1, 3, 75
    );

END $$;
