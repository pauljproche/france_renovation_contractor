import { useState, useEffect } from 'react';

/**
 * Specialized cell component for date values with format guidance
 * Database expects DD/MM format (day/month, no year)
 */
export function DateInputCell({ value, field, onUpdate, cellClassName = '', readOnly = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showFormatHint, setShowFormatHint] = useState(false);

  // Database expects DD/MM format (no year)
  const DDMM_PATTERN = /^\d{2}\/\d{2}$/;

  // Normalize date to DD/MM format for input
  const normalizeDateForInput = (dateValue) => {
    if (!dateValue) return '';
    
    // If already in DD/MM format
    if (typeof dateValue === 'string' && DDMM_PATTERN.test(dateValue.trim())) {
      return dateValue.trim();
    }
    
    // Try to parse YYYY-MM-DD format and convert to DD/MM
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const [year, month, day] = dateValue.split('-');
      return `${day}/${month}`;
    }
    
    // Try to parse as Date object
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${day}/${month}`;
      }
    } catch (e) {
      // If parsing fails, return empty
    }
    
    return '';
  };

  // Validate and format input as user types (DD/MM)
  const handleInputChange = (e) => {
    let input = e.target.value;
    
    // Remove any non-digit or slash characters
    input = input.replace(/[^\d/]/g, '');
    
    // Auto-format as user types: add slash after 2 digits
    if (input.length === 2 && !input.includes('/')) {
      input = input + '/';
    }
    
    // Limit to DD/MM format (5 characters: DD/MM)
    if (input.length > 5) {
      input = input.slice(0, 5);
    }
    
    setEditValue(input);
  };

  // Validate DD/MM format before saving
  const validateDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return null;
    
    const trimmed = dateStr.trim();
    if (!DDMM_PATTERN.test(trimmed)) {
      return null; // Invalid format
    }
    
    const [day, month] = trimmed.split('/').map(Number);
    
    // Validate day (1-31) and month (1-12)
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return null; // Invalid date
    }
    
    return trimmed; // Valid DD/MM format
  };

  useEffect(() => {
    if (!isEditing) {
      setEditValue(normalizeDateForInput(value));
    }
  }, [value, isEditing]);

  const handleSave = () => {
    if (readOnly) return;
    
    const validated = validateDate(editValue);
    const currentNormalized = normalizeDateForInput(value);
    
    if (validated !== currentNormalized) {
      onUpdate(field, validated);
    }
    setIsEditing(false);
    setShowFormatHint(false);
  };

  const handleCancel = () => {
    setEditValue(normalizeDateForInput(value));
    setIsEditing(false);
    setShowFormatHint(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleFocus = () => {
    setShowFormatHint(true);
  };

  const handleBlur = (e) => {
    // Delay hiding hint to allow clicking on it
    setTimeout(() => {
      setShowFormatHint(false);
      handleSave();
    }, 150);
  };

  // Display format: DD/MM
  const formatDateForDisplay = (dateValue) => {
    if (!dateValue) return '—';
    const normalized = normalizeDateForInput(dateValue);
    return normalized || dateValue; // Return normalized or original if can't normalize
  };

  if (!isEditing) {
    const displayValue = formatDateForDisplay(value);
    return (
      <td 
        className={`editable-cell ${cellClassName} ${readOnly ? 'read-only' : ''}`} 
        onClick={() => !readOnly && setIsEditing(true)} 
        title={readOnly ? '' : 'Click to edit date (DD/MM format)'}
      >
        <span className="ht-quote-bubble">{displayValue}</span>
      </td>
    );
  }

  const today = new Date();
  const exampleDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;

  return (
    <td className={`editable-cell editing ${cellClassName}`} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <input
          type="text"
          value={editValue || ''}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="DD/MM"
          autoFocus
          style={{
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.875rem',
            minWidth: '80px',
            maxWidth: '100px',
            fontFamily: 'monospace',
            textAlign: 'center'
          }}
        />
        {showFormatHint && (
          <div 
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              padding: '8px 10px',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#374151',
              whiteSpace: 'nowrap',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              pointerEvents: 'none'
            }}
          >
            <div style={{ fontWeight: '500', marginBottom: '4px' }}>Date Format</div>
            <div style={{ color: '#6b7280' }}>
              Enter date as: <strong>DD/MM</strong> (day/month, no year)
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '2px' }}>
              Example: {exampleDate}
            </div>
          </div>
        )}
      </div>
    </td>
  );
}
