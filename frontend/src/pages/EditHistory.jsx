import { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { getEditHistory } from '../services/editHistory.js';

function EditHistory() {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getEditHistory(500); // Get last 500 edits
      setHistory(data);
    } catch (err) {
      setError(err.message || 'Unable to load edit history');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>;
    }
    if (typeof value === 'object') {
      return <code style={{ fontSize: '0.875rem' }}>{JSON.stringify(value)}</code>;
    }
    return String(value);
  };

  const getSourceBadge = (source) => {
    if (source === 'agent') {
      return <span className="tag" style={{ background: '#3b82f6', color: '#fff' }}>Agent</span>;
    }
    return <span className="tag" style={{ background: '#6b7280', color: '#fff' }}>Manual</span>;
  };

  if (loading) {
    return (
      <>
        <header className="content-header">
          <div>
            <h2>{t('editHistoryTitle') || 'Edit History'}</h2>
            <p>{t('editHistorySubtitle') || 'Track all changes made to the materials table'}</p>
          </div>
        </header>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <span className="loader">{t('loadingData') || 'Loading data…'}</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <header className="content-header">
          <div>
            <h2>{t('editHistoryTitle') || 'Edit History'}</h2>
            <p>{t('editHistorySubtitle') || 'Track all changes made to the materials table'}</p>
          </div>
        </header>
        <div style={{ padding: '20px' }}>
          <p className="warning">{error}</p>
          <button onClick={loadHistory} style={{ marginTop: '12px', padding: '8px 16px' }}>
            {t('retry') || 'Retry'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('editHistoryTitle') || 'Edit History'}</h2>
          <p>{t('editHistorySubtitle') || 'Track all changes made to the materials table'}</p>
        </div>
        <button onClick={loadHistory} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
          {t('refresh') || 'Refresh'}
        </button>
      </header>

      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)', overflow: 'hidden' }}>
        {history.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <p>{t('noEditHistory') || 'No edit history yet. Edits made to the materials table will appear here.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('timestamp') || 'Timestamp'}
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('section') || 'Section'}
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('product') || 'Product'}
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('field') || 'Field'}
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('oldValue') || 'Old Value'}
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('newValue') || 'New Value'}
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    {t('source') || 'Source'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((edit, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>
                      {formatTimestamp(edit.timestamp)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {edit.section_label || edit.section_id}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {edit.product || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {edit.field_path}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', maxWidth: '200px', wordBreak: 'break-word' }}>
                      {formatValue(edit.old_value)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', maxWidth: '200px', wordBreak: 'break-word' }}>
                      {formatValue(edit.new_value)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {getSourceBadge(edit.source)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default EditHistory;





