# Deployment and Infrastructure Status

Checked on 2026-05-25.

## Frontend

- Public URL confirmed live: https://maxx-engage-ai.vercel.app
- GitHub repo advertises the same URL.
- GitHub deployments API shows a successful Vercel deployment created at
  `2026-05-25T19:29:10Z` for commit `1bd1e34`.

Observed issue:

- The live page renders `Loading skill paths...`, which means the production
  frontend is not successfully loading the backend `/skill-paths` API.
- Most likely causes:
  - `NEXT_PUBLIC_API_URL` is missing in Vercel production.
  - `NEXT_PUBLIC_API_URL` still points to `http://localhost:8000`.
  - The backend is not live or CORS rejects the Vercel origin.

## Backend

- Railway config exists at `backend/railway.toml`.
- Backend start command is:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Not confirmed:

- No Railway CLI or `RAILWAY_TOKEN` is available in this environment.
- No Render config or `RENDER_API_KEY` is available in this environment.
- Common guessed Railway URLs returned `404`, so the backend live URL is still unknown.

## Production Environment Variables

Production templates now exist:

- `backend/.env.production.example`
- `frontend/.env.production.example`

Required frontend production variables:

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-DOMAIN
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_EMAILS=
```

Required backend production variables are listed in
`backend/.env.production.example`.

## CORS

Backend production CORS must be locked to:

```env
CORS_ORIGINS=https://maxx-engage-ai.vercel.app
```

The backend now rejects production startup when `CORS_ORIGINS` contains `*`,
`http://localhost...`, or `http://127.0.0.1...`.

## Next Actions

1. Find or create the backend service URL on Railway or Render.
2. Set Vercel production `NEXT_PUBLIC_API_URL` to that backend URL.
3. Set backend production `CORS_ORIGINS` to `https://maxx-engage-ai.vercel.app`.
4. Hit:

```text
https://YOUR-BACKEND-DOMAIN/health
https://YOUR-BACKEND-DOMAIN/skill-paths
https://maxx-engage-ai.vercel.app
```

The frontend is not fully healthy until `Available skill paths` shows real data
instead of `Loading skill paths...`.
