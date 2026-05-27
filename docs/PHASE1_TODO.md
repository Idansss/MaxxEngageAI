# Phase 1 TODO Status

## Done

- [x] Fix production build.
- [x] Fix frontend lint errors.
- [x] Make `/assess/[slug]` the real assessment route.
- [x] Reuse the shared credential issuer for human-review approvals.
- [x] Auto-generate a username when the first credential is earned.
- [x] Let proof-page owners view private proof pages.
- [x] Add route-segment `/u/[username]/opengraph-image.tsx`.
- [x] Use initials in a colored-circle fallback avatar.
- [x] Add missing credential contract fields: `passed` and `graded_at`.
- [x] Add a Phase 1 smoke script.
- [x] Update local run and migration documentation.
- [x] Hide Phase 2/3 entry points from the Phase 1 UI:
  leaderboard links, employer talent-search links, referral links, and generated learning-path CTAs.

## Still Open

- [ ] Atomic commits.

The original prompt asked for one commit per deliverable. The worktree already
contains many changed and untracked files, so this cannot be retroactively
guaranteed without explicitly grouping and committing the current work. Do not
commit generated local server logs.

## Verification

- [x] `npm run lint`
- [x] `npm run build`
- [x] `backend\.venv\Scripts\python.exe scripts\smoke_phase1.py`
- [x] `backend\.venv\Scripts\python.exe -m compileall backend\app scripts\smoke_phase1.py`
