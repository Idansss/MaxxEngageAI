const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface SkillPath {
  id: string;
  slug: string;
  name: string;
  domain: string;
  description: string;
  levels: { level: number; label: string; rubric_id: string; typical_duration_weeks: number }[];
  tags: string[];
  decay_half_life_months: number;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  max_score: number;
  rationale: string;
  evidence_quotes: string[];
}

export interface ReviewFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  next_steps: string[];
}

export interface AssessResponse {
  task_id: string;
  overall_score: number;
  pass_threshold: number;
  passed: boolean;
  confidence: number;
  scores: DimensionScore[];
  feedback: ReviewFeedback;
  credential_eligible: boolean;
  human_review_requested: boolean;
  model_used: string;
  prompt_hash: string;
  review_id: string;
  submission_id: string | null;
  credential_id: string | null;
}

export interface AssessRequest {
  task_id: string;
  skill_path_slug: string;
  level: number;
  submission_type: "text" | "code" | "html_css_js" | "markdown" | "url";
  content: string;
  rubric_id: string;
  user_id?: string;
}

export interface LearnPathRequest {
  skill_path_slug: string;
  diagnostic_score: number;
  available_hours_per_week: number;
  user_id?: string;
  preferred_language?: string;
  weak_dimensions?: string[];
}

export interface Resource {
  title: string;
  url: string;
  type: "article" | "video" | "interactive" | "project" | "reference";
  estimated_minutes: number;
  free: boolean;
  requires_signup: boolean;
  low_bandwidth_friendly: boolean;
}

export interface WeekPlan {
  week: number;
  theme: string;
  focus_areas: string[];
  resources: Resource[];
  practice_task: string;
  estimated_hours: number;
  is_assessment_week: boolean;
}

export interface MilestoneAssessment {
  after_week: number;
  rubric_id: string;
  description: string;
  expected_score_range: [number, number];
}

export interface LearnPathResponse {
  skill_path_slug: string;
  user_id: string | null;
  diagnostic_score: number;
  current_level: number;
  level_label: string;
  score_gap_to_pass: number;
  duration_weeks: number;
  total_estimated_hours: number;
  weekly_plan: WeekPlan[];
  milestone_assessments: MilestoneAssessment[];
  path_rationale: string;
  next_assessment_date: string;
}

export interface UserResponse {
  id: string;
  did: string;
  display_name: string;
  bio: string | null;
  country_code: string;
  preferred_language: string;
  avatar_url: string | null;
  public_profile: boolean;
  overall_score: number;
  created_at: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const api = {
  skillPaths: {
    list: () => apiFetch<SkillPath[]>("/skill-paths"),
    get: (slug: string) => apiFetch<SkillPath>(`/skill-paths/${slug}`),
  },
  assess: (body: AssessRequest) =>
    apiFetch<AssessResponse>("/assess", { method: "POST", body: JSON.stringify(body) }),
  learnPath: (body: LearnPathRequest) =>
    apiFetch<LearnPathResponse>("/learn-path", { method: "POST", body: JSON.stringify(body) }),
  users: {
    create: (body: { display_name: string; country_code: string; bio?: string }) =>
      apiFetch<UserResponse>("/users", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiFetch<UserResponse>(`/users/${id}`),
  },
};
