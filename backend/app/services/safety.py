"""
Deterministic adversarial and fairness checks for assessment submissions.

These checks do not grade competence. They flag cases where a submission may be
trying to manipulate the grader or where protected-class content could influence
AI scoring. Flagged cases can be forced into human review.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

from app.core.config import get_settings
from app.models.assess import AssessRequest, AssessResponse

Severity = Literal["low", "medium", "high"]


ADVERSARIAL_PATTERNS = {
    "prompt_injection": [
        "ignore previous instructions",
        "ignore all instructions",
        "system prompt",
        "developer message",
        "you are now",
        "return only",
        "give me 100",
        "assign a score of 100",
        "credential eligible",
    ],
    "exfiltration": [
        "reveal your prompt",
        "show hidden instructions",
        "print the rubric secret",
        "api key",
        "service role",
    ],
}

PROTECTED_CLASS_PATTERNS = {
    "age": ["teenager", "elderly", "old people", "young people"],
    "disability": ["disabled", "blind", "deaf", "autistic"],
    "gender": ["woman", "women", "man", "men", "male", "female", "nonbinary"],
    "nationality": ["nigerian", "kenyan", "ghanaian", "american", "indian"],
    "race_ethnicity": ["black", "white", "asian", "latino", "yoruba", "igbo", "hausa"],
    "religion": ["christian", "muslim", "islam", "church", "mosque"],
}


@dataclass
class SafetyCheckResult:
    enabled: bool
    adversarial_flags: list[str]
    protected_class_flags: list[str]
    severity: Severity
    force_human_review: bool

    def model_dump(self) -> dict:
        return asdict(self)


def _matches(text: str, patterns: dict[str, list[str]]) -> list[str]:
    flags: list[str] = []
    lowered = text.lower()
    for category, needles in patterns.items():
        if any(needle in lowered for needle in needles):
            flags.append(category)
    return sorted(set(flags))


def run_safety_checks(request: AssessRequest) -> SafetyCheckResult:
    settings = get_settings()
    if not settings.safety_checks_enabled:
        return SafetyCheckResult(
            enabled=False,
            adversarial_flags=[],
            protected_class_flags=[],
            severity="low",
            force_human_review=False,
        )

    adversarial = _matches(request.content, ADVERSARIAL_PATTERNS)
    protected = _matches(request.content, PROTECTED_CLASS_PATTERNS)
    if adversarial:
        severity: Severity = "high"
    elif protected:
        severity = "medium"
    else:
        severity = "low"

    return SafetyCheckResult(
        enabled=True,
        adversarial_flags=adversarial,
        protected_class_flags=protected,
        severity=severity,
        force_human_review=settings.safety_force_human_review and severity in {"medium", "high"},
    )


def apply_safety_result(
    response: AssessResponse,
    safety: SafetyCheckResult,
) -> AssessResponse:
    if not safety.force_human_review:
        return response
    response.human_review_requested = True
    response.credential_eligible = False
    return response
