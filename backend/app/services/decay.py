"""
Skill decay: credentials earned in the past are worth less than recent ones.

Formula: effective_score = raw_score * 0.5^(months_elapsed / half_life_months)
- At t = 0: effective_score = raw_score (no decay)
- At t = half_life_months: effective_score = 50% of raw_score
- At t = 2*half_life_months: effective_score = 25%

half_life_months is stored per skill_path (web dev = 18 months; slower-changing
fields like writing may have 36+ months). This is why a 2019 credential for a
fast-moving skill is almost worthless today.
"""

import math
from datetime import datetime, timedelta, timezone


def compute_decay(
    raw_score: float,
    issued_at: datetime,
    half_life_months: int,
    refresh_months: int | None = None,
) -> dict:
    """
    Returns a dict with all decay-related fields safe to return to a client.
    All inputs are validated; issued_at may be tz-naive (treated as UTC).
    """
    if issued_at.tzinfo is None:
        issued_at = issued_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    # Use fractional months (avg 30.44 days per month)
    months_elapsed = (now - issued_at).total_seconds() / (30.44 * 24 * 3600)

    decay_factor = 0.5 ** (months_elapsed / half_life_months)
    effective_score = round(raw_score * decay_factor, 2)

    # Recommend reassessment when effective score has decayed 15% from raw
    # i.e., when decay_factor < 0.85 → months = half_life * log2(1/0.85)
    months_to_15pct = half_life_months * math.log2(1.0 / 0.85)
    reassessment_at = issued_at + timedelta(days=months_to_15pct * 30.44)

    overdue_for_refresh = (
        refresh_months is not None and months_elapsed > refresh_months
    )

    return {
        "raw_score": raw_score,
        "effective_score": effective_score,
        "decay_factor": round(decay_factor, 4),
        "months_elapsed": round(months_elapsed, 1),
        "half_life_months": half_life_months,
        "reassessment_recommended_at": reassessment_at.date().isoformat(),
        "overdue_for_refresh": overdue_for_refresh,
    }
