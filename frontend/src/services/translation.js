const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Translate text from English to the target language
 * For now, uses a simple backend endpoint. Can be enhanced with Google Translate API later.
 */
export async function translateText(text, targetLanguage = 'fr') {
  // If target language is English, return original
  if (targetLanguage === 'en') {
    return text;
  }

  try {
    // For now, we'll use a simple approach - call the backend to translate
    // This assumes we add a translation endpoint, or we can use a client-side library
    // For MVP, let's use a simple fetch to a translation API or backend endpoint
    
    // TODO: Add backend translation endpoint or use a translation service
    // For now, return a placeholder that indicates translation is needed
    // In production, this would call a translation API
    
    // Simple approach: Use browser's built-in translation or a service
    // For now, we'll create a backend endpoint for translation
    
    const response = await fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        target_language: targetLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const result = await response.json();
    return result.translated_text || text;
  } catch (err) {
    // Fallback: return original text if translation fails
    console.error('Translation error:', err);
    return text;
  }
}

