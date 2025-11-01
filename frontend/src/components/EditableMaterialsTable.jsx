import { Fragment, useState, useMemo, useEffect } from 'react';
import { useMaterialsData } from '../hooks/useMaterialsData.js';
import { useTranslation } from '../hooks/useTranslation.js';

const ALLOWED_STATUSES = ['approved', 'change_order', 'pending', 'rejected', 'supplied_by'];

function EditableCellContent({ value, field, onUpdate, type = 'text', options = null }) {
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

function ApprovalCellContent({ statusValue, statusField, noteValue, noteField, onUpdate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <EditableCellContent
        value={statusValue}
        field={statusField}
        onUpdate={onUpdate}
        type="select"
        options={ALLOWED_STATUSES}
      />
      <EditableCellContent
        value={noteValue}
        field={noteField}
        onUpdate={onUpdate}
        type="text"
      />
    </div>
  );
}

function ApprovalTag({ status, note }) {
  const { t } = useTranslation();
  if (!status) {
    return <span className="tag pending">{t('unknownTag')}</span>;
  }
  const statusMap = {
    'approved': 'approved',
    'change_order': 'changeOrder',
    'pending': 'pending',
    'rejected': 'rejected',
    'supplied_by': 'suppliedBy'
  };
  const translationKey = statusMap[status] || status;
  const translatedStatus = t(translationKey) || status.replace('_', ' ');
  
  const showNote = note && (status === 'change_order' || note.toLowerCase().includes('avenant'));
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className={`tag ${status}`}>{translatedStatus}</span>
      {showNote && (
        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
          {note}
        </span>
      )}
    </div>
  );
}

function HTQuoteCell({ value, field, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      const numValue = editValue === '' || editValue === null ? null : parseFloat(editValue);
      onUpdate(field, numValue);
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
      return <td className="editable-cell" onClick={() => setIsEditing(true)} title="Click to edit">—</td>;
    }
    return (
      <td className="editable-cell" onClick={() => setIsEditing(true)} title="Click to edit">
        <span className="ht-quote-bubble">{value}</span>
      </td>
    );
  }

  return (
    <td className="editable-cell editing">
      <input
        type="number"
        value={editValue || ''}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    </td>
  );
}

