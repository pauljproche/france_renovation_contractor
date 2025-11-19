import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';

// Storage key for prompt library
const getPromptLibraryKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `prompt-library-${username}` : 'prompt-library-guest';
};

// Load prompts from localStorage
const loadPrompts = () => {
  try {
    const key = getPromptLibraryKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load prompt library:', e);
  }
  return [];
};

// Save prompts to localStorage
const savePrompts = (prompts) => {
  try {
    const key = getPromptLibraryKey();
    localStorage.setItem(key, JSON.stringify(prompts));
  } catch (e) {
    console.warn('Failed to save prompt library:', e);
  }
};

function PromptLibrary() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [prompts, setPrompts] = useState(() => loadPrompts());
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const promptsRef = useRef(prompts);

  // Keep ref in sync with prompts
  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  // Function to save a prompt
  const savePromptToLibrary = useCallback((promptText) => {
    if (!promptText || !promptText.trim()) {
      return;
    }
    
    const trimmed = promptText.trim();
    
    // Check if prompt already exists
    const exists = promptsRef.current.some(p => p.prompt.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert(t('promptAlreadyExists') || 'This prompt already exists in your library.');
      return;
    }
    
    // Auto-save the prompt
    const newPromptObj = {
      id: crypto.randomUUID(),
      prompt: trimmed,
      category: null,
      createdAt: new Date().toISOString(),
      usedCount: 0
    };
    
    setPrompts(prev => [newPromptObj, ...prev]);
  }, [t]);

  // Check for pending prompt from sessionStorage on mount
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('pending-prompt-to-save');
    if (pendingPrompt) {
      sessionStorage.removeItem('pending-prompt-to-save');
      savePromptToLibrary(pendingPrompt);
    }
  }, [savePromptToLibrary]);

  // Listen for save-prompt-to-library event from chat history
  useEffect(() => {
    const handleSavePrompt = (event) => {
      const { prompt } = event.detail;
      savePromptToLibrary(prompt);
    };

    window.addEventListener('save-prompt-to-library', handleSavePrompt);
    return () => {
      window.removeEventListener('save-prompt-to-library', handleSavePrompt);
    };
  }, [savePromptToLibrary]);

  // Save prompts whenever they change
  useEffect(() => {
    savePrompts(prompts);
  }, [prompts]);

  // Filter prompts by search query
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) {
      return prompts;
    }
    const query = searchQuery.toLowerCase();
    return prompts.filter(p => 
      p.prompt.toLowerCase().includes(query) ||
      (p.category && p.category.toLowerCase().includes(query))
    );
  }, [prompts, searchQuery]);

  // Group prompts by category
  const groupedPrompts = useMemo(() => {
    const grouped = {
      uncategorized: [],
      categories: {}
    };

    filteredPrompts.forEach(prompt => {
      if (prompt.category && prompt.category.trim()) {
        if (!grouped.categories[prompt.category]) {
          grouped.categories[prompt.category] = [];
        }
        grouped.categories[prompt.category].push(prompt);
      } else {
        grouped.uncategorized.push(prompt);
      }
    });

    return grouped;
  }, [filteredPrompts]);

  const handleAddPrompt = () => {
    if (!newPrompt.trim()) {
      return;
    }

    const prompt = {
      id: crypto.randomUUID(),
      prompt: newPrompt.trim(),
      category: newCategory.trim() || null,
      createdAt: new Date().toISOString(),
      usedCount: 0
    };

    setPrompts(prev => [prompt, ...prev]);
    setNewPrompt('');
    setNewCategory('');
    setShowAddForm(false);
  };

  const handleDeletePrompt = (id) => {
    if (window.confirm(t('confirmDeletePrompt') || 'Are you sure you want to delete this prompt?')) {
      setPrompts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleUsePrompt = (promptText, promptId) => {
    // Increment used count
    setPrompts(prev => prev.map(p => 
      p.id === promptId ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p
    ));
    
    // Dispatch event to AI panel to use this prompt
    window.dispatchEvent(new CustomEvent('use-prompt-from-library', { 
      detail: { prompt: promptText } 
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('promptLibraryTitle') || 'Prompt Library'}</h2>
          <p>{t('promptLibrarySubtitle') || 'Save and manage your frequently used prompts'}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="button primary"
          type="button"
        >
          {showAddForm ? (t('cancel') || 'Cancel') : (t('addPrompt') || '+ Add Prompt')}
        </button>
      </header>

      {showAddForm && (
        <div style={{
          padding: '16px',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
              {t('prompt') || 'Prompt'}
            </label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder={t('enterPrompt') || 'Enter your prompt...'}
              rows={4}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
              {t('category') || 'Category'} ({t('optional') || 'Optional'})
            </label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={t('enterCategory') || 'e.g., Materials, Validation, etc.'}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAddPrompt}
              className="button primary"
              type="button"
            >
              {t('save') || 'Save'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewPrompt('');
                setNewCategory('');
              }}
              className="button"
              type="button"
            >
              {t('cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPrompts') || 'Search prompts...'}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.875rem'
          }}
        />
      </div>

      {prompts.length === 0 ? (
        <div className="empty-state">
          <p>{t('noPrompts') || 'No prompts saved yet. Add your first prompt to get started!'}</p>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="empty-state">
          <p>{t('noMatchingPrompts') || 'No prompts match your search.'}</p>
        </div>
      ) : (
        <div>
          {/* Render categorized prompts */}
          {Object.entries(groupedPrompts.categories).map(([category, categoryPrompts]) => (
            <div key={category} style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                {category}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {categoryPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    style={{
                      padding: '16px',
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, marginBottom: '8px', fontSize: '0.875rem', color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                          {prompt.prompt}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>{formatDate(prompt.createdAt)}</span>
                          {prompt.usedCount > 0 && (
                            <span>{t('used') || 'Used'} {prompt.usedCount} {prompt.usedCount === 1 ? (t('time') || 'time') : (t('times') || 'times')}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleUsePrompt(prompt.prompt, prompt.id)}
                          className="button primary"
                          type="button"
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          title={t('usePrompt') || 'Use this prompt'}
                        >
                          {t('use') || 'Use'}
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="button"
                          type="button"
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none'
                          }}
                          title={t('deletePrompt') || 'Delete this prompt'}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Render uncategorized prompts */}
          {groupedPrompts.uncategorized.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                {t('uncategorized') || 'Uncategorized'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groupedPrompts.uncategorized.map((prompt) => (
                  <div
                    key={prompt.id}
                    style={{
                      padding: '16px',
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, marginBottom: '8px', fontSize: '0.875rem', color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                          {prompt.prompt}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>{formatDate(prompt.createdAt)}</span>
                          {prompt.usedCount > 0 && (
                            <span>{t('used') || 'Used'} {prompt.usedCount} {prompt.usedCount === 1 ? (t('time') || 'time') : (t('times') || 'times')}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleUsePrompt(prompt.prompt, prompt.id)}
                          className="button primary"
                          type="button"
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          title={t('usePrompt') || 'Use this prompt'}
                        >
                          {t('use') || 'Use'}
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="button"
                          type="button"
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none'
                          }}
                          title={t('deletePrompt') || 'Delete this prompt'}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default PromptLibrary;

