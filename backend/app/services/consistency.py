"""
Consistency-over-time scoring.

Measures whether a learner's performance is stable across multiple assessed
submissions for the same skill path. Volatile scores indicate either a skill
that isn't fully internalized or inconsistent effort.

Formula:
  std_dev = population standard deviation of all submission scores for this
             user + skill_path
  consistency_score = max(0, 100 - std_dev * 5)

  std_dev ≤ 4  →  consistency_score ≥ 80  →  rating: "consistent"
  std_dev ≤ 10 →  consistency_score ≥ 50  →  rating: "variable"
  std_dev > 10 →  consistency_score < 50  →  rating: "inconsistent"

The rubric dimension is injected into grading feedback (not as a scored
dimension) when the user has prior submissions — the grader is aware of
their trajectory and can call out regressions or improvements.
"""

import math


async def compute_consistency(
    user_id: str,
    skill_path_slug: str,
    pool,
) -> dict:
    """
    Returns consistency dict. consistency_score is None on first attempt.
    Queries all reviews for this user+skill_path via the task join.
    """
    rows = await pool.fetch(
        """
        SELECT r.overall_score
        FROM public.reviews r
        JOIN public.submissions s ON s.review_id = r.id
        JOIN public.tasks t       ON t.id = s.task_id
        JOIN public.skill_paths sp ON sp.id = t.skill_path_id
        WHERE s.user_id = $1::uuid AND sp.slug = $2
        ORDER BY r.reviewed_at ASC
        """,
        user_id,
        skill_path_slug,
    )

    attempt_count = len(rows)

    if attempt_count < 2:
        return {
            "consistency_score": None,
            "consistency_rating": "first_attempt",
            "attempt_count": attempt_count,
            "score_std_dev": None,
            "score_history": [float(r["overall_score"]) for r in rows],
        }

    scores = [float(r["overall_score"]) for r in rows]
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    std_dev = math.sqrt(variance)

    consistency_score = max(0.0, round(100.0 - std_dev * 5, 1))

    if consistency_score >= 80:
        rating = "consistent"
    elif consistency_score >= 50:
        rating = "variable"
    else:
        rating = "inconsistent"

    return {
        "consistency_score": consistency_score,
        "consistency_rating": rating,
        "attempt_count": attempt_count,
        "score_std_dev": round(std_dev, 2),
        "score_history": scores,
    }
