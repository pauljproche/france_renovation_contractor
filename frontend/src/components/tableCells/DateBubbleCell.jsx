import { useState, useEffect } from 'react';

/**
 * Specialized cell component for date values with bubble styling
 */
export function DateBubbleCell({ value, field, onUpdate, cellClassName = '', readOnly = false }) {
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
    if (value === null || value === undefined) {
      return <td className={`editable-cell ${cellClassName} ${readOnly ? 'read-only' : ''}`} onClick={() => !readOnly && setIsEditing(true)} title={readOnly ? '' : 'Click to edit'}>—</td>;
    }
    return (
      <td className={`editable-cell ${cellClassName} ${readOnly ? 'read-only' : ''}`} onClick={() => !readOnly && setIsEditing(true)} title={readOnly ? '' : 'Click to edit'}>
        <span className="ht-quote-bubble">{value}</span>
      </td>
    );
  }

  return (
    <td className={`editable-cell editing ${cellClassName}`}>
      <input
        type="text"
        value={editValue || ''}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    </td>
  );
}

