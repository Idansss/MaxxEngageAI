from pydantic import BaseModel, Field


class ProjectFile(BaseModel):
    filename: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=50_000)


class ProjectDeliverable(BaseModel):
    title: str
    description: str
    required: bool = True


class ProjectBrief(BaseModel):
    id: str
    slug: str
    skill_path_slug: str
    skill_path_name: str
    skill_path_domain: str
    task_id: str | None
    title: str
    summary: str
    brief_markdown: str
    deliverables: list[ProjectDeliverable]
    rubric_id: str
    level: int
    estimated_days: int
    pass_threshold: int


class ProjectBriefSummary(BaseModel):
    """Lightweight version for the index page — no full markdown."""
    id: str
    slug: str
    skill_path_slug: str
    skill_path_name: str
    skill_path_domain: str
    title: str
    summary: str
    deliverables: list[ProjectDeliverable]
    rubric_id: str
    level: int
    estimated_days: int
    pass_threshold: int


class ProjectSubmitRequest(BaseModel):
    files: list[ProjectFile] = Field(..., min_length=1, max_length=5)
    notes: str | None = Field(None, max_length=500)
    user_id: str | None = None


class ProjectSubmitResponse(BaseModel):
    job_id: str
    status: str
    message: str
