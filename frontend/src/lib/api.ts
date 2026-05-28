import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  async function freshToken(): Promise<string | undefined> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return undefined;
    const now = Math.floor(Date.now() / 1000);
    // If token expires within 5 minutes, proactively refresh
    if ((data.session.expires_at ?? 0) - now < 300) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token;
    }
    return data.session.access_token;
  }

  async function doFetch(token?: string) {
    return fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      ...init,
    });
  }

  let token = typeof window !== "undefined" ? await freshToken() : undefined;

  let res: Response;
  try {
    res = await doFetch(token);
  } catch {
    throw new Error(
      "Cannot reach the Maxx Engage server. If you are the site owner, make sure CORS_ORIGINS includes this domain in your backend environment variables."
    );
  }

  // On 401, force-refresh the token and retry once
  if (res.status === 401 && typeof window !== "undefined") {
    const { data } = await supabase.auth.refreshSession();
    token = data.session?.access_token;
    try {
      res = await doFetch(token);
    } catch {
      throw new Error(
        "Cannot reach the Maxx Engage server. If you are the site owner, make sure CORS_ORIGINS includes this domain in your backend environment variables."
      );
    }
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
  tertiary_model_used?: string | null;
  tertiary_overall_score?: number | null;
  model_disagreement?: boolean;
  model_disagreement_reason?: string | null;
  knowledge_sources?: KnowledgeSource[];
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
  location: string | null;
  preferred_language: string;
  avatar_url: string | null;
  public_profile: boolean;
  overall_score: number;
  created_at: string;
  username: string | null;
  proof_page_visibility: "public" | "unlisted" | "private";
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

export interface PendingCredential {
  review_id: string;
  rubric_id: string;
  score: number;
  reviewed_at: string | null;
  skill_path_name: string;
  skill_path_slug: string;
  domain: string;
  level: number;
  status: "pending_human_review";
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
  submission_content: { type: string; body: string };
  feedback: {
    summary: string;
    strengths: string[];
    improvements: string[];
    next_steps: string[];
  };
  scores: {
    dimension: string;
    score: number;
    max_score: number;
    rationale: string;
    evidence_quotes: string[];
  }[];
}

export interface TalentCredential {
  credential_id: string;
  skill_path_name: string;
  domain: string;
  score: number;
  verified_by_human: boolean;
}

export interface TalentProfile {
  user_id: string;
  display_name: string;
  username: string;
  country_code: string | null;
  bio: string | null;
  avatar_url: string | null;
  overall_score: number;
  top_score: number;
  credential_count: number;
  domains: string[];
  top_credentials: TalentCredential[];
}

export interface LeaderboardItem {
  rank: number;
  credential_id: string;
  display_name: string;
  username: string | null;
  country_code: string | null;
  skill_path_name: string;
  skill_path_slug: string;
  domain: string;
  level: number;
  level_label: string;
  score: number;
  percentile: number | null;
  verified_by_human: boolean;
  issued_at: string | null;
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

export interface PublicCredential {
  id: string;
  internal_id?: string;
  skill_path_slug: string;
  skill_path_name: string;
  domain?: string;
  category?: string;
  skill_name?: string;
  level: number;
  level_label: string;
  score: number;
  max_score?: number;
  pass_threshold?: number;
  percentile: number | null;
  verified_by_human: boolean;
  is_public: boolean;
  public_visible?: boolean;
  valid_from: string;
  valid_until: string | null;
  issued_at?: string | null;
  created_at: string;
  user_id: string;
  holder_did: string;
  rubric_id?: string | null;
  rubric_version?: string | null;
  graded_by?: "ai" | "ai+human" | "human";
  flagged_for_review?: boolean;
  flag_reason?: string | null;
  revoked?: boolean;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  content_hash?: string | null;
  submission_hash?: string | null;
  vc_document: Record<string, unknown>;
  decay: {
    effective_score: number;
    decay_factor: number;
    overdue_for_refresh: boolean;
    reassessment_recommended_at: string | null;
  } | null;
}

export type VerifyCredential = {
  id: string;
  skill_name: string;
  skill_path_name: string;
  skill_path_slug: string;
  category: string;
  domain: string;
  score: number;
  max_score: number;
  pass_threshold: number;
  level: number;
  level_label: string;
  rubric_id: string | null;
  rubric_version: string | null;
  issued_at: string | null;
  graded_by: "ai" | "ai+human" | "human";
  verified_by_human: boolean;
  flagged_for_review: boolean;
  flag_reason: string | null;
  revoked: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  content_hash: string | null;
  submission_hash: string | null;
  vc_document: Record<string, unknown>;
};

export type VerifyLookupResponse =
  | {
      kind: "credential";
      credential: VerifyCredential;
      user: { id: string; display_name: string; username: string | null };
    }
  | {
      kind: "user";
      user: { id: string; display_name: string; username: string | null };
      credentials: VerifyCredential[];
    };

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

export interface SkillPathStats {
  credential_count: number;
  earner_count: number;
  avg_score: number | null;
  top_score: number | null;
  top_performers: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    score: number;
    verified_by_human: boolean;
    level_label: string;
  }[];
}

export interface RubricDimension {
  id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
}

export interface SkillPathRubric {
  rubric_id: string;
  title: string;
  pass_threshold: number;
  dimensions: RubricDimension[];
}

export interface PlatformStats {
  credential_count: number;
  user_count: number;
  country_count: number;
  skill_path_count: number;
}

export interface ProjectDeliverable {
  title: string;
  description: string;
  required: boolean;
}

// ── Peer Review ───────────────────────────────────────────────────────────────

export interface PeerReviewQueueItem {
  id: string;
  user_id: string;
  submission_id: string | null;
  review_id: string | null;
  skill_path_slug: string;
  rubric_id: string;
  ai_score: number | null;
  status: "pending" | "claimed" | "approved" | "rejected" | "expired";
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  verdict: "approve" | "reject" | null;
  verdict_notes: string | null;
  completed_at: string | null;
  credential_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimResponse {
  id: string;
  status: string;
  claim_expires_at: string;
  message: string;
}

export interface VerdictRequest {
  verdict: "approve" | "reject";
  verdict_notes?: string;
}

export interface VerdictResponse {
  id: string;
  verdict: string;
  credential_id: string | null;
  message: string;
}

export interface ReviewerReputation {
  reviewer_id: string;
  reviews_completed: number;
  reviews_approved: number;
  reviews_rejected: number;
  last_active_at: string | null;
}

export interface ProjectBriefSummary {
  id: string;
  slug: string;
  skill_path_slug: string;
  skill_path_name: string;
  skill_path_domain: string;
  title: string;
  summary: string;
  deliverables: ProjectDeliverable[];
  rubric_id: string;
  level: number;
  estimated_days: number;
  pass_threshold: number;
}

export interface ProjectBrief extends ProjectBriefSummary {
  task_id: string | null;
  brief_markdown: string;
}

export interface ProjectFile {
  filename: string;
  content: string;
}

export interface ProjectSubmitRequest {
  files: ProjectFile[];
  notes?: string;
}

export interface ProjectSubmitResponse {
  job_id: string;
  status: string;
  message: string;
}

export const api = {
  search: (q: string) => apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}`),
  platform: {
    stats: () => apiFetch<PlatformStats>("/stats"),
  },
  skillPaths: {
    list: () => apiFetch<SkillPath[]>("/skill-paths"),
    get: (slug: string) => apiFetch<SkillPath>(`/skill-paths/${slug}`),
    stats: (slug: string) => apiFetch<SkillPathStats>(`/skill-paths/${slug}/stats`),
    rubric: (slug: string, level: number) => apiFetch<SkillPathRubric>(`/skill-paths/${slug}/rubric/${level}`),
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
  projects: {
    list: () => apiFetch<ProjectBriefSummary[]>("/projects"),
    get: (slug: string) => apiFetch<ProjectBrief>(`/projects/${slug}`),
    submit: (slug: string, body: ProjectSubmitRequest) =>
      apiFetch<ProjectSubmitResponse>(`/projects/${slug}/submit`, { method: "POST", body: JSON.stringify(body) }),
    pollJob: (jobId: string) => apiFetch<AssessmentJob>(`/projects/submissions/${jobId}`),
  },
  peerReview: {
    listQueue: () => apiFetch<PeerReviewQueueItem[]>("/peer-review/queue"),
    myClaims: () => apiFetch<PeerReviewQueueItem[]>("/peer-review/my-claims"),
    myItems: () => apiFetch<PeerReviewQueueItem[]>("/peer-review/my-items"),
    myReputation: () => apiFetch<ReviewerReputation>("/peer-review/my-reputation"),
    claim: (itemId: string) => apiFetch<ClaimResponse>(`/peer-review/queue/${itemId}/claim`, { method: "POST" }),
    release: (itemId: string) => apiFetch<{ id: string; status: string; message: string }>(`/peer-review/queue/${itemId}/release`, { method: "POST" }),
    submitVerdict: (itemId: string, body: VerdictRequest) =>
      apiFetch<VerdictResponse>(`/peer-review/queue/${itemId}/verdict`, { method: "POST", body: JSON.stringify(body) }),
  },
  users: {
    create: (body: { display_name: string; country_code: string; bio?: string; location?: string }) =>
      apiFetch<UserResponse>("/users", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiFetch<UserResponse>(`/users/${id}`),
    byUsername: (username: string) => apiFetch<UserResponse>(`/users/by-username/${encodeURIComponent(username)}`),
    credentials: (id: string) => apiFetch<UserCredential[]>(`/users/${id}/credentials`),
    pendingCredentials: (id: string) => apiFetch<PendingCredential[]>(`/users/${id}/pending-credentials`),
    setUsername: (username: string) =>
      apiFetch<UserResponse>("/users/me/username", { method: "PATCH", body: JSON.stringify({ username }) }),
    updateProfile: (body: { display_name?: string; bio?: string; avatar_url?: string; location?: string; country_code?: string; preferred_language?: string }) =>
      apiFetch<UserResponse>("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
    setVisibility: (proof_page_visibility: "public" | "unlisted" | "private") =>
      apiFetch<UserResponse>("/users/me/visibility", { method: "PATCH", body: JSON.stringify({ proof_page_visibility }) }),
    deleteAccount: () => apiFetch<never>("/users/me", { method: "DELETE" }),
    submissions: (id: string, limit = 20, offset = 0) =>
      apiFetch<PublicSubmissionHistory>(`/users/${id}/submissions?limit=${limit}&offset=${offset}`),
    vouches: (id: string) =>
      apiFetch<VouchList>(`/users/${id}/vouches`),
    vouch: (id: string) =>
      apiFetch<{ ok: boolean; message: string }>(`/users/${id}/vouch`, { method: "POST" }),
  },
  credentials: {
    myDecayStatus: () => apiFetch<CredentialDecayStatus>("/credentials/my/decay-status"),
    get: (id: string) => apiFetch<PublicCredential>(`/credentials/${id}`),
    setVisibility: (id: string, is_public: boolean) =>
      apiFetch<{ ok: boolean; credential_id: string; is_public: boolean; message: string }>(
        `/credentials/${id}/visibility`,
        { method: "PATCH", body: JSON.stringify({ is_public }) }
      ),
  },
  verify: {
    lookup: (q: string) =>
      apiFetch<VerifyLookupResponse>(`/verify?q=${encodeURIComponent(q)}`),
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
    verifyVC: (credential: Record<string, unknown>) =>
      apiFetch<{ valid: boolean; reason: string; issuer: string | null; subject_did: string | null; credential_id: string | null; valid_from: string | null }>("/wallet/verify", {
        method: "POST",
        body: JSON.stringify(credential),
      }),
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
  talent: {
    search: (params?: { domain?: string; country_code?: string; min_score?: number; skill_path_slug?: string; q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.domain) qs.set("domain", params.domain);
      if (params?.country_code) qs.set("country_code", params.country_code);
      if (params?.min_score != null) qs.set("min_score", String(params.min_score));
      if (params?.skill_path_slug) qs.set("skill_path_slug", params.skill_path_slug);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString() ? `?${qs}` : "";
      return apiFetch<{ total: number; limit: number; offset: number; items: TalentProfile[] }>(`/talent/search${query}`);
    },
  },
  leaderboard: {
    get: (params?: { domain?: string; skill_path_slug?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.domain) qs.set("domain", params.domain);
      if (params?.skill_path_slug) qs.set("skill_path_slug", params.skill_path_slug);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString() ? `?${qs}` : "";
      return apiFetch<{ total: number; limit: number; offset: number; items: LeaderboardItem[] }>(`/leaderboard${query}`);
    },
  },
  admin: {
    queue: () => apiFetch<AdminQueueItem[]>("/admin/queue"),
    calibrationLatest: () => apiFetch<CalibrationLatestItem[]>("/admin/calibration/latest"),
    decide: (reviewId: string, decision: "approve" | "reject", note: string) =>
      apiFetch<{ ok: boolean; decision: string; review_id: string }>(`/admin/reviews/${reviewId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      }),
    analytics: () => apiFetch<AdminAnalytics>("/admin/analytics"),
  },
  notifications: {
    list: (limit = 20) =>
      apiFetch<{ unread_count: number; items: AppNotification[] }>(`/notifications/me?limit=${limit}`),
    markRead: (id: string) =>
      apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllRead: () =>
      apiFetch<{ ok: boolean }>("/notifications/me/read-all", { method: "POST" }),
  },
  referrals: {
    my: () => apiFetch<ReferralStatus>("/referrals/my"),
    claim: (code: string) =>
      apiFetch<{ ok: boolean; already_claimed: boolean; referrer_name: string | null }>(
        "/referrals/claim",
        { method: "POST", body: JSON.stringify({ code }) }
      ),
  },
};

