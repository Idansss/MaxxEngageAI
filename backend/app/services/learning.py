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
    # ── Web development ─────────────────────────────────────────────────────
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
    # ── Backend / API ────────────────────────────────────────────────────────
    "api_design": [
        {"title": "MDN: HTTP overview", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview", "type": "article", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "REST API Tutorial", "url": "https://restfulapi.net/", "type": "reference", "estimated_minutes": 60, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "freeCodeCamp: APIs and Microservices", "url": "https://www.freecodecamp.org/learn/back-end-development-and-apis/", "type": "interactive", "estimated_minutes": 300, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
    "error_handling": [
        {"title": "MDN: HTTP response status codes", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status", "type": "reference", "estimated_minutes": 25, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "REST API Error Handling guide", "url": "https://www.baeldung.com/rest-api-error-handling-best-practices", "type": "article", "estimated_minutes": 20, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "code_quality": [
        {"title": "The Odin Project: Clean code", "url": "https://www.theodinproject.com/lessons/foundations-clean-code", "type": "article", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Google Engineering Practices: Code Review", "url": "https://google.github.io/eng-practices/review/", "type": "reference", "estimated_minutes": 45, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "api_documentation": [
        {"title": "Write the Docs: Documentation guide", "url": "https://www.writethedocs.org/guide/", "type": "reference", "estimated_minutes": 40, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Swagger/OpenAPI specification tutorial", "url": "https://swagger.io/docs/specification/about/", "type": "reference", "estimated_minutes": 35, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    # ── UI/UX Design ─────────────────────────────────────────────────────────
    "ux_principles": [
        {"title": "Laws of UX", "url": "https://lawsofux.com/", "type": "reference", "estimated_minutes": 45, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Nielsen Norman Group: 10 Usability Heuristics", "url": "https://www.nngroup.com/articles/ten-usability-heuristics/", "type": "article", "estimated_minutes": 25, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Interaction Design Foundation: UX Design (free plan)", "url": "https://www.interaction-design.org/courses/user-experience-the-beginner-s-guide", "type": "article", "estimated_minutes": 120, "low_bandwidth_friendly": True, "requires_signup": True},
    ],
    "design_critique": [
        {"title": "NNG: How to conduct a heuristic evaluation", "url": "https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/", "type": "article", "estimated_minutes": 20, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "UX Review: How to critique a design", "url": "https://uxdesign.cc/how-to-give-useful-design-feedback-and-critique-8bac40bde9f4", "type": "article", "estimated_minutes": 15, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Google Material Design: Principles", "url": "https://m3.material.io/foundations", "type": "reference", "estimated_minutes": 50, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "usability_testing": [
        {"title": "NNG: Usability 101", "url": "https://www.nngroup.com/articles/usability-101-introduction-to-usability/", "type": "article", "estimated_minutes": 15, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "UsabilityHub: Intro to UX research (free)", "url": "https://usabilityhub.com/guides", "type": "article", "estimated_minutes": 40, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    # ── Business Writing ─────────────────────────────────────────────────────
    "business_writing": [
        {"title": "Purdue OWL: Business Writing", "url": "https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/index.html", "type": "reference", "estimated_minutes": 60, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "PlainLanguage.gov: Writing guidelines", "url": "https://www.plainlanguage.gov/guidelines/", "type": "reference", "estimated_minutes": 40, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "freeCodeCamp: Technical Writing", "url": "https://www.freecodecamp.org/news/technical-writing-for-beginners/", "type": "article", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "pitch_writing": [
        {"title": "Y Combinator: How to write a startup pitch", "url": "https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck", "type": "article", "estimated_minutes": 20, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Coursera: Successful Presentation (free audit)", "url": "https://www.coursera.org/learn/presentation-skills", "type": "article", "estimated_minutes": 90, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
    "memo_structure": [
        {"title": "Harvard Business Review: How to write a memo", "url": "https://hbr.org/2016/11/how-to-write-email-with-military-precision", "type": "article", "estimated_minutes": 10, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Purdue OWL: Memos", "url": "https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/memos/index.html", "type": "reference", "estimated_minutes": 15, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    # ── Data Analysis ────────────────────────────────────────────────────────
    "data_interpretation": [
        {"title": "Khan Academy: Statistics and Probability", "url": "https://www.khanacademy.org/math/statistics-probability", "type": "interactive", "estimated_minutes": 300, "low_bandwidth_friendly": True, "requires_signup": True},
        {"title": "Calling Bullshit: Data reasoning in the wild (free course)", "url": "https://www.callingbullshit.org/syllabus.html", "type": "article", "estimated_minutes": 120, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "statistical_thinking": [
        {"title": "MIT OpenCourseWare: Introduction to Statistics", "url": "https://ocw.mit.edu/courses/18-650-statistics-for-applications-fall-2016/", "type": "article", "estimated_minutes": 90, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Seeing Theory: Visual intro to probability", "url": "https://seeing-theory.brown.edu/", "type": "interactive", "estimated_minutes": 60, "low_bandwidth_friendly": False, "requires_signup": False},
    ],
    "data_quality": [
        {"title": "DAMA: Data quality basics (free intro)", "url": "https://www.dama.org/cpages/body-of-knowledge", "type": "reference", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Google: Data Quality guide", "url": "https://developers.google.com/machine-learning/data-prep/construct/collect/data-quality", "type": "article", "estimated_minutes": 20, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    # ── Presentation / Public Speaking ───────────────────────────────────────
    "public_speaking": [
        {"title": "TED: How to give a TED Talk (playlist)", "url": "https://www.ted.com/playlists/574/how_to_make_a_great_presentation", "type": "video", "estimated_minutes": 90, "low_bandwidth_friendly": False, "requires_signup": False},
        {"title": "Toastmasters: Pathways learning (free intro resources)", "url": "https://www.toastmasters.org/resources/public-speaking-tips", "type": "reference", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Coursera: Dynamic Public Speaking (free audit)", "url": "https://www.coursera.org/learn/public-speaking", "type": "interactive", "estimated_minutes": 240, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
    "script_writing": [
        {"title": "TED Blog: How to write a talk", "url": "https://blog.ted.com/how-to-write-a-ted-talk/", "type": "article", "estimated_minutes": 15, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Alan Alda Center: Clear communication guide", "url": "https://aldacommunicationtraining.com/resources/", "type": "article", "estimated_minutes": 25, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "storytelling": [
        {"title": "Pixar in a Box: The art of storytelling (Khan Academy)", "url": "https://www.khanacademy.org/computing/pixar/storytelling", "type": "interactive", "estimated_minutes": 120, "low_bandwidth_friendly": False, "requires_signup": True},
        {"title": "TED: The secret structure of great talks", "url": "https://www.ted.com/talks/nancy_duarte_the_secret_structure_of_great_talks", "type": "video", "estimated_minutes": 18, "low_bandwidth_friendly": False, "requires_signup": False},
    ],
    # ── Copywriting ─────────────────────────────────────────────────────────
    "copywriting_clarity": [
        {"title": "Copyblogger: Copywriting 101", "url": "https://copyblogger.com/copywriting-101/", "type": "article", "estimated_minutes": 45, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "The Copy Cure: Free copywriting resources", "url": "https://thecopycure.com/blog/", "type": "article", "estimated_minutes": 40, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "copywriting_structure": [
        {"title": "Kopywriting Kourse: Free writing guide", "url": "https://kopywritingkourse.com/copywriting-course/", "type": "article", "estimated_minutes": 60, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "AIDA copywriting formula explained", "url": "https://www.wordstream.com/blog/ws/2013/07/11/aida-marketing", "type": "article", "estimated_minutes": 15, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "marketing_copy": [
        {"title": "HubSpot: Marketing copy guide (free)", "url": "https://blog.hubspot.com/marketing/copywriting", "type": "article", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "ConversionXL: Landing page copywriting", "url": "https://cxl.com/blog/landing-page-copy/", "type": "article", "estimated_minutes": 25, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    # ── Translation ─────────────────────────────────────────────────────────
    "translation_theory": [
        {"title": "ATA: Translation quality and principles (free resources)", "url": "https://www.atanet.org/tools/resources/", "type": "reference", "estimated_minutes": 40, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "SDL: Translation quality overview", "url": "https://www.rws.com/translation/translation-quality/", "type": "article", "estimated_minutes": 20, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    "yoruba_resources": [
        {"title": "Yoruba Language: Grammar and vocabulary resources", "url": "https://www.yoruba.net/", "type": "reference", "estimated_minutes": 60, "low_bandwidth_friendly": True, "requires_signup": False},
        {"title": "Transparent Language: Yoruba basics", "url": "https://www.transparent.com/learn-yoruba/", "type": "article", "estimated_minutes": 30, "low_bandwidth_friendly": True, "requires_signup": False},
    ],
    # ── Universal ───────────────────────────────────────────────────────────
    "project_practice": [
        {"title": "Frontend Mentor: Newbie challenges", "url": "https://www.frontendmentor.io/challenges?difficulties=1", "type": "project", "estimated_minutes": 180, "low_bandwidth_friendly": False, "requires_signup": True},
        {"title": "The Odin Project: Landing page project", "url": "https://www.theodinproject.com/lessons/foundations-landing-page", "type": "project", "estimated_minutes": 240, "low_bandwidth_friendly": False, "requires_signup": True},
    ],
}

# Rubric ID for each skill path's Level 1 assessment
SKILL_PATH_RUBRIC_ID: dict[str, str] = {
    "web-dev-frontend":  "web-dev-html-001",
    "backend-api":       "backend-api-001",
    "copywriting-en":    "copy-en-001",
    "translation-yo-en": "translate-yo-en-001",
}

# Per-path resource key sets — used to select domain-relevant resources
SKILL_PATH_RESOURCE_KEYS: dict[str, list[str]] = {
    "web-dev-frontend": ["html_semantics", "css_quality", "responsiveness", "accessibility"],
    "backend-api":      ["api_design", "error_handling", "code_quality", "api_documentation"],
    "copywriting-en":   ["copywriting_clarity", "copywriting_structure", "marketing_copy"],
    "translation-yo-en":["translation_theory", "yoruba_resources"],
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
      "rubric_id": "{rubric_id}",
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

    # Start with the skill-path-specific resource keys as the base pool.
    # If the path has no mapping, fall back to all resources.
    base_keys = SKILL_PATH_RESOURCE_KEYS.get(request.skill_path_slug, list(FREE_RESOURCES.keys()))
    resource_pool: dict = {k: FREE_RESOURCES[k] for k in base_keys if k in FREE_RESOURCES}
    if not resource_pool:
        resource_pool = dict(FREE_RESOURCES)

    # If weak dimensions were specified, also add their resources when keys match
    # (keys may not match if they come in as human-readable names — the AI still
    # receives the dimension name in the prompt for context).
    for dim_key in request.weak_dimensions:
        if dim_key in FREE_RESOURCES and dim_key not in resource_pool:
            resource_pool[dim_key] = FREE_RESOURCES[dim_key]

    # Always include project practice
    resource_pool["project_practice"] = FREE_RESOURCES["project_practice"]

    rubric_id = SKILL_PATH_RUBRIC_ID.get(request.skill_path_slug, request.skill_path_slug + "-001")

    prompt = LEARNING_PROMPT_TEMPLATE.format(
        skill_path_slug=request.skill_path_slug,
        diagnostic_score=request.diagnostic_score,
        score_gap=round(score_gap, 1),
        hours_per_week=request.available_hours_per_week,
        duration_weeks=duration,
        weak_dimensions=", ".join(request.weak_dimensions) if request.weak_dimensions else "not specified — address all dimensions",
        preferred_language=request.preferred_language,
        resource_pool=json.dumps(resource_pool, indent=2),
        rubric_id=rubric_id,
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
