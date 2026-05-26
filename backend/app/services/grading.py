"""
Grading service: sends a submission + rubric to Claude, parses structured JSON output,
computes overall score, determines credential eligibility and human review triggers.
"""

import hashlib
import json
import uuid
from pathlib import Path

import anthropic
from openai import OpenAI
from json_repair import repair_json
from app.core.config import get_settings
from app.core.logging import logger
from app.core.tracing import start_langsmith_run
from app.models.assess import AssessRequest, AssessResponse, DimensionScore, ReviewFeedback

RUBRICS_DIR = Path(__file__).parent.parent.parent.parent / "rubrics"

SYSTEM_PROMPT = """You are a rigorous, fair, and transparent skills assessor for Maxx Engage — a public-benefit platform that gives global talent a way to prove their competence.

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

PRIOR_SCORES_SECTION = """
## Learner History (for calibration context only — do NOT let this change rubric scores)
This learner has {attempt_count} prior submission(s) for this skill path.
Scores (oldest to newest): {scores_str}
Mean: {mean:.1f} | Std dev: {std_dev:.1f}
Trajectory: {trajectory}

Use this to add a single sentence on progression to the feedback summary ONLY.
Rubric dimension scores must reflect this submission alone.
"""

GRADING_PROMPT_TEMPLATE = """
## Task Context
Skill path: {skill_path_slug} (Level {level})
Task ID: {task_id}
Submission type: {submission_type}
{prior_scores_section}
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


def _coerce_result(result: dict) -> tuple[list[DimensionScore], float, float, ReviewFeedback]:
    scores = [DimensionScore(**s) for s in result["scores"]]
    overall_score = float(result["overall_score"])
    confidence = float(result["confidence"])
    feedback = ReviewFeedback(**result["feedback"])
    return scores, overall_score, confidence, feedback


def _build_prior_scores_section(prior_scores: list[float]) -> str:
    if len(prior_scores) < 2:
        return ""
    import math as _math
    mean = sum(prior_scores) / len(prior_scores)
    variance = sum((s - mean) ** 2 for s in prior_scores) / len(prior_scores)
    std_dev = _math.sqrt(variance)
    scores_str = ", ".join(f"{s:.0f}" for s in prior_scores)
    if prior_scores[-1] > prior_scores[0]:
        trajectory = "improving"
    elif prior_scores[-1] < prior_scores[0]:
        trajectory = "declining"
    else:
        trajectory = "stable"
    return PRIOR_SCORES_SECTION.format(
        attempt_count=len(prior_scores),
        scores_str=scores_str,
        mean=mean,
        std_dev=std_dev,
        trajectory=trajectory,
    )


async def grade_submission(
    request: AssessRequest,
    prior_scores: list[float] | None = None,
) -> AssessResponse:
    settings = get_settings()

    rubric = _load_rubric(request.rubric_id)

    prior_section = _build_prior_scores_section(prior_scores or [])

    grading_prompt = GRADING_PROMPT_TEMPLATE.format(
        skill_path_slug=request.skill_path_slug,
        level=request.level,
        task_id=request.task_id,
        submission_type=request.submission_type,
        prior_scores_section=prior_section,
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
    trace_run = start_langsmith_run(
        name="grade_submission",
        run_type="llm",
        inputs={
            "skill_path_slug": request.skill_path_slug,
            "level": request.level,
            "rubric_id": request.rubric_id,
            "submission_type": request.submission_type,
            "content_preview": request.content[:4000],
        },
        metadata={
            "task_id": request.task_id,
            "model": settings.primary_grading_model,
            "prompt_hash": prompt_hash,
        },
    )

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model=settings.primary_grading_model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": grading_prompt}],
        )
    except Exception as e:
        trace_run.finish(error=str(e))
        raise

    raw = message.content[0].text.strip()
    log.info("grading.raw_response_received", length=len(raw))

    try:
        result = _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log.error("grading.json_parse_error", error=str(e), raw=raw[:500])
        trace_run.finish(error=f"Model returned non-JSON output: {e}")
        raise ValueError(f"Model returned non-JSON output: {e}") from e

    scores, overall_score, confidence, feedback = _coerce_result(result)

    passed = overall_score >= settings.pass_score_threshold
    human_review_requested = _needs_human_review(overall_score, confidence, settings)
    credential_eligible = passed and not human_review_requested

    secondary_overall_score: float | None = None
    model_disagreement = False
    model_disagreement_reason: str | None = None

    should_crosscheck = confidence < settings.ai_confidence_threshold or human_review_requested

    if should_crosscheck and settings.openai_api_key and settings.secondary_grading_model:
        secondary_trace = start_langsmith_run(
            name="grade_submission_secondary",
            run_type="llm",
            inputs={
                "skill_path_slug": request.skill_path_slug,
                "level": request.level,
                "rubric_id": request.rubric_id,
                "submission_type": request.submission_type,
                "content_preview": request.content[:4000],
            },
            metadata={
                "task_id": request.task_id,
                "model": settings.secondary_grading_model,
                "prompt_hash": prompt_hash,
            },
        )
        try:
            secondary_client = OpenAI(api_key=settings.openai_api_key)
            secondary = secondary_client.chat.completions.create(
                model=settings.secondary_grading_model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": grading_prompt},
                ],
            )
            secondary_raw = secondary.choices[0].message.content or ""
            secondary_result = _extract_json(secondary_raw)
            _, secondary_score, secondary_confidence, _ = _coerce_result(secondary_result)
            secondary_overall_score = round(secondary_score, 2)
            secondary_passed = secondary_score >= settings.pass_score_threshold
            score_delta = abs(overall_score - secondary_score)
            pass_disagreement = passed != secondary_passed
            if score_delta >= settings.model_disagreement_score_threshold or pass_disagreement:
                model_disagreement = True
                model_disagreement_reason = (
                    f"Primary score {overall_score:.1f}, secondary score {secondary_score:.1f}; "
                    f"delta {score_delta:.1f}."
                )
                human_review_requested = True
                credential_eligible = False
                confidence = min(confidence, secondary_confidence, 0.6)
                feedback.summary = (
                    f"{feedback.summary} A second model disagreed enough that this submission "
                    "requires human review before any credential is issued."
                )
            secondary_trace.finish(
                outputs={
                    "overall_score": secondary_overall_score,
                    "confidence": round(secondary_confidence, 3),
                    "model_disagreement": model_disagreement,
                }
            )
        except Exception as e:
            logger.warning(
                "grading.secondary_failed",
                model=settings.secondary_grading_model,
                error=str(e),
            )
            secondary_trace.finish(error=str(e))

    review_id = str(uuid.uuid4())

    log.info(
        "grading.complete",
        overall_score=overall_score,
        confidence=confidence,
        passed=passed,
        human_review_requested=human_review_requested,
        secondary_model=settings.secondary_grading_model if secondary_overall_score is not None else None,
        secondary_overall_score=secondary_overall_score,
        model_disagreement=model_disagreement,
    )
    trace_run.finish(
        outputs={
            "overall_score": round(overall_score, 2),
            "confidence": round(confidence, 3),
            "passed": passed,
            "credential_eligible": credential_eligible,
            "human_review_requested": human_review_requested,
            "secondary_model": settings.secondary_grading_model if secondary_overall_score is not None else None,
            "secondary_overall_score": secondary_overall_score,
            "model_disagreement": model_disagreement,
        }
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
        secondary_model_used=settings.secondary_grading_model if secondary_overall_score is not None else None,
        secondary_overall_score=secondary_overall_score,
        model_disagreement=model_disagreement,
        model_disagreement_reason=model_disagreement_reason,
    )
