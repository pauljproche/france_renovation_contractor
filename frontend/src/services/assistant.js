const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function queryMaterialsAssistant({ prompt, materials, customTables }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/assistant/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        materials,
        customTables
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Backend request failed (${response.status})`);
    }

    const result = await response.json();
    // Return both English and French versions
    // Ensure we have valid strings, defaulting to answer if answer_fr is missing
    const enAnswer = result.answer || '';
    const frAnswer = result.answer_fr || enAnswer || '';
    
    return {
      en: enAnswer,
      fr: frAnswer
    };
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Make sure the FastAPI server is running on port 8000.');
    }
    throw err;
  }
}

