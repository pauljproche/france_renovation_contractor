from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import json
import re
import httpx
from typing import Optional, Any, Tuple, List
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Path to materials.json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MATERIALS_FILE_PATH = os.path.join(BASE_DIR, '..', 'data', 'materials.json')
EDIT_HISTORY_FILE_PATH = os.path.join(BASE_DIR, '..', 'data', 'edit-history.json')

app = FastAPI(title="Renovation Contractor API")

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],  # Common Vite dev ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None
default_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def load_materials_data() -> dict:
    with open(MATERIALS_FILE_PATH, encoding='utf-8') as f:
        return json.load(f)


def write_materials_data(data: dict) -> None:
    with open(MATERIALS_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_edit_history() -> List[dict]:
    """Load edit history from file."""
    if not os.path.exists(EDIT_HISTORY_FILE_PATH):
        return []
    try:
        with open(EDIT_HISTORY_FILE_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_edit_history(history: List[dict]) -> None:
    """Save edit history to file."""
    with open(EDIT_HISTORY_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def log_edit(section_id: str, section_label: str, item_index: int, product: str, 
             field_path: str, old_value: Any, new_value: Any, source: str = "manual") -> None:
    """Log an edit to the history."""
    history = load_edit_history()
    edit_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "section_id": section_id,
        "section_label": section_label,
        "item_index": item_index,
        "product": product or "(empty product)",
        "field_path": field_path,
        "old_value": old_value,
        "new_value": new_value,
        "source": source  # "manual" or "agent"
    }
    history.append(edit_entry)
    # Keep only last 1000 entries
    if len(history) > 1000:
        history = history[-1000:]
    save_edit_history(history)


def set_nested_value(target: dict, field_path: str, value: Any) -> None:
    parts = field_path.split('.')
    current = target
    for part in parts[:-1]:
        if part not in current or not isinstance(current[part], dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def normalize_identifier(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def match_section(sections: list[dict], identifier: str) -> Optional[dict]:
    """Return a section by matching either its id or label (case-insensitive)."""
    target = normalize_identifier(identifier)
    if not target:
        return None
    for section in sections:
        section_id = normalize_identifier(section.get("id"))
        section_label = normalize_identifier(section.get("label"))
        if target in (section_id, section_label):
            return section
    return None


def get_nested_value(target: dict, field_path: str) -> Any:
    """Get a nested value from a dict using dot notation."""
    parts = field_path.split('.')
    current = target
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def update_cell(section_id: str, item_index: int, field_path: str, new_value: Any, source: str = "agent") -> Tuple[dict, dict]:
    data = load_materials_data()
    sections = data.get('sections', [])
    section = match_section(sections, section_id)
    if not section:
        raise ValueError(f"Section '{section_id}' not found (match allowed on id or label).")
    items = section.get('items', [])
    if item_index < 0 or item_index >= len(items):
        raise ValueError(f"Item index {item_index} is out of bounds for section '{section_id}'.")
    item = items[item_index]
    
    # Get old value before updating
    old_value = get_nested_value(item, field_path)
    
    # Update the value
    set_nested_value(item, field_path, new_value)
    write_materials_data(data)
    
    # Log the edit
    product = item.get('product', '')
    section_label = section.get('label', section_id)
    log_edit(section_id, section_label, item_index, product, field_path, old_value, new_value, source)
    
    return data, item


class MaterialsQuery(BaseModel):
    prompt: str
    materials: Optional[dict] = None
    customTables: Optional[list] = None


class MaterialsUpdate(BaseModel):
    materials: dict[str, Any]


class TranslationRequest(BaseModel):
    text: str
    target_language: str


class ImageExtractionRequest(BaseModel):
    url: str
    reference: Optional[str] = None


class EditLogRequest(BaseModel):
    section_id: str
    section_label: str
    item_index: int
    product: str
    field_path: str
    old_value: Any
    new_value: Any
    source: str = "manual"


@app.get("/")
async def root():
    return {"message": "Renovation Contractor API", "status": "running"}


@app.post("/api/assistant/query")
async def query_assistant(query: MaterialsQuery):
    """
    Query the LLM assistant with a prompt and materials data.
    """
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Assistant endpoint is unavailable because OPENAI_API_KEY is not configured."
        )
    try:
        # Serialize materials data for the prompt
        materials_text = "No materials data provided."
        if query.materials and query.materials.get("sections"):
            sections_summary = []
            for section in query.materials["sections"]:
                section_data = {
                    "section": section.get("label", ""),
                    "sectionId": section.get("id", ""),
                    "items": []
                }
                for idx, item in enumerate(section.get("items", [])):
                    section_data["items"].append({
                        "index": idx,
                        "product": item.get("product", ""),
                        "reference": item.get("reference"),
                        "priceTTC": item.get("price", {}).get("ttc"),
                        "approvals": item.get("approvals", {}),
                        "order": item.get("order", {})
                    })
                sections_summary.append(section_data)
            materials_text = json.dumps(sections_summary, indent=2, ensure_ascii=False)

        # Add custom table information if available
        custom_tables_info = ""
        if query.customTables and len(query.customTables) > 0:
            custom_tables_text = []
            for idx, table in enumerate(query.customTables, 1):
                columns = table.get("columns", [])
                column_labels = table.get("columnLabels", {})
                sort_column = table.get("sortColumn", "")
                sort_direction = table.get("sortDirection", "")
                
                column_names = [column_labels.get(col, col) for col in columns]
                custom_tables_text.append(
                    f"Custom Table {idx}:\n"
                    f"  - Columns: {', '.join(column_names)}\n"
                    f"  - Sorted by: {column_labels.get(sort_column, sort_column)} ({sort_direction})"
                )
            custom_tables_info = "\n\nCustom Tables Created:\n" + "\n".join(custom_tables_text) + "\n"

        system_prompt = (
            "You are an assistant for a renovation construction site. "
            "Use strictly the provided data to respond concisely. "
            "Cite relevant sections (e.g., Kitchen, WC 1) when necessary and reference both the section label and its sectionId when describing updates. "
            "If custom tables are provided, you can reference them and their specific column configurations. "
            "When the user asks for a change, extract the section (either label or sectionId), the zero-based item index, the exact field path, "
            "and the new value directly from their request plus the data context, then immediately call the update_cell tool with those details. "
            "Do not ask the user to confirm once you have enough information—act autonomously. "
            "IMPORTANT: Always provide your response in BOTH English and French. "
            "Format exactly as follows (no other text before or after):\n"
            "EN: [Your English response here]\n"
            "FR: [Your French response here]"
        )

        user_content = f"Materials data:\n{materials_text}{custom_tables_info}\n\nQuestion: {query.prompt}"

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "update_cell",
                    "description": (
                        "Update a single field in the materials table. "
                        "Use this only after confirming the exact section, item index, and field path."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "section_id": {
                                "type": "string",
                                "description": "Section identifier, e.g. 'kitchen'."
                            },
                            "item_index": {
                                "type": "integer",
                                "description": "Zero-based index of the item within the section."
                            },
                            "field_path": {
                                "type": "string",
                                "description": (
                                    "Dot-delimited path to the field to update. "
                                    "Examples: 'price.ttc', 'approvals.client.status', 'order.delivery.date'."
                                )
                            },
                            "new_value": {
                                "description": "New value to set. Use the appropriate JSON type.",
                                "anyOf": [
                                    {"type": "string"},
                                    {"type": "number"},
                                    {"type": "boolean"},
                                    {"type": "object"},
                                    {"type": "array", "items": {}},
                                    {"type": "null"}
                                ]
                            }
                        },
                        "required": ["section_id", "item_index", "field_path", "new_value"]
                    }
                }
            }
        ]

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        response = client.chat.completions.create(
            model=default_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.2
        )

        response_message = response.choices[0].message

        if response_message.tool_calls:
            messages.append({
                "role": "assistant",
                "content": response_message.content or "",
                "tool_calls": [tc.dict() for tc in response_message.tool_calls]
            })

            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                if function_name != "update_cell":
                    tool_response_content = json.dumps({"error": f"Unknown tool {function_name}"})
                else:
                    try:
                        arguments = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError as exc:
                        tool_response_content = json.dumps({"error": f"Invalid arguments: {exc}"})
                    else:
                        try:
                            _, updated_item = update_cell(
                                section_id=arguments["section_id"],
                                item_index=arguments["item_index"],
                                field_path=arguments["field_path"],
                                new_value=arguments["new_value"]
                            )
                        except Exception as exc:
                            tool_response_content = json.dumps({"status": "error", "detail": str(exc)})
                        else:
                            tool_response_content = json.dumps({
                                "status": "success",
                                "section_id": arguments["section_id"],
                                "item_index": arguments["item_index"],
                                "field_path": arguments["field_path"],
                                "new_value": arguments["new_value"],
                                "updated_item": updated_item
                            })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_response_content
                })

            final_response = client.chat.completions.create(
                model=default_model,
                messages=messages,
                temperature=0.2
            )
            final_message = final_response.choices[0].message
            answer = final_message.content
        else:
            answer = response_message.content

        if not answer:
            raise HTTPException(status_code=500, detail="Empty response from OpenAI")

        # Parse the response to extract English and French versions
        answer_text = answer.strip()
        english_answer = answer_text  # Default fallback
        french_answer = answer_text   # Default fallback
        
        # Try to extract EN and FR versions
        # Look for "EN:" and "FR:" markers
        en_index = answer_text.find("EN:")
        fr_index = answer_text.find("FR:")
        
        if en_index != -1 and fr_index != -1:
            # Both markers found
            if en_index < fr_index:
                # Format: EN: ... FR: ...
                english_part = answer_text[en_index + 3:fr_index].strip()
                french_part = answer_text[fr_index + 3:].strip()
            else:
                # Format: FR: ... EN: ... (unusual but handle it)
                french_part = answer_text[fr_index + 3:en_index].strip()
                english_part = answer_text[en_index + 3:].strip()
            
            # Clean up whitespace
            english_part = ' '.join(english_part.split())
            french_part = ' '.join(french_part.split())
            
            if english_part:
                english_answer = english_part
            if french_part:
                french_answer = french_part
        elif en_index != -1:
            # Only EN: found
            english_part = answer_text[en_index + 3:].strip()
            english_part = ' '.join(english_part.split())
            if english_part:
                english_answer = english_part
                french_answer = english_part  # Fallback: use English for both
        elif fr_index != -1:
            # Only FR: found - this is a problem, but handle it
            french_part = answer_text[fr_index + 3:].strip()
            french_part = ' '.join(french_part.split())
            if french_part:
                french_answer = french_part
                english_answer = french_part  # Fallback: use French for both (shouldn't happen)

        return {
            "answer": english_answer,
            "answer_fr": french_answer
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error querying assistant: {str(e)}"
        )


