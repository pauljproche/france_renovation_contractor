import { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useMaterialsData, formatCurrency } from '../hooks/useMaterialsData.js';
import { useRole, ROLES } from '../contexts/AppContext.jsx';
import { logEdit } from '../services/editHistory.js';

function ClientMaterials() {
  const { t, language } = useTranslation();
  const { role, customRoles } = useRole();
  const { data, loading, error, updateMaterials } = useMaterialsData();
  const [selectedChantier, setSelectedChantier] = useState('');
  const [processingKeys, setProcessingKeys] = useState(() => new Set());

  // Get items filtered by role and chantier
  const items = useMemo(() => {
    if (!data?.sections) {
      return [];
    }

    const allItems = [];
    data.sections.forEach((section) => {
      section.items.forEach((item, itemIndex) => {
        allItems.push({
          ...item,
          sectionId: section.id,
          sectionLabel: section.label,
          itemIndex
        });
      });
    });

    // Apply role-based filtering
    let filteredItems = allItems;
    
    if (role === ROLES.ALEXIS_ROCHE) {
      filteredItems = allItems.filter((item) => {
        const itemChantier = item.chantier || '';
        return itemChantier.toLowerCase().includes('alexis roche');
      });
    } else if (role === ROLES.PAUL_ROCHE) {
      filteredItems = allItems.filter((item) => {
        const itemChantier = item.chantier || '';
        return itemChantier.toLowerCase().includes('paul roche');
      });
    } else if (role && !Object.values(ROLES).includes(role)) {
      const customRole = customRoles.find(r => r.id === role);
      if (customRole) {
        const roleName = customRole.name;
        filteredItems = allItems.filter((item) => {
          const itemChantier = item.chantier || '';
          return itemChantier.toLowerCase().includes(roleName.toLowerCase());
        });
      }
    }
    // CLIENT role sees everything

    // Apply chantier filter
    if (selectedChantier) {
      filteredItems = filteredItems.filter((item) => {
        const itemChantier = item.chantier || '';
        return itemChantier === selectedChantier;
      });
    }

    return filteredItems;
  }, [data, role, customRoles, selectedChantier]);

  // Get unique chantiers
  const availableChantiers = useMemo(() => {
    if (!data?.sections) {
      return [];
    }
    const allItems = [];
    data.sections.forEach((section) => {
      section.items.forEach((item) => {
        allItems.push(item);
      });
    });
    
    // Apply role-based filtering
    let roleFilteredItems = allItems;
    if (role === ROLES.ALEXIS_ROCHE) {
      roleFilteredItems = allItems.filter((item) => {
        const itemChantier = item.chantier || '';
        return itemChantier.toLowerCase().includes('alexis roche');
      });
    } else if (role === ROLES.PAUL_ROCHE) {
      roleFilteredItems = allItems.filter((item) => {
        const itemChantier = item.chantier || '';
        return itemChantier.toLowerCase().includes('paul roche');
      });
    } else if (role && !Object.values(ROLES).includes(role)) {
      const customRole = customRoles.find(r => r.id === role);
      if (customRole) {
        const roleName = customRole.name;
        roleFilteredItems = allItems.filter((item) => {
          const itemChantier = item.chantier || '';
          return itemChantier.toLowerCase().includes(roleName.toLowerCase());
        });
      }
    }
    
    const chantiers = new Set();
    roleFilteredItems.forEach((item) => {
      if (item.chantier && typeof item.chantier === 'string' && item.chantier.trim()) {
        chantiers.add(item.chantier.trim());
      }
    });
    
    return Array.from(chantiers).sort();
  }, [data, role, customRoles]);

  // Reset selected chantier if it's no longer available
  useMemo(() => {
    if (selectedChantier && !availableChantiers.includes(selectedChantier)) {
      setSelectedChantier('');
    }
  }, [availableChantiers, selectedChantier]);

  // Check if user can validate items
  const canValidate = useMemo(() => {
    const isStandardClientRole = role === ROLES.CLIENT || role === ROLES.ALEXIS_ROCHE || role === ROLES.PAUL_ROCHE;
    const isCustomRole = role && !Object.values(ROLES).includes(role);
    return isStandardClientRole || isCustomRole;
  }, [role]);

  // Handle client validation decision
  const handleClientDecision = async (item, decision) => {
    if (!canValidate || !data) {
      return;
    }

    const chantier = item.chantier || '';

    // Additional check: Alexis Roche can only validate his own items
    if (role === ROLES.ALEXIS_ROCHE) {
      if (!chantier.toLowerCase().includes('alexis roche')) {
        alert(t('clientValidationUnauthorized') || 'You can only validate items for your own projects.');
        return;
      }
    }
    // Additional check: Paul Roche can only validate his own items
    else if (role === ROLES.PAUL_ROCHE) {
      if (!chantier.toLowerCase().includes('paul roche')) {
        alert(t('clientValidationUnauthorized') || 'You can only validate items for your own projects.');
        return;
      }
    }
    // Additional check: Custom roles can only validate their own items
    else if (role && !Object.values(ROLES).includes(role)) {
      const customRole = customRoles.find(r => r.id === role);
      if (customRole) {
        const roleName = customRole.name;
        if (!chantier.toLowerCase().includes(roleName.toLowerCase())) {
          alert(t('clientValidationUnauthorized') || 'You can only validate items for your own projects.');
          return;
        }
      }
    }

    let replacementUrlInput;
    if (decision === 'rejected') {
      const input = window.prompt(t('clientReplacementPrompt'));
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed.length > 0) {
          replacementUrlInput = trimmed;
        }
      }
    } else if (decision === 'alternative') {
      const input = window.prompt(t('clientAlternativePrompt') || 'Please provide an alternative URL for this item:');
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed.length > 0) {
          replacementUrlInput = trimmed;
        }
      }
    }

    const itemKey = `${item.sectionId}-${item.itemIndex}`;
    setProcessingKeys((prev) => {
      const next = new Set(prev);
      next.add(itemKey);
      return next;
    });

    try {
      const cloned = JSON.parse(JSON.stringify(data));
      const section = cloned.sections?.find(s => s.id === item.sectionId || s.label === item.sectionLabel);
      if (!section || !section.items?.[item.itemIndex]) {
        throw new Error('Invalid item reference');
      }

      const target = section.items[item.itemIndex];
      if (!target.approvals) {
        target.approvals = {};
      }
      if (!target.approvals.client) {
        target.approvals.client = {};
      }

      // Get old value before updating for logging
      const oldStatus = target.approvals.client.status || null;

      target.approvals.client.status = decision;
      target.approvals.client.validatedAt = new Date().toISOString();
      // Don't delete sentForValidation here - keep it for tracking
      // delete target.approvals.client.sentForValidation;
      // delete target.approvals.client.sentAt;

      const existingUrls = target.approvals.client.replacementUrls || [];
      if (typeof replacementUrlInput === 'string' && replacementUrlInput.length > 0) {
        existingUrls.push(replacementUrlInput);
      }

      if (existingUrls.length > 0) {
        target.approvals.client.replacementUrls = Array.from(new Set(existingUrls));
      } else if (target.approvals.client.replacementUrls) {
        delete target.approvals.client.replacementUrls;
      }
      if (target.approvals.client.replacementUrl) {
        delete target.approvals.client.replacementUrl;
      }

      const result = await updateMaterials(cloned);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update materials');
      }

      // Log the edit to history
      logEdit({
        sectionId: item.sectionId,
        sectionLabel: item.sectionLabel || item.sectionId,
        itemIndex: item.itemIndex,
        product: item.product || '',
        fieldPath: 'approvals.client.status',
        oldValue: oldStatus,
        newValue: decision,
        source: 'manual'
      }).catch(err => {
        // Silently fail - don't block the UI if logging fails
        console.warn('Failed to log client validation edit:', err);
      });
    } catch (err) {
      console.error('Error updating client validation:', err);
      alert(t('clientDecisionError'));
    } finally {
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  if (loading) {
    return <span className="loader">{t('loadingData')}</span>;
  }

  if (error) {
    return <p className="warning">{error}</p>;
  }

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('clientMaterialsTitle') || 'Client Materials'}</h2>
          <p>{t('clientMaterialsSubtitle') || 'View your project materials'}</p>
        </div>
      </header>

      {availableChantiers.length > 0 && (
        <div className="table-controls">
          <div className="table-controls-left">
            <div className="chantier-filter">
              <label htmlFor="client-chantier-filter-select" className="chantier-filter-label">
                {t('filterByChantier') || 'Filter by Chantier:'}
              </label>
              <select
                id="client-chantier-filter-select"
                value={selectedChantier}
                onChange={(e) => setSelectedChantier(e.target.value)}
                className="chantier-filter-select"
              >
                <option value="">{t('allChantiers') || 'All Chantiers'}</option>
                {availableChantiers.map((chantier) => (
                  <option key={chantier} value={chantier}>
                    {chantier}
                  </option>
                ))}
              </select>
              {selectedChantier && (
                <button
                  type="button"
                  onClick={() => setSelectedChantier('')}
                  className="chantier-filter-clear"
                  title={t('clearFilter') || 'Clear filter'}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="materials-table-wrapper">
        <div className="table-container">
          {items.length === 0 ? (
            <div className="empty-state">
              <p>{t('noMaterials') || 'No materials found'}</p>
            </div>
          ) : (
            <table className="materials-table">
              <thead>
                <tr>
                  <th>{t('section')}</th>
                  <th>{t('chantier') || 'Chantier / Construction Site'}</th>
                  <th>{t('product')}</th>
                  <th>{t('priceTTC')}</th>
                  <th>{t('clientValidation')}</th>
                  <th>{t('crayValidation')}</th>
                  <th>Commandé</th>
                  <th>Date C</th>
                  <th>Date réception</th>
                  <th>Status réception</th>
                  <th>{t('quantity')}</th>
                  <th>{t('comments')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.sectionId}-${item.itemIndex}-${index}`}>
                    <td>{item.sectionLabel || '—'}</td>
                    <td>{item.chantier || '—'}</td>
                    <td>{item.product || '—'}</td>
                    <td>{item?.price?.ttc ? formatCurrency(item.price.ttc, language === 'fr' ? 'fr-FR' : 'en-US') : '—'}</td>
                    <td>
                      <div className="client-validation-cell">
                        <span className={`tag ${item?.approvals?.client?.status || 'pending'}`}>
                          {item?.approvals?.client?.status || 'pending'}
                        </span>
                        {canValidate && (
                          <div className="client-validation-actions-inline">
                            <button
                              type="button"
                              className="client-approve-btn-inline"
                              onClick={() => handleClientDecision(item, 'approved')}
                              disabled={processingKeys.has(`${item.sectionId}-${item.itemIndex}`)}
                              title={t('clientApprove')}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="client-alternative-btn-inline"
                              onClick={() => handleClientDecision(item, 'alternative')}
                              disabled={processingKeys.has(`${item.sectionId}-${item.itemIndex}`)}
                              title={t('clientAlternative') || 'Alternative'}
                            >
                              ↻
                            </button>
                            <button
                              type="button"
                              className="client-reject-btn-inline"
                              onClick={() => handleClientDecision(item, 'rejected')}
                              disabled={processingKeys.has(`${item.sectionId}-${item.itemIndex}`)}
                              title={t('clientReject')}
                            >
                              ✗
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`tag ${item?.approvals?.cray?.status || 'pending'}`}>
                        {item?.approvals?.cray?.status || 'pending'}
                      </span>
                    </td>
                    <td>{item?.order?.ordered ? 'true' : 'false'}</td>
                    <td>{item?.order?.orderDate || '—'}</td>
                    <td>{item?.order?.delivery?.date || '—'}</td>
                    <td>{item?.order?.delivery?.status || '—'}</td>
                    <td>{item?.order?.quantity || '—'}</td>
                    <td>{item?.comments?.cray || item?.comments?.client || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default ClientMaterials;






















