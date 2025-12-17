import { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useMaterialsData, formatCurrency } from '../hooks/useMaterialsData.js';
import { useRole, ROLES } from '../contexts/AppContext.jsx';

function ClientMaterials() {
  const { t, language } = useTranslation();
  const { role, customRoles } = useRole();
  const { data, loading, error } = useMaterialsData();
  const [selectedChantier, setSelectedChantier] = useState('');

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
                      <span className={`tag ${item?.approvals?.client?.status || 'pending'}`}>
                        {item?.approvals?.client?.status || 'pending'}
                      </span>
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
