@app.post("/api/translate")
async def translate_text(request: TranslationRequest):
    """
    Translate text from English to target language using OpenAI.
    """
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Translation endpoint is unavailable because OPENAI_API_KEY is not configured."
        )
    try:
        if request.target_language == 'en':
            return {"translated_text": request.text}
        
        # Map language codes to full names
        language_map = {
            'fr': 'French',
            'es': 'Spanish',
            'de': 'German',
            # Add more as needed
        }
        target_lang_name = language_map.get(request.target_language, 'French')
        
        translation_prompt = f"Translate the following English text to {target_lang_name}. Only return the translation, no explanations:\n\n{request.text}"
        
        response = client.chat.completions.create(
            model=default_model,
            messages=[
                {"role": "system", "content": f"You are a professional translator. Translate English text to {target_lang_name} accurately and naturally."},
                {"role": "user", "content": translation_prompt}
            ],
            temperature=0.3
        )
        
        translated_text = response.choices[0].message.content.strip()
        if not translated_text:
            raise HTTPException(status_code=500, detail="Empty translation from OpenAI")
        
        return {"translated_text": translated_text}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error translating text: {str(e)}"
        )


@app.post("/api/extract-product-image")
async def extract_product_image(request: ImageExtractionRequest):
    """
    Extract product image URL from a product page.
    Works with Reuter.com and other sites that use standard HTML img tags.
    For Reuter.com, can construct image URL directly from product reference.
    """
    try:
        url = request.url.strip() if request.url else ''
        reference = request.reference.strip() if request.reference else None
        
        # For Reuter.com, try to construct image URL directly from reference
        # Pattern: https://img.reuter.com/products/fg/400x400/fg-{reference}0.jpg
        # From the HTML we saw: reference "31574SD1" -> image "fg-31574sd10.jpg" (lowercase + trailing 0)
        if reference and len(reference) > 0:
            # Clean reference (remove spaces, convert to lowercase)
            reference_clean = reference.strip().lower().replace(' ', '').replace('-', '')
            
            # Primary pattern: lowercase reference + trailing "0" (most common)
            # Return this directly - browser will handle 404s
            image_url = f"https://img.reuter.com/products/fg/400x400/fg-{reference_clean}0.jpg"
            return {"image_url": image_url}
        
        # If no reference provided or patterns didn't work, try extracting from URL
        if 'reuter.com' in url.lower() and not url.endswith('-') and url.endswith('.php'):
            # Extract product code from URL
            # For Reuter URLs like: .../grohe-k700-evier-de-cuisine-actionnement-manuel-l-54-p-44-cm-acier-inoxydable-satine-a935827.php
            ref_match = re.search(r'-([a-z])(\d+)\.php$', url, re.IGNORECASE)
            if ref_match:
                # Extract the product code (like a935827)
                product_code = (ref_match.group(1) + ref_match.group(2)).lower()
                # Try the code-based pattern
                image_url = f"https://img.reuter.com/products/fg/400x400/fg-{product_code}.jpg"
                try:
                    async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                        response = await client.head(image_url, headers=headers)
                        if response.status_code == 200:
                            return {"image_url": image_url}
                except:
                    pass
        
        # Fallback: Fetch the HTML page if URL is valid
        if not url or not url.startswith(('http://', 'https://')):
            return {"image_url": None, "error": "Invalid URL"}
        
        # Skip fetching if URL looks truncated (ends with -)
        if url.endswith('-') or url.endswith('reuter.com'):
            return {"image_url": None, "error": "URL appears to be truncated"}
        
        # Fetch the HTML page
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.text
        
        # Extract image URL using multiple strategies
        image_url = None
        
        # Strategy 1: Look for og:image meta tag
        og_image_match = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
        if og_image_match:
            image_url = og_image_match.group(1)
        
        # Strategy 2: Look for img.reuter.com pattern (Reuter-specific)
        if not image_url:
            reuter_img_match = re.search(r'https://img\.reuter\.com/products/[^"\'\s<>]+\.jpg', html_content, re.IGNORECASE)
            if reuter_img_match:
                image_url = reuter_img_match.group(0)
        
        # Strategy 3: Look for first product image in gallery (data-qa="productGalleryGrid-thumbnail-0" or similar)
        if not image_url:
            gallery_img_match = re.search(r'<img[^>]*data-qa=["\']productGalleryGrid-thumbnail-0["\'][^>]*src=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
            if gallery_img_match:
                image_url = gallery_img_match.group(1)
        
        # Strategy 4: Look for img tag with product-related classes or alt text
        if not image_url:
            # Find img tags and look for ones that might be product images
            img_matches = re.finditer(r'<img[^>]*src=["\']([^"\']+)["\'][^>]*>', html_content, re.IGNORECASE)
            for match in img_matches:
                img_src = match.group(1)
                img_tag = match.group(0)
                # Check if it looks like a product image (has width/height, or contains "product" in URL)
                if ('width' in img_tag and 'height' in img_tag) or 'product' in img_src.lower():
                    # Prefer images from img.reuter.com or similar CDN
                    if 'img.reuter.com' in img_src or 'cdn' in img_src.lower() or 'image' in img_src.lower():
                        image_url = img_src
                        break
        
        if not image_url:
            return {"image_url": None, "error": "No product image found on page"}
        
        # Clean up the URL (remove query params that might cause issues, but keep the path)
        if '?' in image_url:
            image_url = image_url.split('?')[0]
        
        return {"image_url": image_url}
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch product page: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting product image: {str(e)}"
        )


