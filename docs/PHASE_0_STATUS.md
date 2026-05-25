# Phase 0 Status

Phase 0 goal: make ProofOS publicly legible before expanding the product.

## Checklist

- [x] `MANIFESTO.md` exists in the repository.
- [x] Public GitHub repo exists: https://github.com/Idansss/MaxxEngageAI
- [x] Technical spec exists: `docs/TECHNICAL_SPEC.md`
- [x] AGPL license file exists: `LICENSE`
- [ ] Discord or Telegram community opened.
- [ ] Issue for "Pick the first skill domain for the Competence Engine MVP" opened.

## Notes

The GitHub repo is public and currently has an open Issue #1, but Issue #1 is
not the Phase 0 skill-domain issue. It is titled:

`Calibration: run web-dev-html-001 eval against Claude and record first scores`

Because Issue #1 is already used, open the skill-domain issue as the next issue.

Suggested title:

`Pick the first skill domain for the Competence Engine MVP`

Suggested body:

```md
## Decision

Pick the first skill domain for ProofOS MVP.

## Default candidate

Frontend web development.

## Why this is the default

- It is objectively testable: code either runs or fails.
- It produces visible work users can show publicly.
- It has broad market demand.
- It fits low-bandwidth, laptop-first users.
- It supports fast calibration with small HTML/CSS/JS tasks.

## Alternatives

- Data analysis: strong demand, but grading requires datasets and clearer
  ground truth.
- Technical writing: valuable and accessible, but subjective grading makes
  calibration harder.
- Business operations: useful for global talent, but harder to verify in small
  tasks.

## Acceptance criteria

- The chosen domain has one starter rubric.
- The chosen domain has at least 10 eval examples.
- The chosen domain can produce one user-owned credential.
```

## Community Launch

Recommended minimum community setup:

- Telegram first for Lagos/African founder-led early community.
- Discord later if channels, roles, and reviewer onboarding become complex.

Minimum channels/topics:

- announcements
- pick-first-skill-domain
- reviewer-interest
- build-log
- bug-reports
