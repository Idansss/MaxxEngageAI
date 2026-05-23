"""
Grading service: sends a submission + rubric to Claude, parses structured JSON output,
computes overall score, determines credential eligibility and human review triggers.
"""

import hashlib
import json
import uuid
from pathlib import Path

import anthropic
from json_repair import repair_json
from app.core.config import get_settings
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse, DimensionScore, ReviewFeedback

RUBRICS_DIR = Path(__file__).parent.parent.parent.parent / "rubrics"

SYSTEM_PROMPT = """You are a rigorous, fair, and transparent skills assessor for ProofOS — a public-benefit platform that gives global talent a way to prove their competence.

Your role:
- Grade submitted work ONLY against the rubric dimensions provided.
- Be specific: quote exact lines from the submission when citing evidence.
- Be honest: a mediocre submission gets a mediocre score. False praise harms the user.
- Be constructive: every weakness must have a concrete improvement suggestion.
- Be calibrated: your confidence score reflects genuine uncertainty, not politeness.

Non-negotiable rules:
1. Return ONLY valid JSON matching the schema provided. No markdown fences, no prose outside the JSON.
2. The `rationale` for each dimension must be written in plain English a non-expert can understand.
3. If you cannot assess a dimension confidently (e.g., submission is too short), set confidence < 0.5 and explain why.
4. Never fabricate evidence quotes. Only quote text that actually appears in the submission.
5. CRITICAL: When mentioning HTML tags or attributes inside a JSON string value, ALWAYS use single quotes for HTML attributes. Write <button type='button'> NOT <button type="button">. Double quotes inside a JSON string will break the JSON — use single quotes exclusively for all HTML attribute values in your rationale text.
"""

GRADING_PROMPT_TEMPLATE = """
## Task Context
Skill path: {skill_path_slug} (Level {level})
Task ID: {task_id}
Submission type: {submission_type}

## Rubric
{rubric_json}

## User Submission
```
{content}
```

## Required Output Format
Return a single JSON object with this exact structure:
{{
  "scores": [
    {{
      "dimension": "<dimension name from rubric>",
      "score": <number>,
      "max_score": <number from rubric>,
      "rationale": "<plain English explanation>",
      "evidence_quotes": ["<exact quote from submission>"]
    }}
  ],
  "overall_score": <weighted sum normalized to 0-100>,
  "confidence": <0.0-1.0>,
  "feedback": {{
    "summary": "<2-4 sentence overview>",
    "strengths": ["<specific strength>"],
    "improvements": ["<specific, actionable improvement>"],
    "next_steps": ["<learning resource or next task recommendation>"]
  }}
}}
"""


def _load_rubric(rubric_id: str) -> dict:
    rubric_path = RUBRICS_DIR / f"{rubric_id}.json"
    if not rubric_path.exists():
        raise FileNotFoundError(f"Rubric not found: {rubric_path}")
    return json.loads(rubric_path.read_text(encoding="utf-8"))


def _compute_prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()[:16]


def _extract_json(raw: str) -> dict:
    """Parse JSON from model output that may be wrapped in markdown fences or contain minor errors."""
    text = raw.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    if text.startswith("```"):
        lines = text.splitlines()
        inner = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        text = inner.strip()
    # Try direct parse first (fastest path)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Attempt structural repair (handles unterminated strings, unescaped quotes, trailing commas)
    try:
        repaired = repair_json(text, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return repaired
    except Exception:
        pass
    # Last resort: find the outermost { } block and repair that
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        fragment = text[start : end + 1]
        try:
            return json.loads(fragment)
        except json.JSONDecodeError:
            repaired = repair_json(fragment, return_objects=True)
            if isinstance(repaired, dict) and repaired:
                return repaired
    raise ValueError("No valid JSON object found in model response")


def _needs_human_review(
    overall_score: float, confidence: float, settings
) -> bool:
    near_threshold = abs(overall_score - settings.pass_score_threshold) <= settings.human_review_score_band
    low_confidence = confidence < settings.ai_confidence_threshold
    return near_threshold or low_confidence


async def grade_submission(request: AssessRequest) -> AssessResponse:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    rubric = _load_rubric(request.rubric_id)

    grading_prompt = GRADING_PROMPT_TEMPLATE.format(
        skill_path_slug=request.skill_path_slug,
        level=request.level,
        task_id=request.task_id,
        submission_type=request.submission_type,
        rubric_json=json.dumps(rubric, indent=2),
        content=request.content,
    )
    prompt_hash = _compute_prompt_hash(SYSTEM_PROMPT + grading_prompt)

    log = logger.bind(
        task_id=request.task_id,
        rubric_id=request.rubric_id,
        model=settings.primary_grading_model,
    )
    log.info("grading.start")

    message = client.messages.create(
        model=settings.primary_grading_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": grading_prompt}],
    )

    raw = message.content[0].text.strip()
    log.info("grading.raw_response_received", length=len(raw))

    try:
        result = _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log.error("grading.json_parse_error", error=str(e), raw=raw[:500])
        raise ValueError(f"Model returned non-JSON output: {e}") from e

    scores = [DimensionScore(**s) for s in result["scores"]]
    overall_score = float(result["overall_score"])
    confidence = float(result["confidence"])
    feedback = ReviewFeedback(**result["feedback"])

    passed = overall_score >= settings.pass_score_threshold
    human_review_requested = _needs_human_review(overall_score, confidence, settings)
    credential_eligible = passed and not human_review_requested

    review_id = str(uuid.uuid4())

    log.info(
        "grading.complete",
        overall_score=overall_score,
        confidence=confidence,
        passed=passed,
        human_review_requested=human_review_requested,
    )

    return AssessResponse(
        task_id=request.task_id,
        overall_score=round(overall_score, 2),
        pass_threshold=settings.pass_score_threshold,
        passed=passed,
        confidence=round(confidence, 3),
        scores=scores,
        feedback=feedback,
        credential_eligible=credential_eligible,
        human_review_requested=human_review_requested,
        model_used=settings.primary_grading_model,
        prompt_hash=prompt_hash,
        review_id=review_id,
    )
