"""
Calibration runner for ProofOS rubrics.

Usage:
    python evals/run_calibration.py --eval evals/web-dev-html-001.jsonl

What it does:
  1. Reads each sample from the JSONL eval file.
  2. Calls POST /assess on the running local server.
  3. Compares AI score to the expected_score_range in the eval.
  4. Prints a human-readable calibration report.
  5. Saves results to evals/calibration_results/<eval_id>.json

A PASS means the AI score fell inside expected_score_range.
A FAIL means it drifted outside — fix the rubric or the grading prompt.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

BASE_URL = "http://localhost:8000"
RESULTS_DIR = Path(__file__).parent / "calibration_results"
RESULTS_DIR.mkdir(exist_ok=True)

# ANSI colours for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def assess(sample: dict) -> dict:
    sub = sample["submission"]
    payload = {
        "task_id": sample["eval_id"],
        "skill_path_slug": "web-dev-frontend",
        "level": 1,
        "submission_type": sub["type"],
        "content": sub["content"],
        "rubric_id": sample["rubric_id"],
    }
    resp = httpx.post(f"{BASE_URL}/assess", json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()


def in_range(score: float, expected_range: list[int]) -> bool:
    lo, hi = expected_range
    return lo <= score <= hi


def run(eval_path: str) -> None:
    samples = [json.loads(line) for line in Path(eval_path).read_text().strip().splitlines()]
    results = []
    passed = 0

    print(f"\n{BOLD}{CYAN}ProofOS Calibration Run{RESET}")
    print(f"Eval file : {eval_path}")
    print(f"Timestamp : {datetime.now(timezone.utc).isoformat()}")
    print(f"Samples   : {len(samples)}")
    print("-" * 72)

    for i, sample in enumerate(samples, 1):
        eval_id = sample["eval_id"]
        label = sample["label"]
        expected = sample["expected_score_range"]
        notes = sample.get("notes", "")

        print(f"\n[{i}/{len(samples)}] {BOLD}{eval_id}{RESET}  ({label})")
        print(f"  Expected range : {expected[0]}–{expected[1]}")

        try:
            result = assess(sample)
            ai_score = result["overall_score"]
            confidence = result["confidence"]
            human_review = result["human_review_requested"]
            ok = in_range(ai_score, expected)

            status = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
            human_flag = f"{YELLOW} [→ human review queue]{RESET}" if human_review else ""

            print(f"  AI score       : {BOLD}{ai_score:.1f}{RESET}  confidence={confidence:.2f}{human_flag}")
            print(f"  Status         : {status}")
            print(f"  Summary        : {result['feedback']['summary'][:120]}...")

            if not ok:
                drift = ai_score - ((expected[0] + expected[1]) / 2)
                direction = "HIGH" if drift > 0 else "LOW"
                print(f"  {RED}Drift: {abs(drift):.1f} points {direction} of expected midpoint{RESET}")
                print(f"  Rubric note    : {notes}")

            if ok:
                passed += 1

            results.append({
                "eval_id": eval_id,
                "label": label,
                "expected_range": expected,
                "ai_score": ai_score,
                "confidence": confidence,
                "human_review_requested": human_review,
                "passed": ok,
                "feedback_summary": result["feedback"]["summary"],
                "strengths": result["feedback"]["strengths"],
                "improvements": result["feedback"]["improvements"],
                "model_used": result["model_used"],
            })

        except httpx.HTTPStatusError as e:
            print(f"  {RED}HTTP error: {e.response.status_code} — {e.response.text[:200]}{RESET}")
            results.append({"eval_id": eval_id, "error": str(e)})
        except Exception as e:
            print(f"  {RED}Error: {e}{RESET}")
            results.append({"eval_id": eval_id, "error": str(e)})

        time.sleep(0.5)  # be polite to the API

    # ── Summary ────────────────────────────────────────────────────────────────
    total = len(samples)
    print("\n" + "─" * 72)
    print(f"{BOLD}Calibration Summary{RESET}")
    print(f"  Passed : {passed}/{total}  ({100*passed//total}%)")
    print(f"  Failed : {total - passed}/{total}")

    if passed == total:
        print(f"\n  {GREEN}{BOLD}All samples within expected range. Rubric is well-calibrated.{RESET}")
    elif passed >= total * 0.8:
        print(f"\n  {YELLOW}Most samples pass. Review failing cases and adjust rubric scoring_guide.{RESET}")
    else:
        print(f"\n  {RED}More than 20% of samples outside range. Rubric or grading prompt needs revision.{RESET}")

    # ── Save results ───────────────────────────────────────────────────────────
    stem = Path(eval_path).stem
    out_path = RESULTS_DIR / f"{stem}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.json"
    out_path.write_text(json.dumps({"run_at": datetime.now(timezone.utc).isoformat(), "results": results}, indent=2))
    print(f"\n  Full results saved to: {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ProofOS rubric calibration runner")
    parser.add_argument("--eval", required=True, help="Path to .jsonl eval file")
    args = parser.parse_args()

    if not Path(args.eval).exists():
        print(f"Error: eval file not found: {args.eval}", file=sys.stderr)
        sys.exit(1)

    run(args.eval)
