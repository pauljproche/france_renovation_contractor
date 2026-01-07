import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';

function ActionPreviewModal({ preview, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState('nlp'); // 'nlp' or 'sql'
  const [confirming, setConfirming] = useState(false);

  if (!preview) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(preview.action_id);
    } catch (error) {
      console.error('Error confirming action:', error);
      alert(error.message || 'Failed to confirm action');
    } finally {
      setConfirming(false);
    }
  };

  const previewData = preview.preview || preview;
  const nlpText = previewData.nlp || '';
  const sqlQuery = previewData.sql?.query || '';
  const sqlParams = previewData.sql?.params || {};
  const action = previewData.action || '';
  const affectedItems = previewData.affected_items || [];

  // Format SQL parameters for display
  const formatSqlParams = (params) => {
    if (!params || typeof params !== 'object') return '';
    return Object.entries(params)
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
      .join(', ');
  };

  const formattedSql = sqlQuery && sqlParams 
    ? `${sqlQuery}\n\n-- Parameters:\n-- ${formatSqlParams(sqlParams)}`
    : sqlQuery;

  return (
    <div className="action-preview-modal-overlay" onClick={onCancel}>
      <div className="action-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="action-preview-header">
          <h3>{language === 'fr' ? 'Aperçu de l\'action' : 'Action Preview'}</h3>
          <button
            type="button"
            className="action-preview-close"
            onClick={onCancel}
            aria-label={language === 'fr' ? 'Fermer' : 'Close'}
          >
            ×
          </button>
        </div>

        <div className="action-preview-content">
          {/* Action Type */}
          <div className="action-preview-section">
            <label className="action-preview-label">
              {language === 'fr' ? 'Type d\'action' : 'Action Type'}
            </label>
            <div className="action-preview-value">{action}</div>
          </div>

          {/* Affected Items */}
          {affectedItems.length > 0 && (
            <div className="action-preview-section">
              <label className="action-preview-label">
                {language === 'fr' ? 'Éléments affectés' : 'Affected Items'}
              </label>
              <div className="action-preview-items">
                {affectedItems.map((item, index) => (
                  <div key={index} className="action-preview-item">
                    <strong>{item.product}</strong>
                    {item.section && <span className="action-preview-section-name"> ({item.section})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current/New Values */}
          {previewData.current_value !== undefined && (
            <div className="action-preview-section">
              <label className="action-preview-label">
                {language === 'fr' ? 'Valeur actuelle' : 'Current Value'}
              </label>
              <div className="action-preview-value">
                {typeof previewData.current_value === 'object' 
                  ? JSON.stringify(previewData.current_value, null, 2)
                  : String(previewData.current_value || 'null')}
              </div>
            </div>
          )}

          {previewData.new_value !== undefined && (
            <div className="action-preview-section">
              <label className="action-preview-label">
                {language === 'fr' ? 'Nouvelle valeur' : 'New Value'}
              </label>
              <div className="action-preview-value">
                {typeof previewData.new_value === 'object'
                  ? JSON.stringify(previewData.new_value, null, 2)
                  : String(previewData.new_value || 'null')}
              </div>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="action-preview-section">
            <div className="action-preview-toggle">
              <button
                type="button"
                className={`action-preview-toggle-btn ${viewMode === 'nlp' ? 'active' : ''}`}
                onClick={() => setViewMode('nlp')}
              >
                {language === 'fr' ? 'Description' : 'Description'}
              </button>
              <button
                type="button"
                className={`action-preview-toggle-btn ${viewMode === 'sql' ? 'active' : ''}`}
                onClick={() => setViewMode('sql')}
              >
                SQL
              </button>
            </div>

            {/* NLP View */}
            {viewMode === 'nlp' && (
              <div className="action-preview-text">
                <p>{nlpText || (language === 'fr' ? 'Aucune description disponible' : 'No description available')}</p>
              </div>
            )}

            {/* SQL View */}
            {viewMode === 'sql' && (
              <div className="action-preview-sql">
                <pre className="action-preview-sql-code">
                  {formattedSql || (language === 'fr' ? 'Aucune requête SQL disponible' : 'No SQL query available')}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="action-preview-actions">
          <button
            type="button"
            className="action-preview-cancel"
            onClick={onCancel}
            disabled={confirming}
          >
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
          <button
            type="button"
            className="action-preview-confirm"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming 
              ? (language === 'fr' ? 'Confirmation...' : 'Confirming...')
              : (language === 'fr' ? 'Confirmer' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionPreviewModal;


