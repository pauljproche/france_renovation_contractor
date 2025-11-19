const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Log an edit to the edit history.
 */
export async function logEdit({ sectionId, sectionLabel, itemIndex, product, fieldPath, oldValue, newValue, source = 'manual' }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/edit-history/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section_id: sectionId,
        section_label: sectionLabel,
        item_index: itemIndex,
        product: product || '',
        field_path: fieldPath,
        old_value: oldValue,
        new_value: newValue,
        source: source
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Failed to log edit (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Make sure the FastAPI server is running on port 8000.');
    }
    throw err;
  }
}

/**
 * Get edit history from the backend.
 */
export async function getEditHistory(limit = 100) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/edit-history?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `Failed to get edit history (${response.status})`);
    }

    const result = await response.json();
    return result.history || [];
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to backend API. Make sure the FastAPI server is running on port 8000.');
    }
    throw err;
  }
}





