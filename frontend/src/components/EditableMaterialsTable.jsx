import { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import { useMaterialsData } from '../hooks/useMaterialsData.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { LABOR_TYPES, determineLaborType } from '../utils/laborTypes.js';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { exportFacturePDF, exportDevisPDF } from '../utils/pdfExport.js';
import { useCustomTable } from '../contexts/CustomTableContext.jsx';
import { logEdit } from '../services/editHistory.js';

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
  const { selectedProject } = useProjects();
  const { addCustomTable } = useCustomTable();
  const [editState, setEditState] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('expanded'); // 'expanded' or 'concise'
  const [sortColumn, setSortColumn] = useState('section'); // Default sort by section
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [showCustomTableBuilder, setShowCustomTableBuilder] = useState(false);
  const [customTableColumns, setCustomTableColumns] = useState([]);
  const [customTableActive, setCustomTableActive] = useState(false);
  const customTableBuilderRef = useRef(null);
  const columnManagerRef = useRef(null);
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [productImages, setProductImages] = useState(() => new Map());
  const [showColumnManager, setShowColumnManager] = useState(false);
  
  // Define column order (original order) - moved up for use in state initialization
  const originalColumnOrder = [
    'section',
    'product',
    'image',
    'reference',
    'replacementUrls',
    'laborType',
    'priceTTC',
    'htQuote',
    'clientValidation',
    'crayValidation',
    'ordered',
    'orderDate',
    'deliveryDate',
    'deliveryStatus',
    'quantity',
    'comments'
  ];
  
  // Load column visibility preferences from localStorage
  const getStoredColumnVisibility = () => {
    try {
      const stored = localStorage.getItem('materials-table-column-visibility');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all current columns have a visibility setting
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
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('text');
  
  // Load custom column order from localStorage
  const getStoredColumnOrder = (customCols = []) => {
    try {
      const stored = localStorage.getItem('materials-table-column-order');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that all columns are present
        const allColumns = [...originalColumnOrder, ...customCols.map(c => c.id)];
        const storedOrder = parsed.filter(col => allColumns.includes(col));
        // Add any missing columns to the end
        const missing = allColumns.filter(col => !storedOrder.includes(col));
        return [...storedOrder, ...missing];
      }
    } catch (e) {
      console.warn('Failed to load column order preferences:', e);
    }
    return null; // null means use original order
  };
  
  const [userColumnOrder, setUserColumnOrder] = useState(() => getStoredColumnOrder([]));
  
  // Update userColumnOrder when customColumns change (to include new custom columns)
  useEffect(() => {
    if (userColumnOrder) {
      const allColumns = [...originalColumnOrder, ...customColumns.map(c => c.id)];
      const storedOrder = userColumnOrder.filter(col => allColumns.includes(col));
      const missing = allColumns.filter(col => !storedOrder.includes(col));
      if (missing.length > 0) {
        setUserColumnOrder([...storedOrder, ...missing]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customColumns]); // Only update when customColumns change, not on every render
  
  // Save custom column order to localStorage
  useEffect(() => {
    if (userColumnOrder) {
      try {
        localStorage.setItem('materials-table-column-order', JSON.stringify(userColumnOrder));
      } catch (e) {
        console.warn('Failed to save column order preferences:', e);
      }
    }
  }, [userColumnOrder]);
  
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
  
  // Close column manager when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnManagerRef.current && !columnManagerRef.current.contains(event.target)) {
        setShowColumnManager(false);
      }
      if (customTableBuilderRef.current && !customTableBuilderRef.current.contains(event.target)) {
        setShowCustomTableBuilder(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
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
  
  // Add a new custom column
  const handleAddCustomColumn = () => {
    if (!newColumnName.trim()) {
      return;
    }
    
    // Check if column name already exists
    const columnId = `custom_${newColumnName.trim().toLowerCase().replace(/\s+/g, '_')}`;
    const allColumnIds = [...originalColumnOrder, ...customColumns.map(c => c.id)];
    if (allColumnIds.includes(columnId)) {
      alert(t('columnExists') || 'A column with this name already exists');
      return;
    }
    
    const newColumn = {
      id: columnId,
      label: newColumnName.trim(),
      type: newColumnType,
      createdAt: new Date().toISOString()
    };
    
    setCustomColumns(prev => [...prev, newColumn]);
    setColumnVisibility(prev => ({ ...prev, [columnId]: true }));
    
    // Add to custom column order if it exists
    if (userColumnOrder) {
      setUserColumnOrder(prev => [...prev, columnId]);
    }
    
    setNewColumnName('');
    setNewColumnType('text');
    setShowAddColumnForm(false);
    
    // Initialize custom field data for all existing items
    if (data?.sections) {
      const newData = { ...data };
      newData.sections.forEach(section => {
        section.items.forEach(item => {
          if (!item.customFields) {
            item.customFields = {};
          }
          item.customFields[columnId] = null;
        });
      });
      updateMaterials(newData).catch(err => {
        console.warn('Failed to initialize custom column data:', err);
      });
    }
  };
  
  // Remove a column (only custom columns can be removed)
  const handleRemoveColumn = (columnId) => {
    // Only allow removal of custom columns
    if (!columnId.startsWith('custom_')) {
      return;
    }
    
    if (!confirm(t('confirmRemoveColumn') || `Are you sure you want to remove this column? This will delete all data in this column.`)) {
      return;
    }
    
    // Remove custom column from customColumns
    setCustomColumns(prev => prev.filter(c => c.id !== columnId));
    
    // Remove from custom column order if it exists
    if (userColumnOrder) {
      setUserColumnOrder(prev => prev.filter(col => col !== columnId));
    }
    
    // Remove custom field data from all items
    if (data?.sections) {
      const newData = { ...data };
      newData.sections.forEach(section => {
        section.items.forEach(item => {
          if (item.customFields && item.customFields[columnId] !== undefined) {
            delete item.customFields[columnId];
            if (Object.keys(item.customFields).length === 0) {
              delete item.customFields;
            }
          }
        });
      });
      updateMaterials(newData).catch(err => {
        console.warn('Failed to remove custom column data:', err);
      });
    }
  };

  const makeItemKey = (sectionId, itemIndex) => `${sectionId}::${itemIndex}`;

  const getClientReplacementUrls = (materialItem) => {
    if (!materialItem) {
      return [];
    }
    const urls = materialItem?.approvals?.client?.replacementUrls;
    if (Array.isArray(urls)) {
      return urls.filter((url) => typeof url === 'string' && url.trim().length > 0);
    }
    const legacy = materialItem?.approvals?.client?.replacementUrl;
    return typeof legacy === 'string' && legacy.trim().length > 0 ? [legacy.trim()] : [];
  };

  // Get all items with their section info and apply search filter
  const allItems = useMemo(() => {
    if (!data?.sections) {
      return [];
    }
    const items = [];
    data.sections.forEach((section) => {
      section.items.forEach((item, itemIndex) => {
        items.push({
          ...item,
          sectionId: section.id,
          sectionLabel: section.label,
          itemIndex,
          originalSection: section,
          itemKey: makeItemKey(section.id, itemIndex),
          clientReplacementUrls: getClientReplacementUrls(item)
        });
      });
    });
    
    // Apply search filter
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      return items.filter((item) => {
        const laborType = item.laborType || determineLaborType(item.product, item.sectionLabel, item.sectionId);
        const replacementTargets = item.clientReplacementUrls?.join(' ') || '';
        const target = [item.product, item.reference, item?.approvals?.cray?.status, laborType, replacementTargets]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return target.includes(term);
      });
    }
    
    return items;
  }, [data, search]);

  // Get value for sorting based on column
  const getSortValue = (item, column) => {
    switch (column) {
      case 'section':
        return item.sectionLabel || '';
      case 'product':
        return item.product || '';
      case 'reference':
        return item.reference || '';
      case 'laborType':
        return item.laborType || determineLaborType(item.product, item.sectionLabel, item.sectionId) || '';
      case 'priceTTC':
        return item?.price?.ttc ?? 0;
      case 'htQuote':
        return item?.price?.htQuote ?? 0;
      case 'clientValidation':
        return item?.approvals?.client?.status || '';
      case 'crayValidation':
        return item?.approvals?.cray?.status || '';
      case 'ordered':
        return item?.order?.ordered ? 'true' : 'false';
      case 'orderDate':
        return item?.order?.orderDate || '';
      case 'deliveryDate':
        return item?.order?.delivery?.date || '';
      case 'deliveryStatus':
        return item?.order?.delivery?.status || '';
      case 'quantity':
        return item?.order?.quantity ?? 0;
      case 'comments':
        return item?.comments?.cray || item?.comments?.client || '';
      case 'replacementUrls': {
        const urls = item.clientReplacementUrls || getClientReplacementUrls(item);
        return urls.join(' ');
      }
      default:
        return '';
    }
  };

  // Sort and group items
  const sortedAndGroupedItems = useMemo(() => {
    if (!allItems.length) return [];
    
    // Sort items
    const sorted = [...allItems].sort((a, b) => {
      const aValue = getSortValue(a, sortColumn);
      const bValue = getSortValue(b, sortColumn);
      
      // Handle numeric values
      if (sortColumn === 'priceTTC' || sortColumn === 'htQuote' || sortColumn === 'quantity') {
        const numA = typeof aValue === 'number' ? aValue : 0;
        const numB = typeof bValue === 'number' ? bValue : 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      
      // Handle string values
      const strA = String(aValue).toLowerCase();
      const strB = String(bValue).toLowerCase();
      const comparison = strA.localeCompare(strB);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Group by sorted column value
    const grouped = [];
    let currentGroup = null;
    
    sorted.forEach((item) => {
      const groupValue = getSortValue(item, sortColumn);
      
      // Format display value based on column type
      let displayValue;
      if (groupValue === null || groupValue === undefined || groupValue === '') {
        displayValue = '—';
      } else if (sortColumn === 'priceTTC' || sortColumn === 'htQuote') {
        displayValue = `€${Number(groupValue).toFixed(2)}`;
      } else if (sortColumn === 'quantity') {
        displayValue = String(groupValue);
      } else {
        displayValue = String(groupValue);
      }
      
      // Use a key for comparison (handle numeric values properly)
      const groupKey = groupValue === null || groupValue === undefined || groupValue === '' 
        ? '__empty__' 
        : String(groupValue);
      
      if (!currentGroup || currentGroup.key !== groupKey) {
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = {
          key: groupKey,
          value: displayValue,
          items: [item]
        };
      } else {
        currentGroup.items.push(item);
      }
    });
    
    if (currentGroup) {
      grouped.push(currentGroup);
    }
    
    return grouped;
  }, [allItems, sortColumn, sortDirection]);

  // Get column header label
  const getColumnLabel = (column) => {
    // Check if it's a custom column
    const customCol = customColumns.find(c => c.id === column);
    if (customCol) {
      return customCol.label;
    }
    
    const labels = {
      section: t('section'),
      product: t('product'),
      image: 'Image',
      reference: t('reference'),
      laborType: t('laborType'),
      priceTTC: t('priceTTC'),
      htQuote: 'HT devis',
      clientValidation: t('clientValidation'),
      crayValidation: t('crayValidation'),
      ordered: 'Commandé',
      orderDate: 'Date C',
      deliveryDate: 'Date réception',
      deliveryStatus: 'Status réception',
      quantity: t('quantity'),
      comments: t('comments'),
      replacementUrls: t('clientReplacementOptions')
    };
    return labels[column] || column;
  };
  
  // Get column type for custom columns
  const getColumnType = (column) => {
    const customCol = customColumns.find(c => c.id === column);
    return customCol?.type || 'text';
  };

  // Fetch product image from supplier link
  const fetchProductImage = async (supplierLink, itemKey, itemReference) => {
    if (!supplierLink || !supplierLink.startsWith('http')) {
      return;
    }
    
    // Check if we already have this image
    if (productImages.has(itemKey)) {
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/extract-product-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: supplierLink,
          reference: itemReference || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.image_url) {
          setProductImages(prev => new Map(prev).set(itemKey, result.image_url));
        }
      }
    } catch (error) {
      console.error('Error fetching product image:', error);
    }
  };

  // Get all available columns (standard + custom)
  const allAvailableColumns = useMemo(() => {
    const base = [...originalColumnOrder, ...customColumns.map(c => c.id)];
    // Use custom order if available, otherwise use base order
    if (userColumnOrder) {
      // Merge: use custom order, then add any new columns that weren't in the custom order
      const ordered = userColumnOrder.filter(col => base.includes(col));
      const newColumns = base.filter(col => !userColumnOrder.includes(col));
      return [...ordered, ...newColumns];
    }
    return base;
  }, [customColumns, userColumnOrder]);
  
  // Reorder columns: move sorted column to front, and filter by visibility
  const columnOrder = useMemo(() => {
    // Use allAvailableColumns which already respects custom order
    const visibleColumns = allAvailableColumns.filter(col => columnVisibility[col] !== false);
    
    // If no visible columns, return empty array
    if (visibleColumns.length === 0) {
      return [];
    }
    
    // If sort column is hidden, use first visible column for sorting
    const effectiveSortColumn = visibleColumns.includes(sortColumn) ? sortColumn : visibleColumns[0];
    
    // Move sorted column to front
    const sorted = visibleColumns.filter(col => col === effectiveSortColumn);
    const others = visibleColumns.filter(col => col !== effectiveSortColumn);
    return [...sorted, ...others];
  }, [sortColumn, columnVisibility, allAvailableColumns]);
  
  // Ensure sort column is visible, fallback if needed
  useEffect(() => {
    const visibleColumns = allAvailableColumns.filter(col => columnVisibility[col] !== false);
    if (visibleColumns.length > 0 && !visibleColumns.includes(sortColumn)) {
      setSortColumn(visibleColumns[0]);
    }
  }, [columnVisibility, sortColumn, allAvailableColumns]);
  
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
  
  // Reset column order to original
  const resetColumnOrder = () => {
    setUserColumnOrder(null);
    localStorage.removeItem('materials-table-column-order');
  };

  // Handle column header click for sorting
  const handleColumnSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle custom table creation
  const handleCreateCustomTable = () => {
    if (customTableColumns.length > 0) {
      setCustomTableActive(true);
      setShowCustomTableBuilder(false);
      
      // Add custom table to context for chatbot awareness
      const columnLabels = {};
      customTableColumns.forEach(col => {
        columnLabels[col] = getColumnLabel(col);
      });
      
      addCustomTable({
        columns: customTableColumns,
        columnLabels: columnLabels,
        sortColumn: sortColumn,
        sortDirection: sortDirection
      });
    }
  };

  const handleToggleColumn = (column) => {
    setCustomTableColumns(prev => 
      prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleSelectAllColumns = () => {
    setCustomTableColumns([...originalColumnOrder]);
  };

  const handleClearCustomTable = () => {
    setCustomTableActive(false);
    setCustomTableColumns([]);
  };


  const handleSelectRow = (itemKey) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const handleSendToClient = async () => {
    if (!data?.sections || selectedItems.size === 0) {
      return;
    }

    const newData = { ...data };
    const keys = Array.from(selectedItems);

    keys.forEach((key) => {
      const [sectionId, itemIndexStr] = key.split('::');
      const section = newData.sections.find((s) => String(s.id) === sectionId);
      if (!section) {
        return;
      }
      const itemIndex = Number.parseInt(itemIndexStr, 10);
      if (Number.isNaN(itemIndex) || !section.items[itemIndex]) {
        return;
      }

      const item = section.items[itemIndex];
      if (!item.approvals) {
        item.approvals = {};
      }
      if (!item.approvals.client) {
        item.approvals.client = {};
      }

      if (!item.approvals.client.status) {
        item.approvals.client.status = 'pending';
      }
      item.approvals.client.sentForValidation = true;
      item.approvals.client.sentAt = new Date().toISOString();
    });

    const result = await saveChanges(newData);

    if (result?.success) {
      setSelectedItems(new Set());
      alert(t('sendToClientSuccess'));
    } else {
      alert(result?.error || t('sendToClientError'));
    }
  };

  // Get custom table column order (move sorted column to front if it's selected)
  const customColumnOrder = useMemo(() => {
    if (!customTableActive || customTableColumns.length === 0) return [];
    
    const sorted = customTableColumns.filter(col => col === sortColumn);
    const others = customTableColumns.filter(col => col !== sortColumn);
    return [...sorted, ...others];
  }, [customTableColumns, sortColumn, customTableActive]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customTableBuilderRef.current && !customTableBuilderRef.current.contains(event.target)) {
        setShowCustomTableBuilder(false);
      }
    };

    if (showCustomTableBuilder) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomTableBuilder]);

  // Get all items from custom table (flatten grouped structure)
  const customTableItems = useMemo(() => {
    if (!customTableActive || sortedAndGroupedItems.length === 0) return [];
    return sortedAndGroupedItems.flatMap(group => group.items);
  }, [sortedAndGroupedItems, customTableActive]);

  const selectedCount = selectedItems.size;
  const tableColSpan = columnOrder.length + 2; // +1 for select column, +1 for actions column

  // Export handlers
  const handleExportFacture = (items) => {
    try {
      const projectName = selectedProject?.name || 'Project';
      exportFacturePDF(items, projectName);
    } catch (error) {
      console.error('Error exporting facture:', error);
      alert('Error exporting facture. Please check the console for details.');
    }
  };

  const handleExportDevis = (items, columns, isCustom = false) => {
    try {
      const projectName = selectedProject?.name || 'Project';
      const columnLabels = {};
      originalColumnOrder.forEach(col => {
        columnLabels[col] = getColumnLabel(col);
      });
      const exportColumns = isCustom ? customColumnOrder : columnOrder;
      exportDevisPDF(items, exportColumns, columnLabels, projectName);
    } catch (error) {
      console.error('Error exporting devis:', error);
      alert('Error exporting devis. Please check the console for details.');
    }
  };

  const handleUpdate = (sectionId, itemIndex, field, value) => {
    const newData = { ...data };
    const section = newData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const item = section.items[itemIndex];
    
    // Get old value before updating
    let oldValue;
    if (field.includes('.')) {
      const parts = field.split('.');
      let current = item;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      oldValue = current[parts[parts.length - 1]];
      current[parts[parts.length - 1]] = value;
    } else {
      oldValue = item[field];
      item[field] = value;
    }
    
    // Ensure customFields exists if we're updating a custom field
    if (field.startsWith('customFields.') && !item.customFields) {
      item.customFields = {};
    }

    // Log the edit (fire and forget)
    logEdit({
      sectionId,
      sectionLabel: section.label || sectionId,
      itemIndex,
      product: item.product || '',
      fieldPath: field,
      oldValue,
      newValue: value,
      source: 'manual'
    }).catch(err => {
      // Silently fail - don't block the UI if logging fails
      console.warn('Failed to log edit:', err);
    });

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
    return result;
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
      laborType: null,
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
    
    // Initialize customFields for all existing custom columns
    if (customColumns.length > 0) {
      newItem.customFields = {};
      customColumns.forEach(col => {
        newItem.customFields[col.id] = null;
      });
    }
    
    section.items.push(newItem);
    saveChanges(newData);
  };

  if (loading) return <span className="loader">{t('loadingData')}</span>;
  if (error) return <p className="warning">{error}</p>;

  return (
    <>
      <div className="materials-table-wrapper">
        {saving && (
          <div className="saving-indicator">
            <span className="loader">Saving...</span>
          </div>
        )}
        <div className="table-controls">
        <div className="table-controls-left">
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
          {selectedCount > 0 && (
            <button
              onClick={handleSendToClient}
              className="send-to-client-btn"
            >
              {t('sendToClient')}
              {selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
          )}
        </div>
        <div className="table-controls-right">
          <div className="column-manager" ref={columnManagerRef} style={{ position: 'relative', marginRight: '12px' }}>
            <button
              onClick={() => setShowColumnManager(!showColumnManager)}
              className="custom-table-toggle-btn"
              title={t('manageColumns') || 'Manage Columns'}
            >
              {t('manageColumns') || 'Manage Columns'} {showColumnManager ? '▼' : '▶'}
            </button>
            {showColumnManager && (
              <div className="custom-table-dropdown" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000, marginTop: '4px' }}>
                <div className="custom-table-header">
                  <h4>{t('manageColumns') || 'Manage Columns'}</h4>
                  <div className="custom-table-actions">
                    <button
                      type="button"
                      onClick={() => setShowAddColumnForm(!showAddColumnForm)}
                      className="custom-table-action-btn"
                      style={{ background: '#10b981', color: '#fff' }}
                    >
                      {t('addColumn') || '+ Add Column'}
                    </button>
                    <button
                      type="button"
                      onClick={showAllColumns}
                      className="custom-table-action-btn"
                    >
                      {t('showAll') || 'Show All'}
                    </button>
                    <button
                      type="button"
                      onClick={hideAllColumns}
                      className="custom-table-action-btn"
                    >
                      {t('hideAll') || 'Hide All'}
                    </button>
                    {userColumnOrder && (
                      <button
                        type="button"
                        onClick={resetColumnOrder}
                        className="custom-table-action-btn"
                        style={{ background: '#6b7280', color: '#fff' }}
                        title={t('resetColumnOrder') || 'Reset column order to default'}
                      >
                        {t('resetOrder') || 'Reset Order'}
                      </button>
                    )}
                  </div>
                </div>
                {showAddColumnForm && (
                  <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder={t('columnName') || 'Column name'}
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCustomColumn();
                          } else if (e.key === 'Escape') {
                            setShowAddColumnForm(false);
                            setNewColumnName('');
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <select
                        value={newColumnType}
                        onChange={(e) => setNewColumnType(e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                      >
                        <option value="text">{t('textType') || 'Text'}</option>
                        <option value="number">{t('numberType') || 'Number'}</option>
                        <option value="date">{t('dateType') || 'Date'}</option>
                        <option value="boolean">{t('booleanType') || 'Yes/No'}</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleAddCustomColumn}
                        className="custom-table-action-btn"
                        style={{ flex: 1, background: '#2563eb', color: '#fff' }}
                        disabled={!newColumnName.trim()}
                      >
                        {t('add') || 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddColumnForm(false);
                          setNewColumnName('');
                        }}
                        className="custom-table-action-btn"
                        style={{ flex: 1 }}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}
                <div className="custom-table-columns" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {allAvailableColumns.map((column, index) => {
                    const isCustom = column.startsWith('custom_');
                    const currentOrder = userColumnOrder || allAvailableColumns;
                    const canMoveUp = index > 0;
                    const canMoveDown = index < allAvailableColumns.length - 1;
                    return (
                      <div key={column} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button
                              type="button"
                              onClick={() => moveColumnUp(column)}
                              disabled={!canMoveUp}
                              style={{
                                padding: '2px 4px',
                                fontSize: '0.625rem',
                                background: canMoveUp ? '#3b82f6' : '#d1d5db',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: canMoveUp ? 'pointer' : 'not-allowed',
                                lineHeight: '1'
                              }}
                              title={t('moveUp') || 'Move up'}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveColumnDown(column)}
                              disabled={!canMoveDown}
                              style={{
                                padding: '2px 4px',
                                fontSize: '0.625rem',
                                background: canMoveDown ? '#3b82f6' : '#d1d5db',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: canMoveDown ? 'pointer' : 'not-allowed',
                                lineHeight: '1'
                              }}
                              title={t('moveDown') || 'Move down'}
                            >
                              ↓
                            </button>
                          </div>
                          <label className="custom-table-column-checkbox" style={{ flex: 1, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={columnVisibility[column] !== false}
                              onChange={() => toggleColumnVisibility(column)}
                            />
                            <span>{getColumnLabel(column)} {isCustom && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>(custom)</span>}</span>
                          </label>
                        </div>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(column)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            title={t('removeColumn') || 'Remove column'}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="custom-table-footer">
                  <button
                    type="button"
                    onClick={() => setShowColumnManager(false)}
                    className="custom-table-btn confirm"
                  >
                    {t('okay')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="custom-table-builder" ref={customTableBuilderRef}>
            <button
              onClick={() => setShowCustomTableBuilder(!showCustomTableBuilder)}
              className="custom-table-toggle-btn"
            >
              {t('createCustomTable')} {showCustomTableBuilder ? '▼' : '▶'}
            </button>
            {showCustomTableBuilder && (
              <div className="custom-table-dropdown">
                <div className="custom-table-header">
                  <h4>{t('selectColumns')}</h4>
                  <div className="custom-table-actions">
                    <button
                      type="button"
                      onClick={handleSelectAllColumns}
                      className="custom-table-action-btn"
                    >
                      {t('selectAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomTableColumns([])}
                      className="custom-table-action-btn"
                    >
                      {t('clearAll')}
                    </button>
                  </div>
                </div>
                <div className="custom-table-columns">
                  {originalColumnOrder.map((column) => (
                    <label key={column} className="custom-table-column-checkbox">
                      <input
                        type="checkbox"
                        checked={customTableColumns.includes(column)}
                        onChange={() => handleToggleColumn(column)}
                      />
                      <span>{getColumnLabel(column)}</span>
                    </label>
                  ))}
                </div>
                <div className="custom-table-footer">
                  <button
                    type="button"
                    onClick={() => setShowCustomTableBuilder(false)}
                    className="custom-table-btn cancel"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCustomTable}
                    className="custom-table-btn confirm"
                    disabled={customTableColumns.length === 0}
                  >
                    {t('okay')}
                  </button>
                </div>
              </div>
            )}
          </div>
          {customTableActive && (
            <button
              onClick={handleClearCustomTable}
              className="clear-custom-table-btn"
              title={t('clearCustomTable')}
            >
              {t('clearCustomTable')} ×
            </button>
          )}
        </div>
      </div>
      <div className="table-container">
        <table className={`materials-table ${viewMode === 'concise' ? 'concise-mode' : 'expanded-mode'}`}>
        <thead>
          <tr>
            <th className="select-column">{t('select')}</th>
            {columnOrder.map((column) => {
              const isExpandable = ['ordered', 'orderDate', 'deliveryDate', 'deliveryStatus', 'quantity', 'comments'].includes(column);
              return (
                <th 
                  key={column}
                  className={`sortable-header ${isExpandable ? 'expandable-column' : ''}`}
                  onClick={() => handleColumnSort(column)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {getColumnLabel(column)}
                  {sortColumn === column && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </th>
              );
            })}
            <th key="actions" className="actions-column-header" style={{ width: '40px', textAlign: 'center', cursor: 'default' }}>
              {t('actions') || 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedAndGroupedItems.length === 0 ? (
            <tr>
              <td colSpan={tableColSpan}>{t('noSearchResults')}</td>
            </tr>
          ) : (
            sortedAndGroupedItems.map((group, groupIndex) => (
              <Fragment key={`group-${groupIndex}`}>
                <tr className="section-row">
                  <td colSpan={tableColSpan}>
                    <div className="section-row-content">
                      <span>{getColumnLabel(sortColumn)}: {group.value}</span>
                      <button 
                        className="add-row-btn"
                        onClick={() => {
                          // Add to first section in group, or use original section
                          const firstItem = group.items[0];
                          handleAddRow(firstItem.sectionId);
                        }}
                        title="Add row"
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
                {group.items.map((item) => {
                  const isApproved = item?.approvals?.client?.status === 'approved' && 
                                    item?.approvals?.cray?.status === 'approved';
                  const isOrdered = item?.order?.ordered === true;
                  const isDelivered = item?.order?.delivery?.status === 'livré';
                  const rowKey = item.itemKey || makeItemKey(item.sectionId, item.itemIndex);
                  const isSelected = selectedItems.has(rowKey);
                  const isValidationPending = Boolean(item?.approvals?.client?.sentForValidation);
                  const rowClassNames = [
                    isValidationPending ? 'validation-pending-row' : '',
                    isSelected ? 'selected-row' : ''
                  ].filter(Boolean).join(' ');
                  
                  // Determine labor type if not set, or use existing value
                  const currentLaborType = item.laborType || determineLaborType(item.product, item.sectionLabel, item.sectionId);
                  
                  // Render cells based on column order
                  const renderCell = (column) => {
                    const isExpandable = ['ordered', 'orderDate', 'deliveryDate', 'deliveryStatus', 'quantity', 'comments'].includes(column);
                    
                    switch (column) {
                      case 'section':
                        return <td key={column}>{item.sectionLabel}</td>;
                      case 'product':
                        return (
                          <EditableCell
                            key={column}
                            value={item.product}
                            field="product"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                          />
                        );
                      case 'image': {
                        const supplierLink = item.supplierLink;
                        const imageUrl = productImages.get(rowKey);
                        
                        // Trigger image fetch if we have a supplier link but no image yet
                        if (supplierLink && !imageUrl) {
                          fetchProductImage(supplierLink, rowKey, item.reference);
                        }
                        
                        return (
                          <td key={column} className="product-image-cell">
                            {imageUrl ? (
                              <img 
                                src={imageUrl} 
                                alt={item.product || 'Product image'} 
                                className="product-image"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : supplierLink ? (
                              <span className="image-loading">Loading...</span>
                            ) : (
                              <span className="image-placeholder">—</span>
                            )}
                          </td>
                        );
                      }
                      case 'reference':
                        return (
                          <EditableCell
                            key={column}
                            value={item.reference}
                            field="reference"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                          />
                        );
                      case 'laborType':
                        return (
                          <EditableCell
                            key={column}
                            value={currentLaborType}
                            field="laborType"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                            type="select"
                            options={LABOR_TYPES}
                          />
                        );
                      case 'priceTTC':
                        return (
                          <EditableCell
                            key={column}
                            value={item?.price?.ttc}
                            field="price.ttc"
                            onUpdate={(field, value) => {
                              const numValue = value === '' || value === null ? null : parseFloat(value);
                              handleUpdate(item.sectionId, item.itemIndex, field, numValue);
                            }}
                            type="number"
                          />
                        );
                      case 'htQuote':
                        return (
                          <HTQuoteCell
                            key={column}
                            value={item?.price?.htQuote}
                            field="price.htQuote"
                            onUpdate={(field, value) => {
                              const numValue = value === '' || value === null ? null : parseFloat(value);
                              handleUpdate(item.sectionId, item.itemIndex, field, numValue);
                            }}
                          />
                        );
                      case 'clientValidation':
                        return (
                          <td key={column}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <EditableCell
                                value={item?.approvals?.client?.status}
                                field="approvals.client.status"
                                onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                type="select"
                                options={ALLOWED_STATUSES}
                              />
                              <EditableCell
                                value={item?.approvals?.client?.note}
                                field="approvals.client.note"
                                onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value || null)}
                                type="text"
                              />
                            </div>
                          </td>
                        );
                      case 'crayValidation':
                        return (
                          <td key={column}>
                            <ApprovalCellContent
                              statusValue={item?.approvals?.cray?.status}
                              statusField="approvals.cray.status"
                              noteValue={item?.approvals?.cray?.note}
                              noteField="approvals.cray.note"
                              onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value || null)}
                            />
                          </td>
                        );
                      case 'ordered':
                        return (
                          <EditableCell
                            key={column}
                            value={item?.order?.ordered}
                            field="order.ordered"
                            cellClassName="expandable-column"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value === 'true' || value === true)}
                            type="select"
                            options={['false', 'true']}
                          />
                        );
                      case 'orderDate':
                        return (
                          <DateBubbleCell
                            key={column}
                            value={item?.order?.orderDate}
                            field="order.orderDate"
                            cellClassName="expandable-column"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                          />
                        );
                      case 'deliveryDate':
                        return (
                          <DateBubbleCell
                            key={column}
                            value={item?.order?.delivery?.date}
                            field="order.delivery.date"
                            cellClassName="expandable-column"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                          />
                        );
                      case 'deliveryStatus':
                        return (
                          <EditableCell
                            key={column}
                            value={item?.order?.delivery?.status}
                            field="order.delivery.status"
                            cellClassName="expandable-column"
                            onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                          />
                        );
                      case 'quantity':
                        return (
                          <EditableCell
                            key={column}
                            value={item?.order?.quantity}
                            field="order.quantity"
                            cellClassName="expandable-column"
                            onUpdate={(field, value) => {
                              const intValue = value === '' || value === null ? null : parseInt(value);
                              handleUpdate(item.sectionId, item.itemIndex, field, intValue);
                            }}
                            type="number"
                          />
                        );
                      case 'comments':
                        return (
                          <td key={column} className="expandable-column">
                            <EditableCellContent
                              value={item?.comments?.cray || item?.comments?.client}
                              field="comments.cray"
                              onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value || null)}
                            />
                          </td>
                        );
                      case 'replacementUrls': {
                        const replacementUrls = item.clientReplacementUrls ?? getClientReplacementUrls(item);
                        const supplierLink = typeof item.supplierLink === 'string' ? item.supplierLink.trim() : '';
                        const combinedUrls = [];
                        if (supplierLink) {
                          combinedUrls.push(supplierLink);
                        }
                        replacementUrls.forEach((url) => {
                          if (typeof url === 'string') {
                            const trimmed = url.trim();
                            if (trimmed && !combinedUrls.includes(trimmed)) {
                              combinedUrls.push(trimmed);
                            }
                          }
                        });
                        return (
                          <td key={column} className="replacement-urls-cell">
                            {combinedUrls.length === 0 ? (
                              <span className="replacement-placeholder">—</span>
                            ) : (
                              <div className="replacement-url-list">
                                {combinedUrls.map((url, idx) => (
                                  <a
                                    key={`${url}-${idx}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="replacement-link"
                                  >
                                    {url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      }
                      default:
                        // Handle custom columns
                        if (column.startsWith('custom_')) {
                          const columnType = getColumnType(column);
                          const customValue = item?.customFields?.[column] ?? null;
                          
                          if (columnType === 'number') {
                            return (
                              <EditableCell
                                key={column}
                                value={customValue}
                                field={`customFields.${column}`}
                                onUpdate={(field, value) => {
                                  const numValue = value === '' || value === null ? null : parseFloat(value);
                                  handleUpdate(item.sectionId, item.itemIndex, field, numValue);
                                }}
                                type="number"
                              />
                            );
                          } else if (columnType === 'date') {
                            return (
                              <DateBubbleCell
                                key={column}
                                value={customValue}
                                field={`customFields.${column}`}
                                onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                              />
                            );
                          } else if (columnType === 'boolean') {
                            return (
                              <EditableCell
                                key={column}
                                value={customValue ? 'true' : 'false'}
                                field={`customFields.${column}`}
                                onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value === 'true' || value === true)}
                                type="select"
                                options={['false', 'true']}
                              />
                            );
                          } else {
                            // Default to text
                            return (
                              <EditableCell
                                key={column}
                                value={customValue}
                                field={`customFields.${column}`}
                                onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                type="text"
                              />
                            );
                          }
                        }
                        return <td key={column}>—</td>;
                    }
                  };
                  
                  return (
                    <tr key={`${item.sectionId}-${item.itemIndex}`} className={rowClassNames || undefined}>
                      <td className="select-column">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowKey)}
                          aria-label={`${t('select')} ${item.product || ''}`.trim()}
                        />
                      </td>
                      {columnOrder.map(column => renderCell(column))}
                      <td key="actions" className="actions-column" style={{ width: '40px', textAlign: 'center' }}>
                        <button 
                          className="delete-row-btn"
                          onClick={() => handleDeleteRow(item.sectionId, item.itemIndex)}
                          title={t('deleteRow') || 'Delete row'}
                          style={{
                            padding: '4px 8px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1'
                          }}
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
        
        {/* Export Buttons */}
        <div className="table-export-buttons">
          <button
            className="export-dropdown-btn"
            onClick={() => handleExportFacture(allItems)}
          >
            {t('exportFacture')}
          </button>
          <button
            className="export-dropdown-btn"
            onClick={() => handleExportDevis(allItems, columnOrder, false)}
          >
            {t('exportDevis')}
          </button>
        </div>
      </div>

      {/* Custom Table Section */}
      {customTableActive && customColumnOrder.length > 0 && (
        <div className="custom-table-section">
          <div className="custom-table-section-header">
            <h3>{t('customTable')}</h3>
            <button
              onClick={handleClearCustomTable}
              className="clear-custom-table-btn-small"
              title={t('clearCustomTable')}
            >
              ×
            </button>
          </div>
          <div className="materials-table-wrapper">
            <div className="table-container">
              <table className={`materials-table ${viewMode === 'concise' ? 'concise-mode' : 'expanded-mode'}`}>
              <thead>
                <tr>
                  {customColumnOrder.map((column) => {
                    const isExpandable = ['ordered', 'orderDate', 'deliveryDate', 'deliveryStatus', 'quantity', 'comments'].includes(column);
                    return (
                      <th 
                        key={column}
                        className={`sortable-header ${isExpandable ? 'expandable-column' : ''}`}
                        onClick={() => handleColumnSort(column)}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        {getColumnLabel(column)}
                        {sortColumn === column && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedAndGroupedItems.length === 0 ? (
                  <tr>
                    <td colSpan={customColumnOrder.length}>{t('noSearchResults')}</td>
                  </tr>
                ) : (
                  sortedAndGroupedItems.map((group, groupIndex) => (
                    <Fragment key={`custom-group-${groupIndex}`}>
                      <tr className="section-row">
                        <td colSpan={customColumnOrder.length}>
                          <div className="section-row-content">
                            <span>{getColumnLabel(sortColumn)}: {group.value}</span>
                          </div>
                        </td>
                      </tr>
                      {group.items.map((item) => {
                        const currentLaborType = item.laborType || determineLaborType(item.product, item.sectionLabel, item.sectionId);
                        
                        // Render cells based on custom column order
                        const renderCell = (column) => {
                          switch (column) {
                            case 'section':
                              return <td key={column}>{item.sectionLabel}</td>;
                            case 'product':
                              return (
                                <EditableCell
                                  key={column}
                                  value={item.product}
                                  field="product"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                />
                              );
                            case 'image': {
                              const rowKey = item.itemKey || makeItemKey(item.sectionId, item.itemIndex);
                              const supplierLink = item.supplierLink;
                              const imageUrl = productImages.get(rowKey);
                              
                              // Trigger image fetch if we have a supplier link but no image yet
                              if (supplierLink && !imageUrl) {
                                fetchProductImage(supplierLink, rowKey, item.reference);
                              }
                              
                              return (
                                <td key={column} className="product-image-cell">
                                  {imageUrl ? (
                                    <img 
                                      src={imageUrl} 
                                      alt={item.product || 'Product image'} 
                                      className="product-image"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : supplierLink ? (
                                    <span className="image-loading">Loading...</span>
                                  ) : (
                                    <span className="image-placeholder">—</span>
                                  )}
                                </td>
                              );
                            }
                            case 'reference':
                              return (
                                <EditableCell
                                  key={column}
                                  value={item.reference}
                                  field="reference"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                />
                              );
                            case 'laborType':
                              return (
                                <EditableCell
                                  key={column}
                                  value={currentLaborType}
                                  field="laborType"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                  type="select"
                                  options={LABOR_TYPES}
                                />
                              );
                            case 'priceTTC':
                              return (
                                <EditableCell
                                  key={column}
                                  value={item?.price?.ttc}
                                  field="price.ttc"
                                  onUpdate={(field, value) => {
                                    const numValue = value === '' || value === null ? null : parseFloat(value);
                                    handleUpdate(item.sectionId, item.itemIndex, field, numValue);
                                  }}
                                  type="number"
                                />
                              );
                            case 'htQuote':
                              return (
                                <HTQuoteCell
                                  key={column}
                                  value={item?.price?.htQuote}
                                  field="price.htQuote"
                                  onUpdate={(field, value) => {
                                    const numValue = value === '' || value === null ? null : parseFloat(value);
                                    handleUpdate(item.sectionId, item.itemIndex, field, numValue);
                                  }}
                                />
                              );
                            case 'clientValidation':
                              return (
                                <td key={column}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <EditableCell
                                      value={item?.approvals?.client?.status}
                                      field="approvals.client.status"
                                      onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                      type="select"
                                      options={ALLOWED_STATUSES}
                                    />
                                    <EditableCell
                                      value={item?.approvals?.client?.note}
                                      field="approvals.client.note"
                                      onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value || null)}
                                      type="text"
                                    />
                                  </div>
                                </td>
                              );
                            case 'crayValidation':
                              return (
                                <td key={column} style={{ position: 'relative' }}>
                                  <ApprovalCellContent
                                    statusValue={item?.approvals?.cray?.status}
                                    statusField="approvals.cray.status"
                                    noteValue={item?.approvals?.cray?.note}
                                    noteField="approvals.cray.note"
                                    onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value || null)}
                                  />
                                </td>
                              );
                            case 'ordered':
                              return (
                                <EditableCell
                                  key={column}
                                  value={item?.order?.ordered}
                                  field="order.ordered"
                                  cellClassName="expandable-column"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value === 'true' || value === true)}
                                  type="select"
                                  options={['false', 'true']}
                                />
                              );
                            case 'orderDate':
                              return (
                                <DateBubbleCell
                                  key={column}
                                  value={item?.order?.orderDate}
                                  field="order.orderDate"
                                  cellClassName="expandable-column"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                />
                              );
                            case 'deliveryDate':
                              return (
                                <DateBubbleCell
                                  key={column}
                                  value={item?.order?.delivery?.date}
                                  field="order.delivery.date"
                                  cellClassName="expandable-column"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                />
                              );
                            case 'deliveryStatus':
                              return (
                                <EditableCell
                                  key={column}
                                  value={item?.order?.delivery?.status}
                                  field="order.delivery.status"
                                  cellClassName="expandable-column"
                                  onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value)}
                                />
                              );
                            case 'quantity':
                              return (
                                <EditableCell
                                  key={column}
                                  value={item?.order?.quantity}
                                  field="order.quantity"
                                  cellClassName="expandable-column"
                                  onUpdate={(field, value) => {
                                    const intValue = value === '' || value === null ? null : parseInt(value);
                                    handleUpdate(item.sectionId, item.itemIndex, field, intValue);
                                  }}
                                  type="number"
                                />
                              );
                            case 'comments':
                              return (
                                <td key={column} className="expandable-column">
                                  <EditableCellContent
                                    value={item?.comments?.cray || item?.comments?.client}
                                    field="comments.cray"
                                    onUpdate={(field, value) => handleUpdate(item.sectionId, item.itemIndex, field, value || null)}
                                  />
                                </td>
                              );
                            case 'replacementUrls': {
                              const replacementUrls = item.clientReplacementUrls ?? getClientReplacementUrls(item);
                              const supplierLink = typeof item.supplierLink === 'string' ? item.supplierLink.trim() : '';
                              const combinedUrls = [];
                              if (supplierLink) {
                                combinedUrls.push(supplierLink);
                              }
                              replacementUrls.forEach((url) => {
                                if (typeof url === 'string') {
                                  const trimmed = url.trim();
                                  if (trimmed && !combinedUrls.includes(trimmed)) {
                                    combinedUrls.push(trimmed);
                                  }
                                }
                              });
                              return (
                                <td key={column} className="replacement-urls-cell">
                                  {combinedUrls.length === 0 ? (
                                    <span className="replacement-placeholder">—</span>
                                  ) : (
                                    <div className="replacement-url-list">
                                      {combinedUrls.map((url, idx) => (
                                        <a
                                          key={`${url}-${idx}`}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="replacement-link"
                                        >
                                          {url}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            default:
                              return <td key={column}>—</td>;
                          }
                        };
                        
                        return (
                          <tr key={`custom-${item.sectionId}-${item.itemIndex}`}>
                            {customColumnOrder.map(column => renderCell(column))}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
              </table>
            </div>
            
            {/* Export Buttons for Custom Table */}
            <div className="table-export-buttons">
              <button
                className="export-dropdown-btn"
                onClick={() => handleExportFacture(customTableItems)}
              >
                {t('exportFacture')}
              </button>
              <button
                className="export-dropdown-btn"
                onClick={() => handleExportDevis(customTableItems, customColumnOrder, true)}
              >
                {t('exportDevis')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

