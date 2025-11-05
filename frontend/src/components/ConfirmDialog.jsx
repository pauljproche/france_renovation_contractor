import { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, requireName, projectName, showQuickDelete }) {
  const { t } = useTranslation();
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setShowNameConfirm(false);
      setTypedName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleYesClick = () => {
    if (requireName && !showNameConfirm) {
      setShowNameConfirm(true);
    } else if (requireName && showNameConfirm) {
      if (typedName === projectName) {
        onConfirm();
      }
    } else {
      onConfirm();
    }
  };

  const handleQuickDelete = () => {
    onConfirm();
  };

  const handleFinalConfirm = () => {
    if (typedName === projectName) {
      onConfirm();
    }
  };

  const isNameMatch = typedName === projectName;

  return (
    <div className="confirm-dialog-overlay" onClick={handleBackdropClick}>
      <div className="confirm-dialog">
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        
        {showNameConfirm && requireName && (
          <div className="confirm-dialog-name-input">
            <label htmlFor="confirm-project-name">
              {t('typeProjectNameToConfirm', { projectName: projectName })}
            </label>
            <input
              id="confirm-project-name"
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={projectName}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isNameMatch) {
                  handleFinalConfirm();
                }
              }}
            />
            {showQuickDelete && (
              <div className="confirm-dialog-quick-delete">
                <button
                  type="button"
                  className="confirm-dialog-btn confirm-dialog-btn-quick"
                  onClick={handleQuickDelete}
                >
                  {t('quickDelete')}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-btn confirm-dialog-btn-cancel"
            onClick={onClose}
          >
            {t('no')}
          </button>
          {showNameConfirm && requireName ? (
            <button
              type="button"
              className="confirm-dialog-btn confirm-dialog-btn-confirm"
              onClick={handleFinalConfirm}
              disabled={!isNameMatch}
            >
              {t('confirmDelete')}
            </button>
          ) : (
            <button
              type="button"
              className="confirm-dialog-btn confirm-dialog-btn-confirm"
              onClick={handleYesClick}
            >
              {t('yes')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