export interface ReferralStatus {
  referral_code: string;
  invite_url: string;
  referral_count: number;
  stamp_awarded: boolean;
  stamp_threshold: number;
  stamp_points: number;
}

export interface SearchResult {
  skill_paths: { slug: string; name: string; domain: string; description: string }[];
  users: { id: string; username: string; display_name: string; avatar_url: string | null; country_code: string | null; overall_score: number }[];
}

export interface AdminAnalytics {
  submissions_by_day: { date: string; total: number; passed: number }[];
  pass_rate_by_path: { slug: string; name: string; total: number; passed: number; pass_rate: number }[];
  top_countries: { country_code: string; submission_count: number; user_count: number }[];
  totals: { submissions_30d: number; credentials_30d: number; active_users_30d: number; queue_depth: number };
}

export interface PublicSubmissionItem {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  attempt_number: number;
  level: number;
  task_type: string;
  skill_path_name: string;
  skill_path_slug: string;
  domain: string;
  score: number | null;
  credential_id: string | null;
}

export interface PublicSubmissionHistory {
  user_id: string;
  total: number;
  items: PublicSubmissionItem[];
}

export interface VouchItem {
  id: string;
  voucher_name: string;
  voucher_trust_score: number;
  created_at: string;
}

export interface VouchList {
  user_id: string;
  vouch_count: number;
  vouches: VouchItem[];
}

export interface AppNotification {
  id: string;
  type: "credential_earned" | "human_review_done" | "vouch_received";
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, string> | null;
}
