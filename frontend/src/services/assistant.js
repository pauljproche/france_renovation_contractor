const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function queryMaterialsAssistant({ prompt, materials }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/assistant/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        materials
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Backend request failed (${response.status})`);
    }

    const result = await response.json();
    const answer = result.answer;
    if (!answer) {
      throw new Error('Assistant returned an empty response.');
    }
    return answer;
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Make sure the FastAPI server is running on port 8000.');
    }
    throw err;
  }
}

