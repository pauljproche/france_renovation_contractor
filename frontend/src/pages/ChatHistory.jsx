import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';

function formatTimestamp(date) {
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${dateStr} at ${timeStr}`;
}

function ChatHistory() {
  const { history, clearHistory } = useChatHistory();
  const { t } = useTranslation();
  const { language } = useLanguage();

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('chatHistoryTitle')}</h2>
          <p>{t('chatHistorySubtitle')}</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="clear-history-btn"
            type="button"
          >
            {t('clearHistory')}
          </button>
        )}
      </header>

      {history.length === 0 ? (
        <div className="empty-state">
          <p>{t('noChatHistory')}</p>
        </div>
      ) : (
        <div className="chat-history-list">
          {history.map((entry) => (
            <div key={entry.id} className="chat-entry">
              <div className="chat-entry-header">
                <span className="chat-timestamp">{formatTimestamp(entry.timestamp)}</span>
              </div>
              
              <div className="chat-prompt">
                <div className="chat-label">{t('question')}:</div>
                <div className="chat-content">{entry.prompt}</div>
              </div>

              {entry.error ? (
                <div className="chat-response chat-error">
                  <div className="chat-label">{t('error')}:</div>
                  <div className="chat-content">{entry.error}</div>
                </div>
              ) : (
                <div className="chat-response">
                  <div className="chat-label">{t('response')}:</div>
                  <div className="chat-content">
                    {(() => {
                      // Handle both old format (string) and new format (object with en/fr)
                      if (typeof entry.response === 'object' && entry.response !== null) {
                        // New format: object with en and fr
                        if (language === 'en') {
                          return entry.response.en || entry.response.fr || '';
                        } else {
                          return entry.response.fr || entry.response.en || '';
                        }
                      } else {
                        // Old format: just a string (fallback)
                        return entry.response || '';
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default ChatHistory;



