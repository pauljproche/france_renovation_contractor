import { useTranslation } from '../../hooks/useTranslation.js';

/**
 * Component for displaying approval status tags with optional notes
 */
export function ApprovalTag({ status, note }) {
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

