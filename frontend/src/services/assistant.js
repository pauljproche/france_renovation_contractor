const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function queryMaterialsAssistant({ prompt, materials, customTables, language = 'en' }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/assistant/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        materials,
        customTables,
        language
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Backend request failed (${response.status})`);
    }

    const result = await response.json();
    
    // Phase 5: Check if response contains preview (requires confirmation)
    if (result.preview) {
      return {
        type: 'preview',
        preview: result.preview,
        action_id: result.action_id,
        message: result.message || {
          en: 'I\'ve prepared an action. Please review the preview and confirm to execute.',
          fr: 'J\'ai préparé une action. Veuillez examiner l\'aperçu et confirmer pour exécuter.'
        }
      };
    }
    
    // Return both English and French versions
    // Ensure we have valid strings, defaulting to answer if answer_fr is missing
    const enAnswer = result.answer || '';
    const frAnswer = result.answer_fr || enAnswer || '';
    
    return {
      type: 'response',
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

// Phase 5: Confirm action endpoint
export async function confirmAction(actionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/assistant/confirm-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action_id: actionId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Failed to confirm action (${response.status})`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Make sure the FastAPI server is running on port 8000.');
    }
    throw err;
  }
}

// Phase 5: Get action preview
export async function getActionPreview(actionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/assistant/preview/${actionId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Failed to get preview (${response.status})`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Make sure the FastAPI server is running on port 8000.');
    }
    throw err;
  }
}