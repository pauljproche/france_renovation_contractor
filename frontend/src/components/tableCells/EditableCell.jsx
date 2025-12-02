import { useState, useEffect } from 'react';

/**
 * Editable table cell component that wraps content in a <td> element
 */
export function EditableCell({ value, field, onUpdate, type = 'text', options = null, cellClassName = '', readOnly = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = () => {
    if (readOnly) return;
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
      <td 
        className={`editable-cell ${cellClassName} ${readOnly ? 'read-only' : ''}`} 
        onClick={() => !readOnly && setIsEditing(true)}
        title={readOnly ? '' : 'Click to edit'}
      >
        {value !== null && value !== undefined ? String(value) : '—'}
      </td>
    );
  }

  return (
    <td className={`editable-cell editing ${cellClassName}`}>
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
    </td>
  );
}

