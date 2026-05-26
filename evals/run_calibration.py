"""
Maxx Engage Calibration Runner — HELM-style benchmarking for AI rubric grading.

Usage:
    # Single eval file:
    python evals/run_calibration.py --eval evals/web-dev-html-001.jsonl

    # All eval files in the evals/ directory:
    python evals/run_calibration.py --all

    # Skip DB persistence (dry-run):
    python evals/run_calibration.py --all --no-persist

    # Point at a deployed backend:
    python evals/run_calibration.py --all --base-url https://api.maxx-engage.io

What it measures (per eval case):
    in_range        AI score falls inside expected_score_range band
    MAE             |ai_score - human_score| when human_score is present
    within5         MAE <= 5 points
    pass_agreement  Both AI and human agree on pass/fail outcome (threshold 70)
    bias            ai_score - human_score (positive = AI generous)

Aggregate report (per eval file and across all files):
    in_range_rate   % of cases where AI stayed in expected band
    mae             Mean Absolute Error vs human ground truth
    within5_rate    % of cases within 5 points of human score
    pass_agreement  % of pass/fail outcomes matching human
    mean_bias       Average signed error (detect systematic over/under-scoring)
"""

import argparse
import json
import math
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

BASE_URL_DEFAULT = "http://localhost:8000"
EVALS_DIR = Path(__file__).parent
RESULTS_DIR = EVALS_DIR / "calibration_results"
RESULTS_DIR.mkdir(exist_ok=True)

PASS_THRESHOLD = 70.0  # must match backend PASS_SCORE_THRESHOLD

# ANSI colours
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"


# ── API calls ─────────────────────────────────────────────────────────────────

def assess(sample: dict, base_url: str) -> dict:
    sub = sample["submission"]
    payload = {
        "task_id": sample["eval_id"],
        "skill_path_slug": sample.get("skill_path_slug", "web-dev-frontend"),
        "level": sample.get("level", 1),
        "submission_type": sub["type"],
        "content": sub["content"],
        "rubric_id": sample["rubric_id"],
    }
    resp = httpx.post(f"{base_url}/assess", json=payload, timeout=90)
    resp.raise_for_status()
    return resp.json()


def persist_run(run_id: str, cases: list[dict], base_url: str) -> bool:
    """Push all cases for a run to the backend calibration log."""
    try:
        resp = httpx.post(
            f"{base_url}/admin/calibration/ingest",
            json={"run_id": run_id, "cases": cases},
            timeout=30,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"  {YELLOW}Warning: could not persist to DB — {e}{RESET}")
        return False


# ── Metric helpers ────────────────────────────────────────────────────────────

def in_range(score: float, lo: int, hi: int) -> bool:
    return lo <= score <= hi


def compute_case_metrics(ai_score: float, sample: dict) -> dict:
    human_score = sample.get("human_score")
    human_pass  = sample.get("human_pass")
    ai_pass     = ai_score >= PASS_THRESHOLD

    abs_error     = abs(ai_score - human_score) if human_score is not None else None
    bias          = (ai_score - human_score)     if human_score is not None else None
    within5       = (abs_error <= 5.0)            if abs_error is not None else None
    pass_agree    = (ai_pass == human_pass)        if human_pass is not None else None

    return {
        "abs_error":    round(abs_error, 2) if abs_error is not None else None,
        "bias":         round(bias, 2)       if bias is not None else None,
        "within5":      within5,
        "pass_agreement": pass_agree,
        "ai_pass":      ai_pass,
        "human_pass":   human_pass,
    }


def aggregate_metrics(results: list[dict]) -> dict:
    in_range_hits    = [r for r in results if "in_range" in r and r["in_range"] is True]
    errors           = [r["abs_error"]      for r in results if r.get("abs_error") is not None]
    within5_hits     = [r for r in results if r.get("within5") is True]
    within5_total    = [r for r in results if r.get("within5") is not None]
    agree_hits       = [r for r in results if r.get("pass_agreement") is True]
    agree_total      = [r for r in results if r.get("pass_agreement") is not None]
    biases           = [r["bias"]           for r in results if r.get("bias") is not None]

    n = len(results)
    return {
        "total_cases":      n,
        "in_range_rate":    round(len(in_range_hits) / n, 3) if n else None,
        "mae":              round(sum(errors) / len(errors), 2) if errors else None,
        "within5_rate":     round(len(within5_hits) / len(within5_total), 3) if within5_total else None,
        "pass_agreement":   round(len(agree_hits) / len(agree_total), 3) if agree_total else None,
        "mean_bias":        round(sum(biases) / len(biases), 2) if biases else None,
        "human_graded_n":   len(errors),
    }


