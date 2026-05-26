"""
Learning path service: generates a personalized week-by-week roadmap from a
diagnostic score using Claude. All resources are free and Africa-accessible.
"""

import json
from datetime import date, timedelta

import anthropic
from json_repair import repair_json

from app.core.config import get_settings
from app.core.logging import logger
from app.models.learn_path import (
    LearnPathRequest,
    LearnPathResponse,
    MilestoneAssessment,
    Resource,
    WeekPlan,
)

PASS_THRESHOLD = 70

# Score bands determine duration and starting depth
def _duration_weeks(score: float, hours_per_week: int) -> int:
    if score < 25:
        return 12
    if score < 45:
        return 10
    if score < 60:
        return 8
    if score < PASS_THRESHOLD:
        return 6
    return 4  # Already passing — polish and refresh path


def _level_from_score(score: float) -> tuple[int, str]:
    if score < 40:
        return 1, "Foundations — Early"
    if score < 60:
        return 1, "Foundations — Developing"
    if score < PASS_THRESHOLD:
        return 1, "Foundations — Near-Pass"
    return 2, "Practitioner"


# Curated free resource pool — verified accessible from Africa, no paywall
FREE_RESOURCES: dict[str, list[dict]] = {
    "html_semantics": [
        {"title": "MDN: HTML elements reference", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element", "type": "reference", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "web.dev: Document and website structure", "url": "https://web.dev/learn/html/document-structure", "type": "article", "estimated_minutes": 25, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "freeCodeCamp: Basic HTML and HTML5", "url": "https://www.freecodecamp.org/learn/responsive-web-design/#basic-html-and-html5", "type": "interactive", "estimated_minutes": 120, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
    "css_quality": [
        {"title": "MDN: CSS first steps", "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/First_steps", "type": "article", "estimated_minutes": 60, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "web.dev: Learn CSS", "url": "https://web.dev/learn/css", "type": "interactive", "estimated_minutes": 180, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "The Odin Project: Foundations CSS", "url": "https://www.theodinproject.com/paths/foundations/courses/foundations#css-foundations", "type": "interactive", "estimated_minutes": 240, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
    "responsiveness": [
        {"title": "web.dev: Responsive design", "url": "https://web.dev/learn/design", "type": "article", "estimated_minutes": 90, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "MDN: Responsive design guide", "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design", "type": "article", "estimated_minutes": 45, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "freeCodeCamp: Responsive Web Design", "url": "https://www.freecodecamp.org/learn/2022/responsive-web-design/", "type": "interactive", "estimated_minutes": 300, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
    "accessibility": [
        {"title": "web.dev: Learn Accessibility", "url": "https://web.dev/learn/accessibility", "type": "article", "estimated_minutes": 120, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "MDN: Accessibility basics", "url": "https://developer.mozilla.org/en-US/docs/Learn/Accessibility/HTML", "type": "article", "estimated_minutes": 40, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "The A11Y Project: Quick wins checklist", "url": "https://www.a11yproject.com/checklist/", "type": "reference", "estimated_minutes": 20, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "project_practice": [
        {"title": "Frontend Mentor: Newbie challenges", "url": "https://www.frontendmentor.io/challenges?difficulties=1", "type": "project", "estimated_minutes": 180, "low_bandwidth_friendly": False, "requires_signup": True},
        {"title": "The Odin Project: Landing page project", "url": "https://www.theodinproject.com/lessons/foundations-landing-page", "type": "project", "estimated_minutes": 240, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
}

SYSTEM_PROMPT = """You are a world-class curriculum designer for Maxx Engage — a public-benefit platform that helps African digital talent prove competence.

Your task: design a personalized, week-by-week learning path for a user based on their diagnostic score.

Rules:
1. Every resource you recommend MUST come from the curated pool provided. Do not invent URLs.
2. The plan must be realistic for the stated hours per week. Do not overload.
3. Practice tasks must be concrete and buildable — not "learn about X" but "build Y".
4. The path_rationale must explain the choice in plain English the user can understand.
5. Week themes must progress logically — from gaps to strengths to integration.
6. Return ONLY valid JSON. No markdown fences. No prose outside the JSON.
7. When mentioning HTML tags inside JSON strings, always use single quotes for attributes.
"""

LEARNING_PROMPT_TEMPLATE = """
## User Context
Skill path: {skill_path_slug}
Diagnostic score: {diagnostic_score}/100  (pass threshold: 70)
Score gap to pass: {score_gap}
Available: {hours_per_week} hours/week
Duration: {duration_weeks} weeks
Weak dimensions from diagnostic: {weak_dimensions}
Preferred language: {preferred_language}

## Curated Resource Pool (use ONLY these — do not invent URLs)
{resource_pool}

## Required Output Schema
Return a single JSON object:
{{
  "path_rationale": "<2-3 sentences explaining why this specific path suits this score>",
  "weekly_plan": [
    {{
      "week": 1,
      "theme": "<theme title>",
      "focus_areas": ["<specific topic>", "<specific topic>"],
      "resources": [
        {{
          "title": "<exact title from pool>",
          "url": "<exact url from pool>",
          "type": "<type from pool>",
          "estimated_minutes": <number>,
          "free": true,
          "requires_signup": <bool>,
          "low_bandwidth_friendly": <bool>
        }}
      ],
      "practice_task": "<one concrete thing to build this week>",
      "estimated_hours": <number — must match hours_per_week>,
      "is_assessment_week": false
    }}
  ],
  "milestone_assessments": [
    {{
      "after_week": <week number>,
      "rubric_id": "web-dev-html-001",
      "description": "<what this checkpoint tests>",
      "expected_score_range": [<min>, <max>]
    }}
  ]
}}

Design {duration_weeks} weeks. Place milestone assessments at the midpoint and final week.
The final week must have is_assessment_week: true.
"""


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        text = inner.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        repaired = repair_json(text, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return repaired
    except Exception:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        fragment = text[start:end + 1]
        try:
            return json.loads(fragment)
        except json.JSONDecodeError:
            repaired = repair_json(fragment, return_objects=True)
            if isinstance(repaired, dict) and repaired:
                return repaired
    raise ValueError("No valid JSON found in model response")


def _next_assessment_date(weeks_until: int) -> str:
    return (date.today() + timedelta(weeks=weeks_until)).isoformat()


async def generate_learn_path(request: LearnPathRequest) -> LearnPathResponse:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    duration = _duration_weeks(request.diagnostic_score, request.available_hours_per_week)
    level, level_label = _level_from_score(request.diagnostic_score)
    score_gap = max(0.0, PASS_THRESHOLD - request.diagnostic_score)

    # Pick relevant resources based on weak dimensions (or all if none specified)
    focus = request.weak_dimensions if request.weak_dimensions else list(FREE_RESOURCES.keys())
    resource_pool = {k: FREE_RESOURCES[k] for k in focus if k in FREE_RESOURCES}
    if not resource_pool:
        resource_pool = FREE_RESOURCES
    # Always include project practice
    resource_pool["project_practice"] = FREE_RESOURCES["project_practice"]

    prompt = LEARNING_PROMPT_TEMPLATE.format(
        skill_path_slug=request.skill_path_slug,
        diagnostic_score=request.diagnostic_score,
        score_gap=round(score_gap, 1),
        hours_per_week=request.available_hours_per_week,
        duration_weeks=duration,
        weak_dimensions=", ".join(request.weak_dimensions) if request.weak_dimensions else "not specified — address all dimensions",
        preferred_language=request.preferred_language,
        resource_pool=json.dumps(resource_pool, indent=2),
    )

    log = logger.bind(
        skill_path=request.skill_path_slug,
        score=request.diagnostic_score,
        duration_weeks=duration,
    )
    log.info("learning.generate.start")

    message = client.messages.create(
        model=settings.primary_grading_model,
        max_tokens=6000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    log.info("learning.generate.response_received", length=len(raw))

    result = _extract_json(raw)

    weekly_plan = [WeekPlan(**w) for w in result["weekly_plan"]]
    milestones = [MilestoneAssessment(**m) for m in result["milestone_assessments"]]
    total_hours = sum(w.estimated_hours for w in weekly_plan)

    # First milestone week determines next assessment date
    first_milestone = min((m.after_week for m in milestones), default=duration)

    log.info("learning.generate.complete", weeks=len(weekly_plan), milestones=len(milestones))

    return LearnPathResponse(
        skill_path_slug=request.skill_path_slug,
        user_id=request.user_id,
        diagnostic_score=request.diagnostic_score,
        current_level=level,
        level_label=level_label,
        score_gap_to_pass=round(score_gap, 1),
        duration_weeks=duration,
        total_estimated_hours=total_hours,
        weekly_plan=weekly_plan,
        milestone_assessments=milestones,
        path_rationale=result["path_rationale"],
        next_assessment_date=_next_assessment_date(first_milestone),
    )
