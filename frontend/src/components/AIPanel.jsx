import { useState, useRef, useEffect } from 'react';
import { queryMaterialsAssistant } from '../services/assistant.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';
import { useAIPanel } from '../contexts/AppContext.jsx';
import { useMaterialsData } from '../hooks/useMaterialsData.js';

function AIPanel() {
  const { t } = useTranslation();
  const { addEntry } = useChatHistory();
  const { isAIPanelOpen } = useAIPanel();
  const { data: materials } = useMaterialsData();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const contentRef = useRef(null);

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
      const answer = await queryMaterialsAssistant({ prompt: userPrompt, materials });
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

  // Auto-scroll to bottom when response is received
  useEffect(() => {
    if (response && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [response]);

  return (
    <aside className={`ai-panel ${!isAIPanelOpen ? 'ai-panel-hidden' : ''}`}>
      <div className="ai-panel-header">
        <h3>{t('assistantLabel') || 'Assistant IA'}</h3>
      </div>
      <div className="ai-panel-content" ref={contentRef}>
        {!response && !error && !loading && (
          <div className="ai-panel-welcome">
            <p>{t('assistantWelcome')}</p>
          </div>
        )}
        {loading && (
          <div className="ai-panel-loading">
            <span className="loader">{t('asking') || 'Envoi...'}</span>
          </div>
        )}
        {response && (
          <div className="ai-panel-response">
            <div className="ai-response-header">
              <span className="ai-response-label">{t('response')}</span>
            </div>
            <div className="ai-response-content">{response}</div>
          </div>
        )}
        {error && (
          <div className="ai-panel-error">
            <span className="warning">{error}</span>
          </div>
        )}
      </div>
      <form className="ai-panel-form" onSubmit={handleSubmit}>
        <textarea
          placeholder={t('assistantPlaceholder') || 'Posez votre question...'}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
        />
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? (t('asking') || 'Envoi...') : (t('submit') || 'Envoyer')}
        </button>
      </form>
    </aside>
  );
}

export default AIPanel;

