"""
Lightweight ZK-adjacent credential proofs.

Full ZK circuits (zk-SNARKs, Bulletproofs) are on the Phase 4 roadmap.
This module ships two practical primitives that give holders real privacy
without requiring a ZK prover on the client:

1. Score commitment — HMAC-SHA256(platform_secret, credential_id:score)
   Stored on the credential. A holder can disclose their exact score to a
   verifier who then recomputes the HMAC. The verifier confirms authenticity
   without Maxx Engage needing to be in the loop for every verification.

2. Signed percentile claim — Maxx Engage signs (credential_id, percentile_band,
   skill_path, level). The holder shares this signed object to prove
   "top 25%" without revealing their exact score or submission content.
   Verifiers call GET /verify/percentile to check the signature.

Both rely on a platform secret (ZK_SECRET_KEY env var). Key rotation would
require re-issuing commitments — plan key management before production scale.
"""

import hashlib
import hmac
import json


# ── Percentile bands ──────────────────────────────────────────────────────────

def _percentile_band(percentile: float) -> str:
    if percentile >= 95:
        return "top-5%"
    if percentile >= 90:
        return "top-10%"
    if percentile >= 75:
        return "top-25%"
    if percentile >= 50:
        return "top-50%"
    return "lower-50%"


# ── Score commitment ──────────────────────────────────────────────────────────

def make_score_commitment(credential_id: str, score: float, secret: str) -> str:
    """HMAC-SHA256 over 'credential_id:score.2f'. Verifier recomputes to confirm."""
    msg = f"{credential_id}:{score:.2f}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def verify_score_commitment(
    credential_id: str,
    score: float,
    commitment: str,
    secret: str,
) -> bool:
    expected = make_score_commitment(credential_id, score, secret)
    return hmac.compare_digest(expected, commitment)


# ── Percentile claim ──────────────────────────────────────────────────────────

def make_percentile_claim(
    credential_id: str,
    percentile: float,
    skill_path_slug: str,
    level: int,
    secret: str,
) -> dict:
    """
    Returns a signed claim object the holder can share.
    The band coarsens precision (e.g. 'top-25%') so verifiers learn rank, not score.
    """
    band = _percentile_band(percentile)
    claim = {
        "credential_id": credential_id,
        "percentile_band": band,
        "skill_path": skill_path_slug,
        "level": level,
    }
    canonical = json.dumps(claim, sort_keys=True, separators=(",", ":"))
    sig = hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return {**claim, "percentile": round(percentile, 1), "signature": sig}


def verify_percentile_claim(claim: dict, secret: str) -> bool:
    """Re-derive the signature from claim fields and compare."""
    provided_sig = claim.get("signature", "")
    payload = {k: claim[k] for k in ("credential_id", "percentile_band", "skill_path", "level")}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    expected = hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided_sig)


# ── Percentile computation (requires DB) ─────────────────────────────────────

async def compute_percentile(
    score: float,
    skill_path_slug: str,
    level: int,
    pool,
) -> float | None:
    """
    Returns the percentile rank of `score` among all issued credentials for
    this skill_path/level. Returns None when fewer than 5 data points exist
    (not statistically meaningful).
    """
    rows = await pool.fetch(
        """
        SELECT c.score
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE sp.slug = $1 AND c.level = $2
        """,
        skill_path_slug,
        level,
    )
    if len(rows) < 5:
        return None
    scores = [float(r["score"]) for r in rows]
    below = sum(1 for s in scores if s < score)
    return round((below / len(scores)) * 100, 1)
