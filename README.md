# Maxx Engage AI

Maxx Engage is a verified competence engine for global digital talent. It helps people demonstrate practical ability through evidence-based assessments, transparent rubrics, peer review, learning paths, and portable credentials.

[Open the live application](https://maxx-engage-ai.vercel.app)

## Core capabilities

- Real-world assessments and rubric-based evaluation
- AI-assisted review with human appeal paths
- Skill profiles, learning paths, projects, and talent discovery
- Peer review, leaderboards, community, and administration
- W3C Verifiable Credential and decentralized identity foundations
- Public credential verification and user-controlled proof of skill

The product is governed by principles including explainable scores, model plurality, privacy, open-source defaults, and human review for consequential AI judgments. Read the full [`MANIFESTO.md`](MANIFESTO.md).

## Architecture

```text
frontend/   Next.js 16, React 19, TypeScript, Supabase, TanStack Query
backend/    FastAPI, Pydantic, PostgreSQL/Supabase, Anthropic, OpenAI
```

The backend provides authentication, assessment, credential, identity, review, learning, project, talent, and verification APIs. The frontend provides the public and authenticated product experience.

## Local development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

On non-Windows shells, activate the environment with `source .venv/bin/activate`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend API URL, Supabase public settings, and the backend database, authentication, and model-provider settings in local environment files. Never commit real secrets.

## Verification

```bash
cd backend
pytest

cd ../frontend
npm run lint
npm run build
```

## License

Maxx Engage AI is released under the [GNU Affero General Public License v3.0](LICENSE).
