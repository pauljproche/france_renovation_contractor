import { useState } from 'react';
import { queryMaterialsAssistant } from '../services/assistant.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';
import { useLanguage } from '../contexts/AppContext.jsx';

function LLMRequestForm({ materials }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { addEntry } = useChatHistory();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    const userPrompt = prompt.trim();
    setLoading(true);
    setError('');
    setResponse('');

    try {
      // Phase 5: Don't send full materials dataset when using database
      // Backend will use query tools instead, reducing token usage
      const answer = await queryMaterialsAssistant({ prompt: userPrompt, materials: {}, language });
      setResponse(answer);
      setPrompt(''); // Clear the input after successful submission
      
      // Save to chat history
      addEntry({
        prompt: userPrompt,
        response: answer,
      });
    } catch (err) {
      const errorMessage = err.message || t('assistantError');
      setError(errorMessage);
      
      // Save error to chat history too
      addEntry({
        prompt: userPrompt,
        response: '',
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="assistant-form" onSubmit={handleSubmit}>
      <label htmlFor="assistant-prompt">{t('assistantLabel')}</label>
      <textarea
        id="assistant-prompt"
        placeholder={t('assistantPlaceholder')}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? t('asking') : t('submit')}
      </button>
      {error && <p className="warning">{error}</p>}
      {response && <div className="assistant-response">{response}</div>}
    </form>
  );
}

export default LLMRequestForm;

