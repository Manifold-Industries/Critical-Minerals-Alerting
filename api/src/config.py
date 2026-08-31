from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables."""

    app_name: str = "Critical Minerals Alerting API"
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_prefix="API_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
