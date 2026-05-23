from pydantic import BaseModel, Field
from typing import Literal


class LearnPathRequest(BaseModel):
    skill_path_slug: str = Field(..., examples=["web-dev-frontend"])
    diagnostic_score: float = Field(..., ge=0, le=100)
    available_hours_per_week: int = Field(..., ge=1, le=80)
    user_id: str | None = None
    preferred_language: str = Field(
        default="en",
        description="IETF BCP 47 tag. Affects resource recommendations.",
    )
    weak_dimensions: list[str] = Field(
        default=[],
        description="Dimension names from the diagnostic review where score was lowest. "
                    "If provided, the path focuses on these first.",
    )


class Resource(BaseModel):
    title: str
    url: str
    type: Literal["article", "video", "interactive", "project", "reference"]
    estimated_minutes: int
    free: bool = True
    requires_signup: bool = False
    low_bandwidth_friendly: bool = Field(
        description="True if usable on a 3G connection — critical for African users."
    )


class WeekPlan(BaseModel):
    week: int
    theme: str
    focus_areas: list[str]
    resources: list[Resource]
    practice_task: str = Field(
        description="One concrete, actionable thing to build or write this week."
    )
    estimated_hours: int
    is_assessment_week: bool = False


class MilestoneAssessment(BaseModel):
    after_week: int
    rubric_id: str
    description: str
    expected_score_range: list[int] = Field(
        description="[min, max] score the user should hit at this milestone."
    )


class LearnPathResponse(BaseModel):
    skill_path_slug: str
    user_id: str | None
    diagnostic_score: float
    current_level: int
    level_label: str
    score_gap_to_pass: float = Field(
        description="Points needed to reach pass threshold (70). 0 if already passing."
    )
    duration_weeks: int
    total_estimated_hours: int
    weekly_plan: list[WeekPlan]
    milestone_assessments: list[MilestoneAssessment]
    path_rationale: str = Field(
        description="Plain-English explanation of why this specific path was designed for this score."
    )
    next_assessment_date: str = Field(
        description="ISO 8601 date of the first milestone assessment."
    )