function DateBubbleCell({ value, field, onUpdate, cellClassName = '' }) {
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

function EditableCell({ value, field, onUpdate, type = 'text', options = null, cellClassName = '' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Update editValue when value changes externally
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
      <td 
        className={`editable-cell ${cellClassName}`} 
        onClick={() => setIsEditing(true)}
        title="Click to edit"
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

export default function EditableMaterialsTable({ search }) {
  const { data, loading, error, updateMaterials } = useMaterialsData();
  const { t } = useTranslation();
  const [editState, setEditState] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('expanded'); // 'expanded' or 'concise'

  const filteredSections = useMemo(() => {
    if (!data?.sections) {
      return [];
    }
    if (!search.trim()) {
      return data.sections;
    }
    const term = search.trim().toLowerCase();
    return data.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const target = [item.product, item.reference, item?.approvals?.cray?.status]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return target.includes(term);
        })
      }))
      .filter((section) => section.items.length > 0);
  }, [data, search]);

  const handleUpdate = (sectionId, itemIndex, field, value) => {
    const newData = { ...data };
    const section = newData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const item = section.items[itemIndex];
    
    // Handle nested fields
    if (field.includes('.')) {
      const parts = field.split('.');
      let current = item;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    } else {
      item[field] = value;
    }

    // Store in edit state for batch save
    const key = `${sectionId}-${itemIndex}`;
    setEditState(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));

    // Auto-save after a short delay
    clearTimeout(editState[key]?.saveTimeout);
    const timeoutId = setTimeout(() => {
      saveChanges(newData);
      setEditState(prev => {
        const updated = { ...prev };
        delete updated[key]?.saveTimeout;
        return updated;
      });
    }, 1000);

    setEditState(prev => ({
      ...prev,
      [key]: { ...prev[key], saveTimeout: timeoutId }
    }));
  };

  const saveChanges = async (dataToSave) => {
    setSaving(true);
    const result = await updateMaterials(dataToSave);
    setSaving(false);
    
    if (result.success) {
      setEditState({});
    }
  };

  const handleDeleteRow = (sectionId, itemIndex) => {
    const newData = { ...data };
    const section = newData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    section.items.splice(itemIndex, 1);
    saveChanges(newData);
  };

  const handleAddRow = (sectionId) => {
    const newData = { ...data };
    const section = newData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newItem = {
      product: '',
      reference: null,
      supplierLink: null,
      price: {
        ttc: null,
        htQuote: null
      },
      approvals: {
        client: {
          status: null,
          note: null
        },
        cray: {
          status: null,
          note: null
        }
      },
      order: {
        ordered: false,
        orderDate: null,
        delivery: {
          date: null,
          status: null
        },
        quantity: null
      },
      comments: {
        cray: null,
        client: null
      }
    };
    
    section.items.push(newItem);
    saveChanges(newData);
  };

  if (loading) return <span className="loader">{t('loadingData')}</span>;
  if (error) return <p className="warning">{error}</p>;

  return (
    <div className="materials-table-wrapper">
      {saving && (
        <div className="saving-indicator">
          <span className="loader">Saving...</span>
        </div>
      )}
      <div className="table-controls">
        <button
          onClick={() => setViewMode('concise')}
          className={viewMode === 'concise' ? 'view-toggle active' : 'view-toggle'}
        >
          Concise
        </button>
        <button
          onClick={() => setViewMode('expanded')}
          className={viewMode === 'expanded' ? 'view-toggle active' : 'view-toggle'}
        >
          Expanded
        </button>
      </div>
      <div className="table-container">
        <table className={`materials-table ${viewMode === 'concise' ? 'concise-mode' : 'expanded-mode'}`}>
        <thead>
          <tr>
            <th>{t('section')}</th>
            <th>{t('product')}</th>
            <th>{t('reference')}</th>
            <th>{t('priceTTC')}</th>
            <th>HT devis</th>
            <th>{t('clientValidation')}</th>
            <th>{t('crayValidation')}</th>
            <th className="expandable-column">Commandé</th>
            <th className="expandable-column">Date C</th>
            <th className="expandable-column">Date réception</th>
            <th className="expandable-column">Status réception</th>
            <th className="expandable-column">{t('quantity')}</th>
            <th className="expandable-column">{t('comments')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredSections.length === 0 ? (
            <tr>
              <td colSpan="13">{t('noSearchResults')}</td>
            </tr>
          ) : (
            filteredSections.map((section) => (
              <Fragment key={section.id}>
                <tr className="section-row">
                  <td colSpan="13">
                    <div className="section-row-content">
                      <span>{section.label}</span>
                      <button 
                        className="add-row-btn"
                        onClick={() => handleAddRow(section.id)}
                        title="Add row"
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
                {section.items.map((item, itemIndex) => {
                  const isApproved = item?.approvals?.client?.status === 'approved' && 
                                    item?.approvals?.cray?.status === 'approved';
                  const isOrdered = item?.order?.ordered === true;
                  const isDelivered = item?.order?.delivery?.status === 'livré';
                  
                  return (
                  <tr key={`${section.id}-${itemIndex}`}>
                    <td>{section.label}</td>
                    <EditableCell
                      value={item.product}
                      field="product"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                    />
                    <EditableCell
                      value={item.reference}
                      field="reference"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                    />
                    <EditableCell
                      value={item?.price?.ttc}
                      field="price.ttc"
                      onUpdate={(field, value) => {
                        const numValue = value === '' || value === null ? null : parseFloat(value);
                        handleUpdate(section.id, itemIndex, field, numValue);
                      }}
                      type="number"
                    />
                    <HTQuoteCell
                      value={item?.price?.htQuote}
                      field="price.htQuote"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                    />
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <EditableCell
                          value={item?.approvals?.client?.status}
                          field="approvals.client.status"
                          onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                          type="select"
                          options={ALLOWED_STATUSES}
                        />
                        <EditableCell
                          value={item?.approvals?.client?.note}
                          field="approvals.client.note"
                          onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value || null)}
                          type="text"
                        />
                      </div>
                    </td>
                    <td style={{ position: 'relative' }}>
                      <ApprovalCellContent
                        statusValue={item?.approvals?.cray?.status}
                        statusField="approvals.cray.status"
                        noteValue={item?.approvals?.cray?.note}
                        noteField="approvals.cray.note"
                        onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value || null)}
                      />
                      {viewMode === 'concise' && (
                        <button 
                          className="delete-row-btn"
                          onClick={() => handleDeleteRow(section.id, itemIndex)}
                          title="Delete row"
                          style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                    <EditableCell
                      value={item?.order?.ordered}
                      field="order.ordered"
                      cellClassName="expandable-column"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value === 'true' || value === true)}
                      type="select"
                      options={['false', 'true']}
                    />
                    <DateBubbleCell
                      value={item?.order?.orderDate}
                      field="order.orderDate"
                      cellClassName="expandable-column"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                    />
                    <DateBubbleCell
                      value={item?.order?.delivery?.date}
                      field="order.delivery.date"
                      cellClassName="expandable-column"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                    />
                    <EditableCell
                      value={item?.order?.delivery?.status}
                      field="order.delivery.status"
                      cellClassName="expandable-column"
                      onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value)}
                    />
                    <EditableCell
                      value={item?.order?.quantity}
                      field="order.quantity"
                      cellClassName="expandable-column"
                      onUpdate={(field, value) => {
                        const intValue = value === '' || value === null ? null : parseInt(value);
                        handleUpdate(section.id, itemIndex, field, intValue);
                      }}
                      type="number"
                    />
                    <td className="expandable-column" style={{ position: 'relative' }}>
                      <EditableCellContent
                        value={item?.comments?.cray || item?.comments?.client}
                        field="comments.cray"
                        onUpdate={(field, value) => handleUpdate(section.id, itemIndex, field, value || null)}
                      />
                      <button 
                        className="delete-row-btn"
                        onClick={() => handleDeleteRow(section.id, itemIndex)}
                        title="Delete row"
                        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

