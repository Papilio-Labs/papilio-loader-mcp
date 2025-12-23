"""Configuration management for the MCP server and API."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Application configuration."""

    # Network settings
    bind_address: str = "0.0.0.0"  # 0.0.0.0 for remote access, 127.0.0.1 for local only
    port: int = 8000

    # Security settings
    api_key: str | None = None  # Set via environment variable for API authentication
    cors_origins: List[str] = ["*"]  # CORS allowed origins

    # Rate limiting (requests per minute)
    rate_limit: int = 60

    # File upload limits (bytes)
    max_upload_size: int = 50 * 1024 * 1024  # 50 MB

    # Serial port settings
    default_baud_rate: int = 115200
    serial_timeout: int = 10  # seconds

    class Config:
        env_prefix = "PAPILIO_"
        case_sensitive = False


_config: Config | None = None


def get_config() -> Config:
    """Get or create the global config instance."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def reload_config() -> Config:
    """Reload configuration from environment."""
    global _config
    _config = Config()
    return _config
