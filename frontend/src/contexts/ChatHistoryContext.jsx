import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { generateUUID } from '../utils/uuid.js';

const ChatHistoryContext = createContext(undefined);

// Get user-specific storage key
const getStorageKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `chat-history-${username}` : 'chat-history-guest';
};

// Load chat history from localStorage for current user
const loadHistory = () => {
  try {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return parsed.map(entry => ({
        ...entry,
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
      }));
    }
  } catch (e) {
    console.warn('Failed to load chat history:', e);
  }
  return [];
};

// Save chat history to localStorage for current user
const saveHistory = (history) => {
  try {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save chat history:', e);
  }
};

export function ChatHistoryProvider({ children }) {
  const [history, setHistory] = useState(() => loadHistory());
  const [lastStorageKey, setLastStorageKey] = useState(() => getStorageKey());

  // Save to localStorage whenever history changes
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Reload history when username changes (user logs in/out)
  useEffect(() => {
    // Reload history on mount to ensure we have the right user's data
    const currentKey = getStorageKey();
    if (currentKey !== lastStorageKey) {
      setLastStorageKey(currentKey);
      setHistory(loadHistory());
    }
    
    // Also reload when window gains focus (in case user logged in/out in another tab)
    const handleFocus = () => {
      const key = getStorageKey();
      if (key !== lastStorageKey) {
        setLastStorageKey(key);
        setHistory(loadHistory());
      }
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [lastStorageKey]);

  const addEntry = useCallback((entry) => {
    // Check if username changed before adding entry
    const currentKey = getStorageKey();
    if (currentKey !== lastStorageKey) {
      setLastStorageKey(currentKey);
      setHistory(loadHistory());
    }
    
    const newEntry = {
      ...entry,
      id: generateUUID(),
      timestamp: new Date()
    };
    setHistory((prev) => {
      const updated = [newEntry, ...prev];
      return updated;
    });
    return newEntry;
  }, [lastStorageKey]);

  const deleteEntry = useCallback((entryId) => {
    setHistory((prev) => prev.filter(entry => entry.id !== entryId));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <ChatHistoryContext.Provider value={{ history, addEntry, deleteEntry, clearHistory }}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (context === undefined) {
    throw new Error('useChatHistory must be used within ChatHistoryProvider');
  }
  return context;
}

