import { useState, useEffect } from 'react';

/**
 * Specialized cell component for date values with bubble styling
 */
export function DateBubbleCell({ value, field, onUpdate, cellClassName = '' }) {
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
    if (value === null || value === undefined) {
      return <td className={`editable-cell ${cellClassName}`} onClick={() => setIsEditing(true)} title="Click to edit">—</td>;
    }
    return (
      <td className={`editable-cell ${cellClassName}`} onClick={() => setIsEditing(true)} title="Click to edit">
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

