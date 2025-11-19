import { useState, useEffect, useMemo } from 'react';

/**
 * Custom hook for managing table column visibility, custom columns, and column ordering
 * 
 * @param {string[]} originalColumnOrder - The default order of standard columns
 * @returns {object} Column management state and functions
 */
export function useColumnManagement(originalColumnOrder) {
  // Load column visibility preferences from localStorage
  const getStoredColumnVisibility = () => {
    try {
      const stored = localStorage.getItem('materials-table-column-visibility');
      if (stored) {
        const parsed = JSON.parse(stored);
        const visibility = {};
        originalColumnOrder.forEach(col => {
          visibility[col] = parsed[col] !== false; // Default to true if not set
        });
        return visibility;
      }
    } catch (e) {
      console.warn('Failed to load column visibility preferences:', e);
    }
    // Default: all columns visible
    return originalColumnOrder.reduce((acc, col) => {
      acc[col] = true;
      return acc;
    }, {});
  };

  const [columnVisibility, setColumnVisibility] = useState(() => getStoredColumnVisibility());

  // Load custom columns from localStorage
  const getStoredCustomColumns = () => {
    try {
      const stored = localStorage.getItem('materials-table-custom-columns');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load custom columns:', e);
    }
    return [];
  };

  const [customColumns, setCustomColumns] = useState(() => getStoredCustomColumns());

  // Load custom column order from localStorage
  const getStoredColumnOrder = (customCols = []) => {
    try {
      const stored = localStorage.getItem('materials-table-column-order');
      if (stored) {
        const parsed = JSON.parse(stored);
        const allColumns = [...originalColumnOrder, ...customCols.map(c => c.id)];
        // Validate that all columns are present
        const validOrder = parsed.filter(col => allColumns.includes(col));
        // Add any missing columns to the end
        const missingColumns = allColumns.filter(col => !validOrder.includes(col));
        return [...validOrder, ...missingColumns];
      }
    } catch (e) {
      console.warn('Failed to load column order preferences:', e);
    }
    return null; // null means use default order
  };

  const [userColumnOrder, setUserColumnOrder] = useState(() => 
    getStoredColumnOrder(getStoredCustomColumns())
  );

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('materials-table-column-visibility', JSON.stringify(columnVisibility));
    } catch (e) {
      console.warn('Failed to save column visibility preferences:', e);
    }
  }, [columnVisibility]);

  // Save custom columns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('materials-table-custom-columns', JSON.stringify(customColumns));
    } catch (e) {
      console.warn('Failed to save custom columns:', e);
    }
  }, [customColumns]);

  // Save column order to localStorage whenever it changes
  useEffect(() => {
    if (userColumnOrder) {
      try {
        localStorage.setItem('materials-table-column-order', JSON.stringify(userColumnOrder));
      } catch (e) {
        console.warn('Failed to save column order preferences:', e);
      }
    }
  }, [userColumnOrder]);

  // Get all available columns (standard + custom)
  const allAvailableColumns = useMemo(() => {
    const base = [...originalColumnOrder, ...customColumns.map(c => c.id)];
    if (userColumnOrder) {
      const ordered = userColumnOrder.filter(col => base.includes(col));
      const newColumns = base.filter(col => !userColumnOrder.includes(col));
      return [...ordered, ...newColumns];
    }
    return base;
  }, [originalColumnOrder, customColumns, userColumnOrder]);

  // Toggle column visibility
  const toggleColumnVisibility = (column) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // Show all columns
  const showAllColumns = () => {
    const allVisible = originalColumnOrder.reduce((acc, col) => {
      acc[col] = true;
      return acc;
    }, {});
    setColumnVisibility(allVisible);
  };

  // Hide all columns (then user can selectively show)
  const hideAllColumns = () => {
    const allHidden = originalColumnOrder.reduce((acc, col) => {
      acc[col] = false;
      return acc;
    }, {});
    setColumnVisibility(allHidden);
  };

  // Move column up in order
  const moveColumnUp = (columnId) => {
    const currentOrder = userColumnOrder || allAvailableColumns;
    const index = currentOrder.indexOf(columnId);
    if (index > 0) {
      const newOrder = [...currentOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setUserColumnOrder(newOrder);
    }
  };

  // Move column down in order
  const moveColumnDown = (columnId) => {
    const currentOrder = userColumnOrder || allAvailableColumns;
    const index = currentOrder.indexOf(columnId);
    if (index >= 0 && index < currentOrder.length - 1) {
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setUserColumnOrder(newOrder);
    }
  };

  // Reset column order to default
  const resetColumnOrder = () => {
    setUserColumnOrder(null);
  };

  return {
    columnVisibility,
    setColumnVisibility,
    customColumns,
    setCustomColumns,
    userColumnOrder,
    setUserColumnOrder,
    allAvailableColumns,
    toggleColumnVisibility,
    showAllColumns,
    hideAllColumns,
    moveColumnUp,
    moveColumnDown,
    resetColumnOrder
  };
}

