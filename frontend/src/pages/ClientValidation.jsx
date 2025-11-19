import { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useMaterialsData, formatCurrency } from '../hooks/useMaterialsData.js';
import { useRole, ROLES } from '../contexts/AppContext.jsx';
import { logEdit } from '../services/editHistory.js';

function ClientValidation() {
  const { t, language } = useTranslation();
  const { role } = useRole();
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
          items.push({
            sectionIndex,
            itemIndex,
            sectionId: section.id,
            sectionLabel: section.label,
            product: item.product,
            reference: item.reference,
            priceTTC: item?.price?.ttc,
            clientStatus: item?.approvals?.client?.status,
            clientNote: item?.approvals?.client?.note,
            sentAt: item?.approvals?.client?.sentAt,
            replacementUrls: normalizeReplacementUrls(item),
            key: `${section.id ?? section.label ?? sectionIndex}::${itemIndex}`
          });
        }
      });
    });

    return items;
  }, [data]);

  const statusLabels = {
    approved: t('approved'),
    change_order: t('changeOrder'),
    pending: t('pending'),
    rejected: t('rejected'),
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
    if (role !== ROLES.CLIENT || !data) {
      return;
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
                  <th>{t('product')}</th>
                  <th>{t('reference')}</th>
                  <th>{t('priceTTC')}</th>
                  <th>{t('clientValidation')}</th>
                  <th>{t('comments')}</th>
                  <th>{t('clientValidationSentOn')}</th>
                  {role === ROLES.CLIENT && <th>{t('actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {itemsToValidate.map((item) => (
                  <tr key={item.key}>
                    <td>{item.sectionLabel || '—'}</td>
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
                    {role === ROLES.CLIENT && (
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

