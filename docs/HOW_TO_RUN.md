# How to Run Maxx Engage Locally

This runbook covers the local backend, frontend, migrations, and Phase 1 smoke
checks for the assessment to credential to verify loop.

## Prerequisites

- Python 3.11+
- Node.js 20+
- A configured `backend/.env`
- A reachable Postgres database from `DATABASE_URL`
- An Anthropic API key for live grading flows

## Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least `DATABASE_URL` and `ANTHROPIC_API_KEY`.

On Windows PowerShell, set UTF-8 mode before running the backend or migration
scripts. This avoids `.env` decoding failures from dependencies that read the
file using the active Windows code page.

```powershell
$env:PYTHONUTF8='1'
```

## Apply Migrations

Run migrations from the repository root:

```powershell
$env:PYTHONUTF8='1'
backend\.venv\Scripts\python.exe scripts\apply_migrations.py
```

The migration runner is idempotent and records applied files in
`public.schema_migrations`.

## Run the Backend

```powershell
cd backend
$env:PYTHONUTF8='1'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs are available at:

```text
http://127.0.0.1:8000/docs
```

## Frontend Setup

```powershell
cd frontend
npm install
npm run build
npm run start -- -p 3000
```

The local site is available at:

```text
http://localhost:3000
```

## Phase 1 Smoke Check

With the backend and frontend running, execute:

```powershell
$env:PYTHONUTF8='1'
backend\.venv\Scripts\python.exe scripts\smoke_phase1.py
```

The smoke script verifies:

- all four Phase 1 skill paths exist
- each Phase 1 rubric resolves to an adaptive task
- the credential table contains the Phase 1 contract columns
- verify event logging storage exists
- the translation rubric requires human review
- backend `/health`, `/skill-paths`, `/assess/adaptive-task`, and `/verify` respond correctly
- frontend `/assess` and `/verify` load

It does not create users, submit assessment work, call the AI grader, or issue
credentials.

## Manual Phase 1 Loop

After the smoke check passes, manually verify the founder-facing flow:

1. Create a new account.
2. Set a username on the Identity page.
3. Start the Backend Development assessment.
4. Submit passing work.
5. Open the proof page at `/u/your_username`.
6. Copy the credential link.
7. Open `/verify` in a private browser window.
8. Paste the link and confirm the verified credential card appears.

Translation assessments should show pending human review and should not auto-issue
credentials in Phase 1.
