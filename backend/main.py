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
            "Tu es un assistant pour un chantier de rénovation. "
            "Utilise strictement les données fournies pour répondre de manière concise en français. "
            "Cite les sections pertinentes (ex. Cuisine, WC 1) quand nécessaire."
        )

        user_content = f"Données matériaux:\n{materials_text}\n\nQuestion: {query.prompt}"

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

        return {"answer": answer.strip()}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error querying assistant: {str(e)}"
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