@app.put("/api/materials")
async def update_materials(update: MaterialsUpdate):
    """
    Update the materials.json file with new data.
    Validates the structure before saving.
    """
    try:
        # Basic validation - check required top-level fields
        if not isinstance(update.materials, dict):
            raise HTTPException(status_code=400, detail="Materials must be a JSON object")
        
        if 'sections' not in update.materials:
            raise HTTPException(status_code=400, detail="Missing 'sections' field")
        
        if not isinstance(update.materials['sections'], list):
            raise HTTPException(status_code=400, detail="'sections' must be an array")
        
        # Write to file
        with open(MATERIALS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(update.materials, f, indent=2, ensure_ascii=False)
        
        return {"message": "Materials updated successfully", "status": "ok"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating materials: {str(e)}"
        )


@app.post("/api/edit-history/log")
async def log_edit_entry(edit_log: EditLogRequest):
    """
    Log an edit to the edit history.
    """
    try:
        log_edit(
            section_id=edit_log.section_id,
            section_label=edit_log.section_label,
            item_index=edit_log.item_index,
            product=edit_log.product,
            field_path=edit_log.field_path,
            old_value=edit_log.old_value,
            new_value=edit_log.new_value,
            source=edit_log.source
        )
        return {"message": "Edit logged successfully", "status": "ok"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error logging edit: {str(e)}"
        )


@app.get("/api/edit-history")
async def get_edit_history(limit: Optional[int] = 100):
    """
    Get edit history, optionally limited to the most recent entries.
    """
    try:
        history = load_edit_history()
        # Return most recent entries first
        history.reverse()
        if limit and limit > 0:
            history = history[:limit]
        return {"history": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving edit history: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

