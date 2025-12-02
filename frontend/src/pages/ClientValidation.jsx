import { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useMaterialsData, formatCurrency } from '../hooks/useMaterialsData.js';
import { useRole, ROLES } from '../contexts/AppContext.jsx';
import { logEdit } from '../services/editHistory.js';

function ClientValidation() {
  const { t, language } = useTranslation();
  const { role, customRoles } = useRole();
  const { data, loading, error, updateMaterials } = useMaterialsData();
  const [processingKeys, setProcessingKeys] = useState(() => new Set());

  const normalizeReplacementUrls = (materialItem) => {
    if (!materialItem?.approvals?.client) {
      return [];
    }
    const current = materialItem.approvals.client.replacementUrls;
    if (Array.isArray(current)) {
      return current.filter((url) => typeof url === 'string' && url.trim().length > 0);
    }
    const legacy = materialItem.approvals.client.replacementUrl;
    return typeof legacy === 'string' && legacy.trim().length > 0 ? [legacy.trim()] : [];
  };

  const itemsToValidate = useMemo(() => {
    if (!data?.sections) {
      return [];
    }

    const items = [];
    data.sections.forEach((section, sectionIndex) => {
      section.items.forEach((item, itemIndex) => {
        if (item?.approvals?.client?.sentForValidation) {
          // Role-based filtering
          const chantier = item.chantier || '';
          let shouldInclude = true;

          // If role is Alexis Roche, only show items with "Alexis Roche" in chantier
          if (role === ROLES.ALEXIS_ROCHE) {
            shouldInclude = chantier.toLowerCase().includes('alexis roche');
          }
          // If role is Paul Roche, only show items with "Paul Roche" in chantier
          else if (role === ROLES.PAUL_ROCHE) {
            shouldInclude = chantier.toLowerCase().includes('paul roche');
          }
          // For custom roles, check if the role name appears in the chantier
          else if (role && !Object.values(ROLES).includes(role)) {
            // This is a custom role - find the role name and check if it's in the chantier
            const customRole = customRoles.find(r => r.id === role);
            if (customRole) {
              // Extract first and last name from custom role name (e.g., "Emmanuel Roche" -> "Emmanuel Roche")
              const roleName = customRole.name;
              // Check if the role name appears in the chantier
              shouldInclude = chantier.toLowerCase().includes(roleName.toLowerCase());
            } else {
              // Custom role not found, show everything
              shouldInclude = true;
            }
          }
          // CLIENT role can see everything (global client)
          // CONTRACTOR and ARCHITECT can see everything
          // Other roles see everything by default

          if (shouldInclude) {
            items.push({
              sectionIndex,
              itemIndex,
              sectionId: section.id,
              sectionLabel: section.label,
              product: item.product,
              reference: item.reference,
              chantier: item.chantier,
              priceTTC: item?.price?.ttc,
              clientStatus: item?.approvals?.client?.status,
              clientNote: item?.approvals?.client?.note,
              sentAt: item?.approvals?.client?.sentAt,
              replacementUrls: normalizeReplacementUrls(item),
              key: `${section.id ?? section.label ?? sectionIndex}::${itemIndex}`
            });
          }
        }
      });
    });

    return items;
  }, [data, role, customRoles]);

  const statusLabels = {
    approved: t('approved'),
    change_order: t('changeOrder'),
    pending: t('pending'),
    rejected: t('rejected'),
    alternative: t('alternative') || 'Alternative',
    supplied_by: t('suppliedBy')
  };

  const formatSentDate = (isoValue) => {
    if (!isoValue) {
      return '—';
    }
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const handleClientDecision = async (item, decision) => {
    // Allow CLIENT, ALEXIS_ROCHE, PAUL_ROCHE, and custom roles to make decisions
    const isStandardClientRole = role === ROLES.CLIENT || role === ROLES.ALEXIS_ROCHE || role === ROLES.PAUL_ROCHE;
    const isCustomRole = role && !Object.values(ROLES).includes(role);
    const canValidate = isStandardClientRole || isCustomRole;
    
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
    else if (isCustomRole) {
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

    setProcessingKeys((prev) => {
      const next = new Set(prev);
      next.add(item.key);
      return next;
    });

    try {
      const cloned = JSON.parse(JSON.stringify(data));
      const section = cloned.sections?.[item.sectionIndex];
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
      delete target.approvals.client.sentForValidation;
      delete target.approvals.client.sentAt;

      const existingUrls = normalizeReplacementUrls(target);
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
        next.delete(item.key);
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
          <h2>{t('clientValidationTitle')}</h2>
          <p>{t('clientValidationSubtitle')}</p>
        </div>
      </header>

      <div className="materials-table-wrapper validation-wrapper">
        <div className="table-container">
          {itemsToValidate.length === 0 ? (
            <div className="empty-state">
              <p>{t('noClientValidationItems')}</p>
            </div>
          ) : (
            <table className="materials-table validation-table">
              <thead>
                <tr>
                  <th>{t('section')}</th>
                  <th>{t('chantier') || 'Chantier / Construction Site'}</th>
                  <th>{t('product')}</th>
                  <th>{t('reference')}</th>
                  <th>{t('priceTTC')}</th>
                  <th>{t('clientValidation')}</th>
                  <th>{t('comments')}</th>
                  <th>{t('clientValidationSentOn')}</th>
                  {(role === ROLES.CLIENT || role === ROLES.ALEXIS_ROCHE || role === ROLES.PAUL_ROCHE || (role && !Object.values(ROLES).includes(role))) && <th>{t('actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {itemsToValidate.map((item) => (
                  <tr key={item.key}>
                    <td>{item.sectionLabel || '—'}</td>
                    <td>{item.chantier || '—'}</td>
                    <td>{item.product || '—'}</td>
                    <td>{item.reference || '—'}</td>
                    <td>{formatCurrency(item.priceTTC, language === 'fr' ? 'fr-FR' : 'en-US')}</td>
                    <td>
                      <span className={`tag ${item.clientStatus || 'pending'}`}>
                        {statusLabels[item.clientStatus] || item.clientStatus || t('unknownTag')}
                      </span>
                    </td>
                    <td>
                      <div className="client-comments-cell">
                        <span>{item.clientNote || '—'}</span>
                        {item.replacementUrls?.length > 0 && (
                          <ul className="replacement-list">
                            {item.replacementUrls.map((url, idx) => (
                              <li key={`${url}-${idx}`}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="replacement-link"
                                >
                                  {url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td>{formatSentDate(item.sentAt)}</td>
                    {(role === ROLES.CLIENT || role === ROLES.ALEXIS_ROCHE || role === ROLES.PAUL_ROCHE || (role && !Object.values(ROLES).includes(role))) && (
                      <td>
                        <div className="client-validation-actions">
                          <button
                            type="button"
                            className="client-approve-btn"
                            onClick={() => handleClientDecision(item, 'approved')}
                            disabled={processingKeys.has(item.key)}
                          >
                            {t('clientApprove')}
                          </button>
                          <button
                            type="button"
                            className="client-alternative-btn"
                            onClick={() => handleClientDecision(item, 'alternative')}
                            disabled={processingKeys.has(item.key)}
                          >
                            {t('clientAlternative') || 'Alternative'}
                          </button>
                          <button
                            type="button"
                            className="client-reject-btn"
                            onClick={() => handleClientDecision(item, 'rejected')}
                            disabled={processingKeys.has(item.key)}
                          >
                            {t('clientReject')}
                          </button>
                        </div>
                      </td>
                    )}
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

export default ClientValidation;

