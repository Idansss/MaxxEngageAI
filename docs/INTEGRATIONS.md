# Integrations

Maxx Engage uses replaceable integrations. The project should never depend on a
single model, source, company, or storage provider for trust-critical behavior.

## AI Providers

- Anthropic: primary grading model.
- OpenAI: secondary cross-check model.
- Gemini: tertiary cross-check model when `GOOGLE_API_KEY` is configured.

Cross-checks run for low-confidence or human-review-triggering assessments. If
models materially disagree, the submission is forced into human review and no
automatic credential is issued.

## Trusted Public Knowledge

The backend can retrieve contextual summaries from:

- Wikipedia REST API.
- Wikidata entity search.

This context is added to grading prompts only as calibration background. Rubric
scores must still be based on the submitted work.

## GitHub Collaboration

`GET /community/github` exposes public repository metadata, open issues, and
important docs. The frontend `/community` page uses it to make collaboration
visible inside the product.

## Credential Anchoring

Every credential gets:

- `content_hash`: SHA-256 hash of the canonical credential document.
- `anchor_status`: `hashed_only`, `pinned`, or `failed`.
- `ipfs_cid`: set only when IPFS pinning succeeds.

Set `IPFS_PINATA_JWT` to pin issued credentials to IPFS via Pinata. Without it,
credentials remain signed W3C VCs with local tamper-evident hashes, but they are
not yet publicly pinned.
