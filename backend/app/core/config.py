from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AI providers
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    primary_grading_model: str = "claude-sonnet-4-6"
    secondary_grading_model: str = "gpt-4o"

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
    # Production: set to your Vercel URL, e.g. https://proofos.vercel.app
    cors_origins: str = "http://localhost:3000"

    # Scoring thresholds
    ai_confidence_threshold: float = 0.70
    pass_score_threshold: int = 70
    human_review_score_band: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
