import { createContext, useContext, useState } from 'react';

const CustomTableContext = createContext(undefined);

export function CustomTableProvider({ children }) {
  const [customTables, setCustomTables] = useState([]);

  const addCustomTable = (tableInfo) => {
    setCustomTables(prev => {
      // Check if table with same columns already exists
      const exists = prev.some(table => 
        JSON.stringify(table.columns) === JSON.stringify(tableInfo.columns)
      );
      if (exists) {
        return prev;
      }
      return [...prev, {
        id: Date.now().toString(),
        ...tableInfo,
        createdAt: new Date().toISOString()
      }];
    });
  };

  const removeCustomTable = (tableId) => {
    setCustomTables(prev => prev.filter(table => table.id !== tableId));
  };

  const clearCustomTables = () => {
    setCustomTables([]);
  };

  return (
    <CustomTableContext.Provider
      value={{
        customTables,
        addCustomTable,
        removeCustomTable,
        clearCustomTables
      }}
    >
      {children}
    </CustomTableContext.Provider>
  );
}

export function useCustomTable() {
  const context = useContext(CustomTableContext);
  if (context === undefined) {
    throw new Error('useCustomTable must be used within CustomTableProvider');
  }
  return context;
}


