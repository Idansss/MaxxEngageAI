"""
End-to-end test: user creation → assessment → credential issuance.

Requires the backend server to be running:
    cd backend && uvicorn app.main:app --reload

Usage:
    python scripts/test_e2e_credential.py
"""

import asyncio
import json
import sys
from pathlib import Path

import asyncpg
import httpx
from dotenv import load_dotenv
import os
import re

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

BASE_URL = "http://localhost:8000"

SAMPLE_SUBMISSION = """<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <title>Mama Titi's Kitchen</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; color: #222; }
    nav { background: #b5451b; padding: 1rem 2rem; display: flex; gap: 2rem; }
    nav a { color: #fff; text-decoration: none; font-weight: 600; }
    nav a:hover { text-decoration: underline; }
    .hero { background: #fdf3e7; padding: 4rem 2rem; text-align: center; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.1rem; margin-bottom: 2rem; color: #555; }
    .cta { background: #b5451b; color: #fff; padding: 0.8rem 2rem;
           border: none; border-radius: 4px; font-size: 1rem; cursor: pointer;
           text-decoration: none; display: inline-block; }
    .features { padding: 3rem 2rem; display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; }
    .card h3 { margin-bottom: 0.5rem; }
    footer { background: #222; color: #eee; padding: 2rem; text-align: center; }
  </style>
</head>
<body>
  <nav>
    <a href='#home'>Home</a>
    <a href='#menu'>Menu</a>
    <a href='#contact'>Contact</a>
  </nav>
  <section class='hero' id='home'>
    <h1>Authentic Nigerian Cuisine</h1>
    <p>Fresh ingredients, traditional recipes, delivered to your door.</p>
    <a href='#menu' class='cta'>See Our Menu</a>
  </section>
  <section class='features' id='menu' aria-label='Our Services'>
    <article class='card'>
      <h3>Daily Specials</h3>
      <p>Chef-curated meals that change every day using seasonal produce.</p>
    </article>
    <article class='card'>
      <h3>Catering</h3>
      <p>We handle events of any size — weddings, birthdays, corporate.</p>
    </article>
    <article class='card'>
      <h3>Fast Delivery</h3>
      <p>Order by 11am, delivered hot to your door by 1pm.</p>
    </article>
  </section>
  <footer id='contact'>
    <p>Mama Titi's Kitchen &mdash; Lagos, Nigeria</p>
    <p>Tel: +234 801 234 5678 &nbsp;|&nbsp; Email: hello@mamatiti.ng</p>
  </footer>
</body>
</html>"""


def _asyncpg_url(raw: str) -> str:
    return re.sub(r"^postgresql\+asyncpg://", "postgresql://", raw)


async def get_task_id() -> str:
    url = _asyncpg_url(os.environ["DATABASE_URL"])
    conn = await asyncpg.connect(url, ssl="require")
    row = await conn.fetchrow(
        "SELECT id FROM public.tasks WHERE rubric_id = 'web-dev-html-001' LIMIT 1"
    )
    await conn.close()
    if not row:
        print("ERROR: No task found with rubric_id='web-dev-html-001'. Run migrations first.")
        sys.exit(1)
    return str(row["id"])


def sep(label: str):
    print(f"\n{'-' * 60}")
    print(f"  {label}")
    print('-' * 60)


async def run():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=120) as client:

        # ── 1. Health check ───────────────────────────────────────────
        sep("1. Health check")
        r = await client.get("/health")
        assert r.status_code == 200, f"Server not running: {r.status_code}"
        print("OK:", r.json())

        # ── 2. Create user ────────────────────────────────────────────
        sep("2. POST /users")
        r = await client.post("/users", json={
            "display_name": "Amara Okafor",
            "country_code": "NG",
            "preferred_language": "en",
            "bio": "Frontend learner from Lagos",
            "public_profile": True,
        })
        assert r.status_code == 201, f"Create user failed: {r.status_code} {r.text}"
        user = r.json()
        print(f"Created user: {user['id']}")
        print(f"DID: {user['did']}")
        user_id = user["id"]

        # ── 3. Fetch seeded task_id from DB ───────────────────────────
        sep("3. Fetch task_id from DB")
        task_id = await get_task_id()
        print(f"task_id: {task_id}")

        # ── 4. Submit for grading ─────────────────────────────────────
        sep("4. POST /assess")
        print("Sending submission to Claude... (may take 10-20s)")
        r = await client.post("/assess", json={
            "task_id": task_id,
            "skill_path_slug": "web-dev-frontend",
            "level": 1,
            "submission_type": "html_css_js",
            "content": SAMPLE_SUBMISSION,
            "rubric_id": "web-dev-html-001",
            "user_id": user_id,
        })
        assert r.status_code == 200, f"Assess failed: {r.status_code} {r.text}"
        result = r.json()

        print(f"Overall score:     {result['overall_score']}")
        print(f"Passed:            {result['passed']}")
        print(f"Confidence:        {result['confidence']}")
        print(f"Credential eligible: {result['credential_eligible']}")
        print(f"Human review:      {result['human_review_requested']}")
        print(f"submission_id:     {result['submission_id']}")
        print(f"review_id:         {result['review_id']}")
        print(f"credential_id:     {result['credential_id']}")

        # ── 5. Verify DB records ──────────────────────────────────────
        sep("5. Verify DB records")
        db_url = _asyncpg_url(os.environ["DATABASE_URL"])
        conn = await asyncpg.connect(db_url, ssl="require")

        sub = await conn.fetchrow(
            "SELECT id, status, review_id FROM public.submissions WHERE id = $1::uuid",
            result["submission_id"],
        )
        assert sub, "Submission not found in DB"
        print(f"submissions row: status={sub['status']}, review_id linked={sub['review_id'] is not None}")

        rev = await conn.fetchrow(
            "SELECT overall_score, credential_eligible FROM public.reviews WHERE id = $1::uuid",
            result["review_id"],
        )
        assert rev, "Review not found in DB"
        print(f"reviews row: score={rev['overall_score']}, credential_eligible={rev['credential_eligible']}")

        if result["credential_id"]:
            assert result["credential_id"].startswith("cred_"), "Credential ID must use public cred_ prefix"
            cred = await conn.fetchrow(
                """
                SELECT public_id, level_label, score, vc_document
                FROM public.credentials
                WHERE public_id = $1 OR id::text = $1
                """,
                result["credential_id"],
            )
            assert cred, "Credential not found in DB"
            vc = cred["vc_document"] if isinstance(cred["vc_document"], dict) else json.loads(cred["vc_document"])
            print(f"credentials row: public_id={cred['public_id']}")
            print(f"credentials row: level_label={cred['level_label']}, score={cred['score']}")
            print(f"VC type: {vc.get('type')}")
            print(f"VC issuer: {vc.get('issuer', {}).get('id')}")
            print(f"VC subject DID: {vc.get('credentialSubject', {}).get('id')}")
        else:
            print("No credential issued (score below threshold or human review required)")

        await conn.close()

        sep("RESULT")
        if result["credential_id"]:
            print("SUCCESS — full credential issuance pipeline verified.")
        else:
            print(f"Grading OK — no credential (score={result['overall_score']}, eligible={result['credential_eligible']})")


if __name__ == "__main__":
    asyncio.run(run())
