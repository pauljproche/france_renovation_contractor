from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import json
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()

# Path to materials.json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MATERIALS_FILE_PATH = os.path.join(BASE_DIR, '..', 'data', 'materials.json')

app = FastAPI(title="Renovation Contractor API")

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable is required")

client = OpenAI(api_key=api_key)
default_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class MaterialsQuery(BaseModel):
    prompt: str
    materials: Optional[dict] = None


class MaterialsUpdate(BaseModel):
    materials: dict[str, Any]


class TranslationRequest(BaseModel):
    text: str
    target_language: str


@app.get("/")
async def root():
    return {"message": "Renovation Contractor API", "status": "running"}


@app.post("/api/assistant/query")
async def query_assistant(query: MaterialsQuery):
    """
    Query the LLM assistant with a prompt and materials data.
    """
    try:
        # Serialize materials data for the prompt
        materials_text = "No materials data provided."
        if query.materials and query.materials.get("sections"):
            sections_summary = []
            for section in query.materials["sections"]:
                section_data = {
                    "section": section.get("label", ""),
                    "items": []
                }
                for item in section.get("items", []):
                    section_data["items"].append({
                        "product": item.get("product", ""),
                        "reference": item.get("reference"),
                        "priceTTC": item.get("price", {}).get("ttc"),
                        "approvals": item.get("approvals", {}),
                        "order": item.get("order", {})
                    })
                sections_summary.append(section_data)
            import json
            materials_text = json.dumps(sections_summary, indent=2, ensure_ascii=False)

        system_prompt = (
            "You are an assistant for a renovation construction site. "
            "Use strictly the provided data to respond concisely. "
            "Cite relevant sections (e.g., Kitchen, WC 1) when necessary. "
            "IMPORTANT: Always provide your response in BOTH English and French. "
            "Format exactly as follows (no other text before or after):\n"
            "EN: [Your English response here]\n"
            "FR: [Your French response here]"
        )

        user_content = f"Materials data:\n{materials_text}\n\nQuestion: {query.prompt}"

        response = client.chat.completions.create(
            model=default_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2
        )

        answer = response.choices[0].message.content
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

