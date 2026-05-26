# Contributing to Maxx Engage

Maxx Engage is a public-benefit competence verification system. Contributions
should make the system more useful, more honest, and harder to capture.

## Start Here

1. Read `MANIFESTO.md`.
2. Read `docs/TECHNICAL_SPEC.md`.
3. Pick an issue labeled `help wanted` or `enhancement`.
4. Keep changes narrow and explain the trust/safety impact in the pull request.

## Engineering Rules

- No secret scoring paths. User-facing scores must be explainable.
- No new closed-source dependency for core trust behavior without a written reason.
- Keep provider integrations replaceable. Claude, GPT, Gemini, and future models
  must be swappable.
- Prefer open standards: W3C DIDs, W3C Verifiable Credentials, IPFS-compatible
  content addressing, and public audit logs.
- Any grading behavior change needs at least one eval or calibration note.

## Pull Request Checklist

- Backend checks pass.
- Frontend build passes if UI changed.
- No secrets committed.
- User-facing copy says `Maxx Engage`, not old project names.
- Security, privacy, or fairness tradeoffs are called out in the PR body.

## Local Setup

See `docs/HOW_TO_RUN.md`.
