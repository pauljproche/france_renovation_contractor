import { createContext, useContext, useState, useCallback } from 'react';

const ChatHistoryContext = createContext(undefined);

export function ChatHistoryProvider({ children }) {
  const [history, setHistory] = useState([]);

  const addEntry = useCallback((entry) => {
    const newEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    setHistory((prev) => [newEntry, ...prev]);
    return newEntry;
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <ChatHistoryContext.Provider value={{ history, addEntry, clearHistory }}>
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

