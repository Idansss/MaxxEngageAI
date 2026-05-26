import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string | undefined;
  if (typeof window !== "undefined") {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      ...init,
    });
  } catch {
    throw new Error(
      "Cannot reach the Maxx Engage server. If you are the site owner, make sure CORS_ORIGINS includes this domain in your backend environment variables."
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg ?? String(d)).join("; ")
      : String(detail ?? "Request failed");
    throw new Error(msg);
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
  secondary_model_used?: string | null;
  secondary_overall_score?: number | null;
  model_disagreement?: boolean;
  model_disagreement_reason?: string | null;
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

export interface UserCredential {
  id: string;
  skill_path_slug: string;
  skill_path_name: string;
  domain: string;
  level: number;
  level_label: string;
  score: number;
  percentile: number | null;
  verified_by_human: boolean;
  zk_proof_available: boolean;
  is_public?: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

export interface CredentialDecayItem {
  id: string;
  skill_path_name: string;
  skill_path_slug: string;
  domain: string;
  level: number;
  level_label: string;
  is_public: boolean;
  raw_score: number;
  effective_score: number;
  decay_factor: number;
  overdue_for_refresh: boolean;
  reassessment_recommended_at: string | null;
}

export interface CredentialDecayStatus {
  total: number;
  overdue_count: number;
  credentials: CredentialDecayItem[];
}

export interface Stamp {
  stamp_type: string;
  score_contribution: number;
  active: boolean;
  verified_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
}

export interface HumanityScore {
  user_id: string;
  humanity_score: number;
  full_weight_threshold: number;
  full_weight_achieved: boolean;
  breakdown: { stamp_type: string; points: number; active: boolean }[];
  stamps_available: { stamp_type: string; max_points: number; how: string }[];
}

export interface KeyMaterial {
  did: string;
  public_key_multibase: string;
  private_key_b64: string | null;
  key_type: string;
  did_method: string;
  platform_custody: boolean;
  instructions: string;
}

export interface SubmissionHistoryItem {
  id: string;
  status: string;
  submitted_at: string;
  attempt_number: number;
  level: number;
  task_type: string;
  task_title: string;
  skill_path_name: string;
  skill_path_slug: string;
  domain: string;
  score: number | null;
  confidence: number | null;
  credential_eligible: boolean | null;
  human_review_requested: boolean | null;
  review_id: string | null;
  credential_id: string | null;
}

export interface SubmissionHistory {
  total: number;
  items: SubmissionHistoryItem[];
}

export interface AdminQueueItem {
  review_id: string;
  submission_id: string;
  user_id: string;
  display_name: string;
  country_code: string;
  skill_path_name: string;
  skill_path_slug: string;
  overall_score: number;
  confidence: number;
  credential_eligible: boolean;
  credential_issued: boolean;
  credential_verified_by_human: boolean;
  reviewed_at: string;
  submitted_at: string;
  submission_status: string;
  appeal_reason: string | null;
  model_version: string | null;
}

export interface CalibrationLatestItem {
  skill_path_slug: string;
  level: number;
  eval_file: string;
  run_id: string;
  run_at: string;
  ai_model: string;
  total_cases: number;
  in_range_rate: number | null;
  mae: number | null;
  within5_rate: number | null;
  pass_agreement: number | null;
  mean_bias: number | null;
  health: "green" | "yellow" | "red" | "no_human_scores";
}

export interface ReviewDetail {
  id: string;
  rubric_id: string;
  reviewer_type: string;
  model_version: string | null;
  overall_score: number;
  confidence: number | null;
  scores: DimensionScore[];
  feedback: ReviewFeedback;
  reviewed_at: string;
  credential_eligible: boolean;
  human_review_requested: boolean;
  submission_status: string;
  attempt_number: number;
  skill_path_name: string;
  skill_path_slug: string;
  level: number;
}

export interface AdaptiveTask {
  recommended_level: number;
  level_label: string;
  reasoning: string;
  task_id: string;
  rubric_id: string;
  skill_path_slug: string;
  prompt: { text: string; context?: string; expected_output_format?: string; time_limit_minutes?: number };
  difficulty_rating: number;
}

export interface AssessmentJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  result: AssessResponse | null;
  request?: Record<string, unknown> | null;
}

export interface KnowledgeSource {
  title: string;
  url: string;
  source_type: "wikipedia" | "wikidata" | string;
  summary: string;
}

export interface GitHubCommunityStatus {
  repo: {
    name: string;
    url: string;
    description: string | null;
    stars: number;
    forks: number;
    open_issues: number;
    license: string | null;
    default_branch: string | null;
  };
  issues: {
    number: number;
    title: string;
    url: string;
    labels: string[];
    created_at: string;
  }[];
  docs: { title: string; url: string }[];
  community: {
    discord_invite_url: string;
    github_url: string;
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

export const api = {
  skillPaths: {
    list: () => apiFetch<SkillPath[]>("/skill-paths"),
    get: (slug: string) => apiFetch<SkillPath>(`/skill-paths/${slug}`),
  },
  assess: (body: AssessRequest) =>
    apiFetch<AssessResponse>("/assess", { method: "POST", body: JSON.stringify(body) }),
  assessmentJobs: {
    create: (body: AssessRequest) =>
      apiFetch<AssessmentJob>("/assess/jobs", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiFetch<AssessmentJob>(`/assess/jobs/${id}`),
    adaptiveTask: (skillPathSlug: string, userId?: string) =>
      apiFetch<AdaptiveTask>(
        `/assess/adaptive-task?skill_path_slug=${encodeURIComponent(skillPathSlug)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}`
      ),
  },
  learnPath: (body: LearnPathRequest) =>
    apiFetch<LearnPathResponse>("/learn-path", { method: "POST", body: JSON.stringify(body) }),
  users: {
    create: (body: { display_name: string; country_code: string; bio?: string }) =>
      apiFetch<UserResponse>("/users", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiFetch<UserResponse>(`/users/${id}`),
    credentials: (id: string) => apiFetch<UserCredential[]>(`/users/${id}/credentials`),
  },
  credentials: {
    myDecayStatus: () => apiFetch<CredentialDecayStatus>("/credentials/my/decay-status"),
    setVisibility: (id: string, is_public: boolean) =>
      apiFetch<{ ok: boolean; credential_id: string; is_public: boolean; message: string }>(
        `/credentials/${id}/visibility`,
        { method: "PATCH", body: JSON.stringify({ is_public }) }
      ),
  },
  submissions: {
    appeal: (submissionId: string, reason: string) =>
      apiFetch<{ ok: boolean; submission_id: string; status: string }>(
        `/submissions/${submissionId}/appeal`,
        { method: "POST", body: JSON.stringify({ reason }) }
      ),
    my: (limit = 20, offset = 0) =>
      apiFetch<SubmissionHistory>(`/submissions/my?limit=${limit}&offset=${offset}`),
  },
  identity: {
    myScore: () => apiFetch<HumanityScore>("/identity/score"),
    myStamps: () => apiFetch<{ user_id: string; stamps: Stamp[] }>("/identity/stamps"),
    stampEmail: () =>
      apiFetch<{ ok: boolean; stamp_type: string; score_contribution: number; message: string; metadata: Record<string, unknown> }>(
        "/identity/stamps/email",
        { method: "POST" }
      ),
    stampGitHub: (username: string) =>
      apiFetch<{ ok: boolean; stamp_type: string; score_contribution: number; message: string; metadata: Record<string, unknown> }>(
        "/identity/stamps/github",
        { method: "POST", body: JSON.stringify({ username }) }
      ),
    stampGitcoin: (eth_address: string) =>
      apiFetch<{ ok: boolean; stamp_type: string; score_contribution: number; message: string; metadata: Record<string, unknown> }>(
        "/identity/stamps/gitcoin",
        { method: "POST", body: JSON.stringify({ eth_address }) }
      ),
    publicScore: (userId: string) =>
      apiFetch<{ user_id: string; humanity_score: number; full_weight_achieved: boolean; active_stamps: { stamp_type: string; verified_at: string }[] }>(
        `/identity/users/${userId}/score`
      ),
  },
  wallet: {
    keyMaterial: () => apiFetch<KeyMaterial>("/wallet/key-material"),
    deleteKey: () => apiFetch<{ ok: boolean; message: string }>("/wallet/key-material", { method: "DELETE" }),
    exportCredential: (id: string) => `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/wallet/credentials/${id}/export`,
    exportCredentialDocument: (id: string) =>
      apiFetch<Record<string, unknown>>(`/wallet/credentials/${id}/export`),
  },
  reviews: {
    get: (reviewId: string) => apiFetch<ReviewDetail>(`/reviews/${reviewId}`),
  },
  knowledge: {
    search: (q: string) =>
      apiFetch<{ query: string; sources: KnowledgeSource[] }>(`/knowledge/search?q=${encodeURIComponent(q)}`),
  },
  community: {
    github: () => apiFetch<GitHubCommunityStatus>("/community/github"),
  },
  admin: {
    queue: () => apiFetch<AdminQueueItem[]>("/admin/queue"),
    calibrationLatest: () => apiFetch<CalibrationLatestItem[]>("/admin/calibration/latest"),
  },
};
