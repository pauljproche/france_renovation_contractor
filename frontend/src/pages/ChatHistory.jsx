import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';

// Load AI panel sessions to get session metadata
const getAIPanelSessionsKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `ai-panel-sessions-${username}` : 'ai-panel-sessions-guest';
};

const loadAIPanelSessions = () => {
  try {
    const key = getAIPanelSessionsKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load AI panel sessions:', e);
  }
  return {};
};

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

function formatSessionDate(dateString, language) {
  const date = new Date(dateString);
  return date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function ChatHistory() {
  const { history, clearHistory, deleteEntry } = useChatHistory();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const sessions = loadAIPanelSessions();

  // Group entries by session and merge with AI panel session messages
  const groupedHistory = useMemo(() => {
    const grouped = {
      noSession: [],
      sessions: {}
    };

    // First, add all sessions from AI panel (these have the full conversation)
    Object.values(sessions).forEach(session => {
      if (session.messages && session.messages.length > 0) {
        // Convert AI panel messages to chat history format
        const sessionEntries = [];
        for (let i = 0; i < session.messages.length; i++) {
          const msg = session.messages[i];
          
          if (msg.type === 'user') {
            // Find corresponding chat history entry if it exists (for timestamp)
            const historyEntry = history.find(h => 
              h.sessionId === session.id && 
              h.prompt === msg.content
            );
            
            // Find the next assistant or error message
            const nextMsg = session.messages[i + 1];
            const response = nextMsg && nextMsg.type === 'assistant' ? nextMsg.content : null;
            const error = nextMsg && nextMsg.type === 'error' ? nextMsg.content : null;
            
            sessionEntries.push({
              id: historyEntry?.id || `session-${session.id}-${i}`,
              timestamp: historyEntry?.timestamp || new Date(session.createdAt),
              prompt: msg.content,
              response: response || historyEntry?.response || '',
              error: error || historyEntry?.error || '',
              sessionId: session.id
            });
          }
        }
        
        if (sessionEntries.length > 0) {
          grouped.sessions[session.id] = {
            session: session,
            entries: sessionEntries
          };
        }
      }
    });

    // Add chat history entries that don't have a session (legacy entries)
    history.forEach(entry => {
      if (!entry.sessionId || !sessions[entry.sessionId]) {
        grouped.noSession.push(entry);
      }
      // If entry has sessionId but session already exists, we've already included it above
      // If session doesn't exist, it means it was deleted, so we skip it
    });

    // Sort sessions by date (newest first)
    const sortedSessions = Object.values(grouped.sessions).sort((a, b) => {
      const dateA = new Date(a.session.updatedAt || a.session.createdAt);
      const dateB = new Date(b.session.updatedAt || b.session.createdAt);
      return dateB - dateA;
    });

    return {
      noSession: grouped.noSession,
      sessions: sortedSessions
    };
  }, [history, sessions]);

  const handleDeleteEntry = (entryId) => {
    if (window.confirm(t('confirmDeleteChat') || 'Are you sure you want to delete this chat entry?')) {
      // Only delete from chat history if it's a real history entry
      // Session entries can't be deleted individually (they're part of the session)
      if (history.some(h => h.id === entryId)) {
        deleteEntry(entryId);
      } else {
        // This is a session entry, show a message that it can't be deleted individually
        alert(t('cannotDeleteSessionEntry') || 'This entry is part of a session. Delete the entire session from the AI panel to remove it.');
      }
    }
  };

  const handleSaveToLibrary = (prompt, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!prompt || !prompt.trim()) {
      alert(t('noPromptToSave') || 'No prompt to save');
      return;
    }
    // Store prompt in sessionStorage for PromptLibrary to pick up
    sessionStorage.setItem('pending-prompt-to-save', prompt.trim());
    // Dispatch event to prompt library to save this prompt (in case component is already mounted)
    window.dispatchEvent(new CustomEvent('save-prompt-to-library', { 
      detail: { prompt: prompt.trim() } 
    }));
    // Navigate to prompt library
    navigate('/prompt-library');
  };

  // Calculate total entries from all sessions
  const totalEntries = useMemo(() => {
    let count = groupedHistory.noSession.length;
    groupedHistory.sessions.forEach(({ entries }) => {
      count += entries.length;
    });
    return count;
  }, [groupedHistory]);

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('chatHistoryTitle')}</h2>
          <p>{t('chatHistorySubtitle')}</p>
        </div>
        {totalEntries > 0 && (
          <button
            onClick={clearHistory}
            className="clear-history-btn"
            type="button"
          >
            {t('clearHistory')}
          </button>
        )}
      </header>

      {totalEntries === 0 ? (
        <div className="empty-state">
          <p>{t('noChatHistory')}</p>
        </div>
      ) : (
        <div className="chat-history-list">
          {/* Render grouped sessions */}
          {groupedHistory.sessions.map(({ session, entries }) => (
            <div key={session.id} className="chat-session-group">
              <div className="chat-session-header" style={{
                padding: '12px 16px',
                background: '#f3f4f6',
                borderBottom: '2px solid #e5e7eb',
                marginBottom: '8px',
                borderRadius: '4px 4px 0 0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                      {t('session') || 'Session'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                      {formatSessionDate(session.updatedAt || session.createdAt, language)}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {entries.length} {entries.length === 1 ? (t('message') || 'message') : (t('messages') || 'messages')}
                  </div>
                </div>
              </div>
              {entries.map((entry) => (
                <div key={entry.id} className="chat-entry" style={{ position: 'relative' }}>
                  <div className="chat-entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="chat-timestamp">{formatTimestamp(entry.timestamp)}</span>
                    <div style={{ display: 'flex', gap: '4px', zIndex: 10 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSaveToLibrary(entry.prompt, e);
                        }}
                        className="save-to-library-btn"
                        type="button"
                        title={t('saveToLibrary') || 'Save to Prompt Library'}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          position: 'relative',
                          zIndex: 10
                        }}
                      >
                        {t('save') || 'Save'}
                      </button>
                      {history.some(h => h.id === entry.id) && (
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="delete-chat-entry-btn"
                          type="button"
                          title={t('deleteChatEntry') || 'Delete this chat entry'}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
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
          ))}

          {/* Render entries without session (legacy entries) */}
          {groupedHistory.noSession.length > 0 && (
            <div className="chat-session-group">
              <div className="chat-session-header" style={{
                padding: '12px 16px',
                background: '#f3f4f6',
                borderBottom: '2px solid #e5e7eb',
                marginBottom: '8px',
                borderRadius: '4px 4px 0 0'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1f2937' }}>
                  {t('otherChats') || 'Other Chats'}
                </div>
              </div>
              {groupedHistory.noSession.map((entry) => (
                <div key={entry.id} className="chat-entry" style={{ position: 'relative' }}>
                  <div className="chat-entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="chat-timestamp">{formatTimestamp(entry.timestamp)}</span>
                    <div style={{ display: 'flex', gap: '4px', zIndex: 10 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSaveToLibrary(entry.prompt, e);
                        }}
                        className="save-to-library-btn"
                        type="button"
                        title={t('saveToLibrary') || 'Save to Prompt Library'}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          position: 'relative',
                          zIndex: 10
                        }}
                      >
                        {t('save') || 'Save'}
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="delete-chat-entry-btn"
                        type="button"
                        title={t('deleteChatEntry') || 'Delete this chat entry'}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ×
                      </button>
                    </div>
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
        </div>
      )}
    </>
  );
}

export default ChatHistory;



