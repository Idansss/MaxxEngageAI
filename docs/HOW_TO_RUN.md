# How to Run Maxx Engage Backend (Local Dev)

## Prerequisites
- Python 3.11+
- An Anthropic API key (get one at console.anthropic.com)

## Setup

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY at minimum
```

## Run the API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

API docs (Swagger UI): http://localhost:8000/docs

## Test the /assess endpoint

```bash
curl -X POST http://localhost:8000/assess \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "00000000-0000-0000-0000-000000000001",
    "skill_path_slug": "web-dev-frontend",
    "level": 1,
    "submission_type": "html_css_js",
    "content": "<article class=\"card\"><img src=\"placeholder.jpg\" alt=\"Wireless headphones\"><h2>SoundMax Pro</h2><p>Studio quality sound.</p><p class=\"price\">₦85,000</p><button type=\"button\">Add to Cart</button></article>",
    "rubric_id": "web-dev-html-001"
  }'
```

## Run calibration eval

```bash
python -m pytest evals/ -v   # (eval runner coming in next sprint)
```
