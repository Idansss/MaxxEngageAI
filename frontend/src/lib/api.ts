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
  current_score: number;
  level: number;
  weak_dimensions?: string[];
}

export interface WeekPlan {
  week: number;
  theme: string;
  objectives: string[];
  resources: { title: string; url: string; type: string; low_bandwidth_friendly: boolean }[];
  practice_task: string;
}

export interface LearnPathResponse {
  skill_path_slug: string;
  current_score: number;
  target_score: number;
  estimated_weeks: number;
  weekly_plan: WeekPlan[];
  milestones: { week: number; description: string; assessment_type: string }[];
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
