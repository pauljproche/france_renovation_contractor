/**
 * Utility functions for managing Prompt Library storage
 * Handles localStorage operations for user-specific prompt libraries
 */

// Storage key for prompt library
export const getPromptLibraryKey = () => {
  const username = sessionStorage.getItem('username');
  return username ? `prompt-library-${username}` : 'prompt-library-guest';
};

// Load prompts from localStorage
export const loadPrompts = () => {
  try {
    const key = getPromptLibraryKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load prompts:', e);
  }
  return [];
};

// Save prompts to localStorage
export const savePrompts = (prompts) => {
  try {
    const key = getPromptLibraryKey();
    localStorage.setItem(key, JSON.stringify(prompts));
  } catch (e) {
    console.warn('Failed to save prompts:', e);
  }
};

