import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { queryMaterialsAssistant } from '../services/assistant.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';
import { useAIPanel } from '../contexts/AppContext.jsx';
import { useMaterialsData, MATERIALS_RELOAD_EVENT } from '../hooks/useMaterialsData.js';
import { useCustomTable } from '../contexts/CustomTableContext.jsx';
import {
  loadAIPanelSessions,
  saveAIPanelSessions,
  getCurrentSessionId,
  setCurrentSessionId,
  createNewSession,
  saveCurrentSession,
  loadSession,
  deleteSession,
  loadAIPanelMessages,
  saveAIPanelMessages,
  clearAIPanelMessages
} from '../utils/aiPanelStorage.js';

function AIPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { addEntry } = useChatHistory();
  const { isAIPanelOpen } = useAIPanel();
  const { data: materials } = useMaterialsData();
  const { customTables } = useCustomTable();
  const location = useLocation();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  // Start with no session - session will be created when first question is asked
  const [currentSessionId, setCurrentSessionIdState] = useState(() => {
    // Don't load existing session - always start fresh
    return null;
  });
  
  const [chatMessages, setChatMessages] = useState(() => {
    // Always start with empty messages
    return [];
  });
  
  const [sessions, setSessions] = useState(() => loadAIPanelSessions());
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const contentRef = useRef(null);
  const dropdownRef = useRef(null);

  // Save current session messages whenever they change (if session exists)
  useEffect(() => {
    if (currentSessionId && chatMessages.length > 0) {
      saveCurrentSession(chatMessages);
      setSessions(loadAIPanelSessions());
    }
  }, [chatMessages, currentSessionId]);

  // End session when messages become empty (but only if we're not loading a session)
  useEffect(() => {
    if (chatMessages.length === 0 && currentSessionId) {
      // Check if this session actually has messages saved
      const sessions = loadAIPanelSessions();
      const session = sessions[currentSessionId];
      // Only end session if it doesn't have saved messages (truly empty)
      if (!session || !session.messages || session.messages.length === 0) {
        setCurrentSessionId(null);
        setCurrentSessionIdState(null);
        setSessions(loadAIPanelSessions());
      }
    }
  }, [chatMessages.length, currentSessionId]);

  // Save current session and clear when navigating away from tracking pages
  useEffect(() => {
    const isTrackingPage = !['/global-dashboard', '/settings', '/'].includes(location.pathname);
    if (!isTrackingPage) {
      // Save current session before clearing
      if (chatMessages.length > 0 && currentSessionId) {
        saveCurrentSession(chatMessages);
      }
      // Clear session and messages
      setCurrentSessionId(null);
      setCurrentSessionIdState(null);
      setChatMessages([]);
      setSessions(loadAIPanelSessions());
    }
  }, [location.pathname]); // Only run when pathname changes

  // Save session when AI panel closes or component unmounts
  useEffect(() => {
    if (!isAIPanelOpen && chatMessages.length > 0 && currentSessionId) {
      // Save session when panel closes
      saveCurrentSession(chatMessages);
      setSessions(loadAIPanelSessions());
    }
  }, [isAIPanelOpen, chatMessages, currentSessionId]);

  // Save session on component unmount (e.g., on logout)
  useEffect(() => {
    return () => {
      // Save current session when component unmounts
      if (chatMessages.length > 0 && currentSessionId) {
        saveCurrentSession(chatMessages);
      }
    };
  }, [chatMessages, currentSessionId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSessionDropdown(false);
      }
    };
    
    if (showSessionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSessionDropdown]);

  // Listen for use-prompt-from-library event
  useEffect(() => {
    const handleUsePrompt = (event) => {
      const { prompt } = event.detail;
      if (prompt) {
        setPrompt(prompt);
        // Focus the textarea
        const textarea = document.querySelector('.ai-panel-form textarea');
        if (textarea) {
          textarea.focus();
        }
      }
    };

    window.addEventListener('use-prompt-from-library', handleUsePrompt);
    return () => {
      window.removeEventListener('use-prompt-from-library', handleUsePrompt);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    // Create new session if this is the first message
    if (!currentSessionId && chatMessages.length === 0) {
      const newSession = createNewSession();
      const sessionId = newSession.id;
      setCurrentSessionId(sessionId);
      setCurrentSessionIdState(sessionId);
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
        customTables: customTables.length > 0 ? customTables : undefined,
        language
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
        sessionId: currentSessionId || undefined
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
        sessionId: currentSessionId || undefined
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    // Save current session before clearing
    if (chatMessages.length > 0 && currentSessionId) {
      saveCurrentSession(chatMessages);
    }
    // Clear messages (this will trigger the effect to end the session)
    setChatMessages([]);
    setSessions(loadAIPanelSessions());
  };

  const handleSelectSession = (sessionId) => {
    // Save current session before switching
    if (chatMessages.length > 0 && currentSessionId && currentSessionId !== sessionId) {
      saveCurrentSession(chatMessages);
    }
    // Load selected session
    const messages = loadSession(sessionId);
    // Set session ID first, then messages to avoid triggering the "end session" effect
    setCurrentSessionId(sessionId);
    setCurrentSessionIdState(sessionId);
    setChatMessages(messages || []);
    setShowSessionDropdown(false);
    setSessions(loadAIPanelSessions());
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteSession') || 'Are you sure you want to delete this session?')) {
      deleteSession(sessionId);
      setSessions(loadAIPanelSessions());
      // If deleting current session, start a new one
      if (sessionId === currentSessionId) {
        const newSession = createNewSession();
        setCurrentSessionId(newSession.id);
        setCurrentSessionIdState(newSession.id);
        setChatMessages([]);
      }
    }
  };

  const handleNewSession = (e) => {
    e.stopPropagation(); // Prevent dropdown from closing
    // Save current session before creating new one
    if (chatMessages.length > 0 && currentSessionId) {
      saveCurrentSession(chatMessages);
    }
    // Clear current session and messages (new session will be created on first question)
    setCurrentSessionId(null);
    setCurrentSessionIdState(null);
    setChatMessages([]);
    setShowSessionDropdown(false);
    setSessions(loadAIPanelSessions());
  };

  // Get sorted sessions (newest first)
  const sortedSessions = Object.values(sessions).sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt);
    const dateB = new Date(b.updatedAt || b.createdAt);
    return dateB - dateA;
  });

  const formatSessionDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <h3>{t('assistantLabel') || 'Assistant IA'}</h3>
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowSessionDropdown(!showSessionDropdown)}
              className="ai-panel-session-btn"
              title={t('chatSessions') || 'Chat Sessions'}
              style={{
                padding: '4px 8px',
                fontSize: '0.75rem',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {t('sessions') || 'Sessions'} ▼
            </button>
            {showSessionDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                minWidth: '200px',
                maxWidth: '300px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                  <button
                    type="button"
                    onClick={handleNewSession}
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    + {t('newSession') || 'New Session'}
                  </button>
                </div>
                {sortedSessions.length === 0 ? (
                  <div style={{ padding: '12px', color: '#6b7280', fontSize: '0.75rem', textAlign: 'center' }}>
                    {t('noSessions') || 'No saved sessions'}
                  </div>
                ) : (
                  sortedSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSession(session.id);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        background: session.id === currentSessionId ? '#eff6ff' : '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = session.id === currentSessionId ? '#dbeafe' : '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = session.id === currentSessionId ? '#eff6ff' : '#fff'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: session.id === currentSessionId ? 'bold' : 'normal', color: '#1f2937' }}>
                          {formatSessionDate(session.updatedAt || session.createdAt)}
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#6b7280', marginTop: '2px' }}>
                          {session.messages?.length || 0} {t('messages') || 'messages'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.625rem',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                        title={t('deleteSession') || 'Delete session'}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
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

