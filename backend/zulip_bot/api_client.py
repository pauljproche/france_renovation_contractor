"""
API client for calling the FastAPI assistant endpoint.
"""

import json
import httpx
from typing import Optional, Dict, Any


def load_materials_data(file_path: str) -> Dict[str, Any]:
    """
    Load materials data from JSON file.
    
    Args:
        file_path: Path to materials.json file
    
    Returns:
        dict: Materials data
    
    Raises:
        FileNotFoundError: If materials file doesn't exist
        json.JSONDecodeError: If file is not valid JSON
    """
    with open(file_path, encoding='utf-8') as f:
        return json.load(f)


def query_assistant(
    api_base_url: str,
    prompt: str,
    materials: Optional[Dict[str, Any]] = None,
    custom_tables: Optional[list] = None,
    timeout: float = 60.0
) -> Dict[str, str]:
    """
    Query the FastAPI assistant endpoint (synchronous).
    
    Args:
        api_base_url: Base URL of the FastAPI server (e.g., http://localhost:8000)
        prompt: User's question/prompt
        materials: Materials data dictionary (optional)
        custom_tables: Custom table configurations (optional)
        timeout: Request timeout in seconds
    
    Returns:
        dict: Response with keys:
            - en: English answer
            - fr: French answer
    
    Raises:
        httpx.HTTPError: If the HTTP request fails
        ValueError: If the response is invalid
    """
    url = f"{api_base_url}/api/assistant/query"
    
    payload = {
        "prompt": prompt,
        "materials": materials,
        "customTables": custom_tables
    }
    
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        
        result = response.json()
        
        # Extract English and French answers
        return {
            "en": result.get("answer", ""),
            "fr": result.get("answer_fr", result.get("answer", ""))
        }

