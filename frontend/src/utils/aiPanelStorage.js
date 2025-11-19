/**
 * Utility functions for managing AI Panel session storage
 * Handles localStorage and sessionStorage operations for chat sessions
 */

// Storage key for AI panel chat sessions
export const getAIPanelSessionsKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `ai-panel-sessions-${username}` : 'ai-panel-sessions-guest';
};

// Storage key for current session ID
export const getCurrentSessionIdKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `ai-panel-current-session-${username}` : 'ai-panel-current-session-guest';
};

// Load all chat sessions from localStorage
export const loadAIPanelSessions = () => {
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

// Save all chat sessions to localStorage
export const saveAIPanelSessions = (sessions) => {
  try {
    const key = getAIPanelSessionsKey();
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch (e) {
    console.warn('Failed to save AI panel sessions:', e);
  }
};

// Get current session ID
export const getCurrentSessionId = () => {
  try {
    const key = getCurrentSessionIdKey();
    return sessionStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

// Set current session ID
export const setCurrentSessionId = (sessionId) => {
  try {
    const key = getCurrentSessionIdKey();
    if (sessionId) {
      sessionStorage.setItem(key, sessionId);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Failed to set current session ID:', e);
  }
};

// Create a new session
export const createNewSession = () => {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  return {
    id: sessionId,
    createdAt: now.toISOString(),
    messages: []
  };
};

// Save current session
export const saveCurrentSession = (messages) => {
  if (messages.length === 0) return; // Don't save empty sessions
  
  const sessionId = getCurrentSessionId();
  if (!sessionId) return;
  
  const sessions = loadAIPanelSessions();
  sessions[sessionId] = {
    id: sessionId,
    createdAt: sessions[sessionId]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: messages
  };
  saveAIPanelSessions(sessions);
};

// Load a specific session's messages
export const loadSession = (sessionId) => {
  const sessions = loadAIPanelSessions();
  return sessions[sessionId]?.messages || [];
};

// Delete a session
export const deleteSession = (sessionId) => {
  const sessions = loadAIPanelSessions();
  delete sessions[sessionId];
  saveAIPanelSessions(sessions);
};

// Storage key for AI panel messages
export const getAIPanelStorageKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `ai-panel-messages-${username}` : 'ai-panel-messages-guest';
};

// Load AI panel messages from localStorage
export const loadAIPanelMessages = () => {
  try {
    const key = getAIPanelStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load AI panel messages:', e);
  }
  return [];
};

// Save AI panel messages to localStorage
export const saveAIPanelMessages = (messages) => {
  try {
    const key = getAIPanelStorageKey();
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (e) {
    console.warn('Failed to save AI panel messages:', e);
  }
};

// Clear AI panel messages from localStorage
export const clearAIPanelMessages = () => {
  try {
    const key = getAIPanelStorageKey();
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear AI panel messages:', e);
  }
};