# ── Per-file runner ───────────────────────────────────────────────────────────

def run_eval_file(eval_path: Path, run_id: str, base_url: str, persist: bool) -> list[dict]:
    samples = [json.loads(line) for line in eval_path.read_text(encoding="utf-8").strip().splitlines()]

    print(f"\n{BOLD}{CYAN}▶ {eval_path.name}{RESET}  ({len(samples)} cases)")
    print("─" * 72)

    case_results = []

    for i, sample in enumerate(samples, 1):
        eval_id  = sample["eval_id"]
        label    = sample["label"]
        lo, hi   = sample["expected_score_range"]
        human_sc = sample.get("human_score")

        print(f"\n  [{i}/{len(samples)}] {BOLD}{eval_id}{RESET}  label={label}")
        print(f"  Expected range : {lo}–{hi}" + (f"  |  Human score: {human_sc}" if human_sc is not None else ""))

        try:
            result   = assess(sample, base_url)
            ai_score = float(result["overall_score"])
            conf     = float(result["confidence"])
            hr_flag  = result.get("human_review_requested", False)

            ok      = in_range(ai_score, lo, hi)
            metrics = compute_case_metrics(ai_score, sample)

            status = f"{GREEN}IN RANGE{RESET}" if ok else f"{RED}OUT OF RANGE{RESET}"
            hr_tag = f" {YELLOW}[→ human queue]{RESET}" if hr_flag else ""

            print(f"  AI score       : {BOLD}{ai_score:.1f}{RESET}  conf={conf:.2f}{hr_tag}")
            print(f"  Status         : {status}", end="")

            if metrics["abs_error"] is not None:
                w5 = f"{GREEN}✓{RESET}" if metrics["within5"] else f"{YELLOW}✗{RESET}"
                pa = f"{GREEN}✓{RESET}" if metrics["pass_agreement"] else f"{RED}✗{RESET}"
                print(f"  |  MAE={metrics['abs_error']:.1f}  bias={metrics['bias']:+.1f}  within5={w5}  pass_agree={pa}", end="")
            print()

            if not ok:
                drift = ai_score - ((lo + hi) / 2)
                direction = "HIGH" if drift > 0 else "LOW"
                print(f"  {RED}Drift: {abs(drift):.1f} pts {direction} of midpoint ({(lo+hi)/2:.0f}){RESET}")

            case_row = {
                "run_id":           run_id,
                "eval_file":        eval_path.name,
                "eval_case_id":     eval_id,
                "skill_path_slug":  sample.get("skill_path_slug", "web-dev-frontend"),
                "level":            sample.get("level", 1),
                "rubric_id":        sample["rubric_id"],
                "label":            label,
                "expected_range_lo": lo,
                "expected_range_hi": hi,
                "human_score":      human_sc,
                "human_pass":       sample.get("human_pass"),
                "ai_score":         ai_score,
                "ai_confidence":    conf,
                "ai_model":         result.get("model_used", "unknown"),
                "in_range":         ok,
                "feedback_summary": result["feedback"]["summary"],
                **metrics,
            }
            case_results.append(case_row)

        except httpx.HTTPStatusError as e:
            print(f"  {RED}HTTP error: {e.response.status_code}{RESET}")
            case_results.append({"eval_case_id": eval_id, "error": str(e)})
        except Exception as e:
            print(f"  {RED}Error: {e}{RESET}")
            case_results.append({"eval_case_id": eval_id, "error": str(e)})

        time.sleep(0.5)

    # Aggregate for this file
    valid = [r for r in case_results if "error" not in r]
    agg   = aggregate_metrics(valid)

    print(f"\n  {BOLD}File summary — {eval_path.name}{RESET}")
    print(f"  In range     : {len([r for r in valid if r.get('in_range')])}/{len(valid)}"
          f"  ({100*agg['in_range_rate']:.0f}%)" if agg["in_range_rate"] is not None else "")
    if agg["mae"] is not None:
        print(f"  MAE vs human : {agg['mae']:.2f} pts")
    if agg["within5_rate"] is not None:
        print(f"  Within 5 pts : {100*agg['within5_rate']:.0f}%")
    if agg["pass_agreement"] is not None:
        print(f"  Pass agree   : {100*agg['pass_agreement']:.0f}%")
    if agg["mean_bias"] is not None:
        bias_dir = "AI grades GENEROUS" if agg["mean_bias"] > 0 else "AI grades HARSH"
        print(f"  Mean bias    : {agg['mean_bias']:+.2f}  ({bias_dir})")

    # Persist to DB
    if persist and valid:
        persisted = persist_run(run_id, valid, base_url)
        if persisted:
            print(f"  {GREEN}Persisted {len(valid)} cases to calibration_log (run_id={run_id}){RESET}")

    # Save JSON result file
    stem     = eval_path.stem
    out_path = RESULTS_DIR / f"{stem}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.json"
    out_path.write_text(json.dumps({
        "run_id":    run_id,
        "run_at":    datetime.now(timezone.utc).isoformat(),
        "eval_file": eval_path.name,
        "aggregate": agg,
        "cases":     case_results,
    }, indent=2), encoding="utf-8")
    print(f"  Results → {out_path}")

    return case_results


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Maxx Engage rubric calibration runner")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--eval", help="Path to a single .jsonl eval file")
    group.add_argument("--all", action="store_true", help="Run all .jsonl files in the evals/ directory")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT, help=f"API base URL (default: {BASE_URL_DEFAULT})")
    parser.add_argument("--no-persist", action="store_true", help="Skip writing results to the DB")
    args = parser.parse_args()

    run_id   = str(uuid.uuid4())
    persist  = not args.no_persist
    base_url = args.base_url.rstrip("/")

    if args.all:
        eval_files = sorted(EVALS_DIR.glob("*.jsonl"))
        if not eval_files:
            print("No .jsonl files found in evals/", file=sys.stderr)
            sys.exit(1)
    else:
        p = Path(args.eval)
        if not p.exists():
            print(f"File not found: {args.eval}", file=sys.stderr)
            sys.exit(1)
        eval_files = [p]

    print(f"\n{BOLD}Maxx Engage Calibration Run{RESET}")
    print(f"Run ID    : {run_id}")
    print(f"Timestamp : {datetime.now(timezone.utc).isoformat()}")
    print(f"API URL   : {base_url}")
    print(f"Eval files: {len(eval_files)}")
    print(f"Persist   : {'yes' if persist else 'no (--no-persist)'}")

    all_results: list[dict] = []
    for eval_file in eval_files:
        results = run_eval_file(eval_file, run_id, base_url, persist)
        all_results.extend(results)

    if len(eval_files) > 1:
        valid_all = [r for r in all_results if "error" not in r]
        agg_all   = aggregate_metrics(valid_all)
        print(f"\n{'═' * 72}")
        print(f"{BOLD}Overall Calibration Report  ({len(eval_files)} files, {len(valid_all)} cases){RESET}")
        if agg_all["in_range_rate"] is not None:
            pct = 100 * agg_all["in_range_rate"]
            color = GREEN if pct >= 80 else (YELLOW if pct >= 60 else RED)
            print(f"  In range     : {color}{pct:.0f}%{RESET}")
        if agg_all["mae"] is not None:
            color = GREEN if agg_all["mae"] <= 5 else (YELLOW if agg_all["mae"] <= 10 else RED)
            print(f"  MAE vs human : {color}{agg_all['mae']:.2f} pts{RESET}")
        if agg_all["within5_rate"] is not None:
            pct = 100 * agg_all["within5_rate"]
            color = GREEN if pct >= 80 else (YELLOW if pct >= 60 else RED)
            print(f"  Within 5 pts : {color}{pct:.0f}%{RESET}")
        if agg_all["pass_agreement"] is not None:
            pct = 100 * agg_all["pass_agreement"]
            color = GREEN if pct >= 90 else (YELLOW if pct >= 75 else RED)
            print(f"  Pass agree   : {color}{pct:.0f}%{RESET}")
        if agg_all["mean_bias"] is not None:
            bias_dir = "AI GENEROUS" if agg_all["mean_bias"] > 1 else ("AI HARSH" if agg_all["mean_bias"] < -1 else "NEUTRAL")
            print(f"  Mean bias    : {agg_all['mean_bias']:+.2f}  ({bias_dir})")

        verdict = (
            f"{GREEN}{BOLD}Well-calibrated.{RESET}" if (agg_all.get("mae") or 99) <= 7 and (agg_all.get("in_range_rate") or 0) >= 0.8
            else f"{YELLOW}Needs attention — review failing cases and tighten rubric scoring_guide.{RESET}"
        )
        print(f"\n  Verdict: {verdict}")


if __name__ == "__main__":
    main()
