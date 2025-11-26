"""
Configuration management for Zulip bot.

Loads configuration from environment variables and provides
a centralized configuration object.
"""

import os
from dotenv import load_dotenv


def load_config():
    """
    Load configuration from environment variables.
    
    Returns:
        dict: Configuration dictionary with keys:
            - email: Zulip bot email
            - api_key: Zulip bot API key
            - site: Zulip server URL (without protocol)
            - bot_name: Bot name/username
            - api_base_url: FastAPI backend URL (default: http://localhost:8000)
            - materials_file_path: Path to materials.json file
    
    Raises:
        SystemExit: If required environment variables are missing
    """
    # Load .env file from backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(backend_dir, '.env')
    
    # Try loading from backend/.env first, then fall back to default behavior
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()  # Fall back to default search
    
    # Zulip configuration
    email = os.getenv("ZULIP_EMAIL")
    api_key = os.getenv("ZULIP_API_KEY")
    site = os.getenv("ZULIP_SITE")
    bot_name = os.getenv("ZULIP_BOT_NAME", "contractor_bot")
    
    # FastAPI backend configuration
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    # Materials data file path
    materials_file_path = os.getenv(
        "MATERIALS_FILE_PATH",
        os.path.join(backend_dir, "..", "data", "materials.json")
    )
    
    # Validate required Zulip configuration
    if not email:
        raise ValueError("ZULIP_EMAIL environment variable not set")
    if not api_key:
        raise ValueError("ZULIP_API_KEY environment variable not set")
    if not site:
        raise ValueError("ZULIP_SITE environment variable not set")
    
    # Strip https:// or http:// from site URL if present
    # Zulip client expects just the domain name
    site = site.replace("https://", "").replace("http://", "").rstrip("/")
    
    return {
        "email": email,
        "api_key": api_key,
        "site": site,
        "bot_name": bot_name,
        "api_base_url": api_base_url,
        "materials_file_path": materials_file_path
    }






