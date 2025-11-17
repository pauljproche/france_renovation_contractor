import { useState, useRef, useEffect } from 'react';
import { queryMaterialsAssistant } from '../services/assistant.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';
import { useAIPanel } from '../contexts/AppContext.jsx';
import { useMaterialsData, MATERIALS_RELOAD_EVENT } from '../hooks/useMaterialsData.js';
import { useCustomTable } from '../contexts/CustomTableContext.jsx';

function AIPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { addEntry } = useChatHistory();
  const { isAIPanelOpen } = useAIPanel();
  const { data: materials } = useMaterialsData();
  const { customTables } = useCustomTable();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // Store all chat messages with both EN and FR
  const contentRef = useRef(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    const userPrompt = prompt.trim();
    const userMessage = { type: 'user', content: userPrompt };
    
    // Add user message immediately
    setChatMessages(prev => [...prev, userMessage]);
    setPrompt(''); // Clear the input
    setLoading(true);

    try {
      const answer = await queryMaterialsAssistant({ 
        prompt: userPrompt, 
        materials,
        customTables: customTables.length > 0 ? customTables : undefined
      });
      // answer is now an object with { en, fr }
      const assistantMessage = { 
        type: 'assistant', 
        content: answer // Store both en and fr
      };
      
      // Add assistant response
      setChatMessages(prev => [...prev, assistantMessage]);

      const updatePattern = /(successfully updated|has been updated|mis à jour|a été mis à jour)/i;
      const englishText = answer?.en || '';
      const frenchText = answer?.fr || '';
      if (updatePattern.test(englishText) || updatePattern.test(frenchText)) {
        window.dispatchEvent(new CustomEvent(MATERIALS_RELOAD_EVENT));
      }
      
      // Save to chat history (for Chat History page) - save both languages
      addEntry({
        prompt: userPrompt,
        response: answer, // Save both en and fr
      });
    } catch (err) {
      const errorMessage = err.message || t('assistantError');
      const errorMessageObj = { type: 'error', content: errorMessage };
      
      // Add error message
      setChatMessages(prev => [...prev, errorMessageObj]);
      
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

  const handleClear = () => {
    setChatMessages([]);
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [chatMessages, loading]);

  return (
    <aside className={`ai-panel ${!isAIPanelOpen ? 'ai-panel-hidden' : ''}`}>
      <div className="ai-panel-header">
        <h3>{t('assistantLabel') || 'Assistant IA'}</h3>
        {chatMessages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="ai-panel-clear-btn"
            title={t('clearChat') || 'Clear chat'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
      <div className="ai-panel-content" ref={contentRef}>
        {chatMessages.length === 0 && !loading && (
          <div className="ai-panel-welcome">
            <p>{t('assistantWelcome')}</p>
          </div>
        )}
        {chatMessages.map((message, index) => (
          <div key={index} className={`ai-panel-message ai-panel-message-${message.type}`}>
            {message.type === 'user' && (
              <div className="ai-panel-user-message">
                <div className="ai-panel-message-label">{t('you') || 'You'}</div>
                <div className="ai-panel-message-content">{message.content}</div>
              </div>
            )}
            {message.type === 'assistant' && (
              <div className="ai-panel-response">
                <div className="ai-response-header">
                  <span className="ai-response-label">{t('response') || 'Response'}</span>
                </div>
                <div className="ai-response-content">
                  {(() => {
                    // Handle both old format (string) and new format (object with en/fr)
                    if (typeof message.content === 'object' && message.content !== null) {
                      // New format: object with en and fr
                      if (language === 'en') {
                        return message.content.en || message.content.fr || '';
                      } else {
                        return message.content.fr || message.content.en || '';
                      }
                    } else {
                      // Old format: just a string (fallback)
                      return message.content || '';
                    }
                  })()}
                </div>
              </div>
            )}
            {message.type === 'error' && (
              <div className="ai-panel-error">
                <span className="warning">{message.content}</span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="ai-panel-loading">
            <span className="loader">{t('asking') || 'Envoi...'}</span>
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

