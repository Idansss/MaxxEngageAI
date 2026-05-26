# Reviewer Training

Human reviewers are the guardrail for credentials that can affect opportunity.
The goal is not to rubber-stamp the AI. The goal is calibrated, fair judgment.

## Reviewer Duties

- Review the submission against the rubric only.
- Check whether cited evidence really exists in the submission.
- Compare AI score, secondary model score, and any model disagreement.
- Approve credentials only when the work clearly meets the pass threshold.
- Send borderline, low-confidence, or suspicious work back with clear feedback.

## Calibration Routine

1. Grade 10 shared eval submissions independently.
2. Compare against the expected score range and founder/human reference scores.
3. Discuss score deltas greater than 5 points.
4. Record the decision rule that resolved the disagreement.
5. Add that case to `evals/` if it reveals a recurring ambiguity.

## Escalate To Human Review When

- AI confidence is below the configured threshold.
- Model scores disagree by 10+ points.
- The pass/fail outcome differs between models.
- The submission may contain prompt injection or copied work.
- The work is credential-eligible but the evidence is weak.

## Reviewer Decision Labels

- `approve`: credential may be issued or verified by human.
- `needs_revision`: promising work, but not credential-ready.
- `reject`: fails the rubric or violates integrity rules.
- `escalate`: requires founder/admin decision.

## Bias Checks

Reviewers should ignore school, nationality, accent, writing style prestige, and
connections unless the rubric explicitly tests communication quality. Judge the
work product, not the social signal around the worker.
