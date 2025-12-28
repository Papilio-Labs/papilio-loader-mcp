"""Configuration management for the MCP server and API."""

import os
import sys
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings


def get_user_data_dir() -> Path:
    """Get the appropriate user data directory based on the platform and installation type.
    
    When running as a frozen app (PyInstaller) on Windows, uses %LOCALAPPDATA%/papilio-loader-mcp
    Otherwise uses the current working directory.
    """
    # Check if running as a PyInstaller bundle
    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen and sys.platform == 'win32':
        # Running as a frozen Windows app - use AppData
        appdata = os.environ.get('LOCALAPPDATA')
        if appdata:
            user_dir = Path(appdata) / 'papilio-loader-mcp'
            user_dir.mkdir(parents=True, exist_ok=True)
            return user_dir
    
    # Default: use current working directory
    return Path.cwd()


def get_pesptool_path() -> Path:
    """Get the path to pesptool.py, handling both frozen and development environments.
    
    Returns:
        Path to pesptool.py that exists in the current environment
    """
    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen:
        # Running as compiled executable - use _MEIPASS
        base_path = Path(sys._MEIPASS)
    else:
        # Running from source - navigate from this file
        base_path = Path(__file__).parent.parent.parent
    
    return base_path / "tools" / "pesptool" / "pesptool.py"


class Config(BaseSettings):
    """Application configuration."""

    # Network settings
    bind_address: str = "0.0.0.0"  # 0.0.0.0 for remote access, 127.0.0.1 for local only
    port: int = 8000

    # Security settings
    api_key: str | None = None  # Set via environment variable for API authentication
    cors_origins: List[str] = ["*"]  # CORS allowed origins
    
    # Web interface authentication
    web_username: str = "admin"  # Web interface username
    web_password: str = "admin"  # Web interface password (change in production!)
    session_secret_key: str = "change-this-secret-key-in-production"  # For session encryption

    # Rate limiting (requests per minute)
    rate_limit: int = 60

    # File upload limits (bytes)
    max_upload_size: int = 50 * 1024 * 1024  # 50 MB

    # Serial port settings
    default_baud_rate: int = 115200
    serial_timeout: int = 10  # seconds
    
    # User data directory (for database, temp files, logs)
    user_data_dir: Path = get_user_data_dir()

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
