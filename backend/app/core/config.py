from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AI providers
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    primary_grading_model: str = "claude-sonnet-4-6"
    secondary_grading_model: str = "gpt-4o"
    tertiary_grading_model: str = "gemini-1.5-pro"
    model_disagreement_score_threshold: float = 10.0
    model_crosscheck_enabled: bool = True

    # Database — direct Postgres (Neon) + Supabase for auth/realtime
    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    port: int = 8000
    # Comma-separated list of allowed origins.
    # Production: set to your Vercel URL, e.g. https://maxx-engage.vercel.app
    cors_origins: str = "http://localhost:3000"

    # Scoring thresholds
    ai_confidence_threshold: float = 0.70
    pass_score_threshold: int = 70
    human_review_score_band: int = 5

    # Admin — comma-separated list of emails that can access /admin/* routes
    admin_emails: str = ""

    # ZK commitments — HMAC secret for score commitments and percentile claims.
    # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    # Must be kept secret; rotation requires re-issuing all existing commitments.
    zk_secret_key: str = "change-me-in-production"

    # Proof-of-personhood — Gitcoin Passport Scorer API
    # Create a scorer at https://scorer.gitcoin.co/ to get these values.
    gitcoin_api_key: str = ""
    gitcoin_scorer_id: str = ""

    # GitHub API token (optional — increases rate limit from 60 to 5000 req/hr)
    # Create at https://github.com/settings/tokens (no scopes needed for public API)
    github_token: str = ""
    github_repo_owner: str = "Idansss"
    github_repo_name: str = "MaxxEngageAI"

    # Public community links surfaced in the app.
    discord_invite_url: str = ""
    public_github_url: str = "https://github.com/Idansss/MaxxEngageAI"

    # Knowledge retrieval. Start with trusted public sources only.
    knowledge_retrieval_enabled: bool = True
    wikipedia_api_url: str = "https://en.wikipedia.org/api/rest_v1"
    wikipedia_action_api_url: str = "https://en.wikipedia.org/w/api.php"
    wikidata_api_url: str = "https://www.wikidata.org/w/api.php"
    knowledge_max_sources: int = 4

    # Optional IPFS pinning. If unset, credentials still get a deterministic
    # SHA-256 content anchor but are not pinned to a public network.
    ipfs_pinata_jwt: str = ""
    ipfs_gateway_url: str = "https://gateway.pinata.cloud/ipfs"

    # Outbound webhooks — optional; fires on key events (see app/services/webhook.py)
    webhook_url: str = ""       # e.g. https://your-lms.io/hooks/maxx-engage
    webhook_secret: str = ""    # HMAC-SHA256 signing secret

    # Observability
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.10
    otel_enabled: bool = False
    otel_service_name: str = "maxx-engage-api"
    otel_exporter_otlp_endpoint: str = ""
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "maxx-engage"

    # Safety and bias checks
    safety_checks_enabled: bool = True
    safety_force_human_review: bool = True

    # W3C VC issuer keypair — generate ONCE with: python scripts/generate_issuer_key.py
    # Rotating this key invalidates all previously issued credential signatures.
    issuer_private_key_b64: str = ""          # Raw Ed25519 private key, base64-encoded
    issuer_public_key_multibase: str = ""     # z6Mk... (multibase base58btc Ed25519 pubkey)
    issuer_did: str = "did:web:maxx-engage.io"    # Overridden to did:key:z6Mk... once key is generated

    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.environment.lower() == "production":
            unsafe = {
                origin
                for origin in origins
                if origin == "*"
                or origin.startswith("http://localhost")
                or origin.startswith("http://127.0.0.1")
            }
            if unsafe:
                raise ValueError(
                    "Production CORS_ORIGINS must not include wildcard or localhost origins."
                )
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
