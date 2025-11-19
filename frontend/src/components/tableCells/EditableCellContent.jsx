import { useState, useEffect } from 'react';

/**
 * Reusable editable cell content component that can be used inline within other components
 */
export function EditableCellContent({ value, field, onUpdate, type = 'text', options = null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      onUpdate(field, editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <span 
        onClick={() => setIsEditing(true)}
        style={{ cursor: 'pointer' }}
        title="Click to edit"
      >
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    );
  }

  return (
    <>
      {type === 'select' && options ? (
        <select
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value || null)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
        >
          <option value="">—</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      )}
    </>
  );
}

