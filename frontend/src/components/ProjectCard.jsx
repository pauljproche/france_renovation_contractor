import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

function ProjectCard({ project, isNewProject = false, onClick }) {
  const { t } = useTranslation();
  const { convertDemoToReal, removeOrDeleteProject, hiddenFromRegularDemos } = useProjects();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (isNewProject) {
    return (
      <Link to="/global-dashboard" className="project-card project-card-new">
        <div className="project-card-content">
          <div className="project-card-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
          <h3 className="project-card-title">{t('createNewProject')}</h3>
          <p className="project-card-subtitle">{t('createNewProjectDesc')}</p>
        </div>
      </Link>
    );
  }

  const statusLabels = {
    draft: t('projectStatusDraft'),
    ready: t('projectStatusReady'),
    active: t('projectStatusActive'),
    completed: t('projectStatusCompleted'),
    archived: t('projectStatusArchived'),
  };

  const statusDescriptions = {
    draft: t('projectStatusDraftDesc'),
    ready: t('projectStatusReadyDesc'),
    active: t('projectStatusActiveDesc'),
    completed: t('projectStatusCompletedDesc'),
    archived: t('projectStatusArchivedDesc'),
  };

  const statusColors = {
    draft: 'gray',
    ready: 'blue',
    active: 'green',
    completed: 'purple',
    archived: 'gray',
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleClick = (e) => {
    e.preventDefault();
    onClick?.(project.id);
  };

  const handleConvertDemo = (e) => {
    e.preventDefault();
    e.stopPropagation();
    convertDemoToReal(project.id);
    // Don't navigate - just convert and add to projects section
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    removeOrDeleteProject(project.id);
    setShowConfirmDialog(false);
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
  };

  const isDemo = project.isDemo;
  const isConvertedDemo = !isDemo && (
    project.id.startsWith('demo-project-') ||
    project.id.startsWith('empty-demo-project-') ||
    project.id.startsWith('pending-approval-demo-project-')
  );
  
  // Check if this is a demo project appearing in regular projects section
  // (main demo project that hasn't been hidden)
  const isDemoInRegular = isDemo && project.id === 'demo-project' && !hiddenFromRegularDemos.includes('demo-project');
  
  const getDeleteMessage = () => {
    if (isConvertedDemo) {
      return t('confirmRestoreDemo');
    }
    if (isDemoInRegular) {
      return t('confirmRestoreDemo');
    }
    return t('confirmDeleteProject');
  };

  return (
    <>
    <Link to="/materials" onClick={handleClick} className={`project-card ${isDemo ? 'project-card-demo' : ''}`}>
      {isDemo && (
        <span className="project-card-demo-badge">{t('demo')}</span>
      )}
      {(!isDemo || isDemoInRegular) && (
        <button
          type="button"
          className="project-card-delete-btn"
          onClick={handleDeleteClick}
          title={isConvertedDemo || isDemoInRegular ? t('restoreToDemos') : t('deleteProject')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
      <div className="project-card-content">
        {/* Row 1: Main Info */}
        <div className="project-card-row-1">
          <div className="project-card-title-wrapper">
            <h3 className="project-card-title">
              {project.name}
            </h3>
          </div>
          <div className="project-card-status-wrapper">
            {isDemo && !isDemoInRegular ? (
              <button
                type="button"
                className="project-card-convert-btn"
                onClick={handleConvertDemo}
                title={t('convertToRealProject')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20"/>
                </svg>
              </button>
            ) : (
              <div className="project-card-status-info-container">
                <button
                  type="button"
                  className="project-card-status-info"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  ?
                </button>
                <div className="project-card-status-tooltip">
                  {statusDescriptions[project.status] || ''}
                </div>
              </div>
            )}
            <span className={`project-card-status project-card-status-${statusColors[project.status]}`}>
              {statusLabels[project.status] || project.status}
            </span>
          </div>
        </div>
        
        {/* Row 2: Tags */}
        {(project.devisStatus || project.invoiceCount > 0) && (
          <div className="project-card-row-2">
            <div className="project-card-tags">
              <span className={`project-card-tag project-card-tag-combined ${project.devisStatus ? `project-card-tag-devis-${project.devisStatus}` : 'project-card-tag-invoice'}`}>
                {project.devisStatus === 'approved' && t('devisApproved')}
                {project.devisStatus === 'sent' && t('devisSent')}
                {project.devisStatus === 'rejected' && t('devisRejected')}
                {project.devisStatus && project.invoiceCount > 0 && ' • '}
                {project.invoiceCount === 1 && t('firstInvoiceSent')}
                {project.invoiceCount === 2 && t('secondInvoiceSent')}
                {project.invoiceCount === 3 && t('thirdInvoiceSent')}
                {project.invoiceCount > 3 && t('nthInvoiceSent').replace('{count}', project.invoiceCount)}
              </span>
            </div>
          </div>
        )}
        
        {/* Row 3: Date */}
        <div className="project-card-row-3">
          <span className="project-card-date">
            {formatDate(project.updatedAt)}
          </span>
        </div>
      </div>
    </Link>
    <ConfirmDialog
      isOpen={showConfirmDialog}
      onClose={handleCancelDelete}
      onConfirm={handleConfirmDelete}
      title={t('confirmAction')}
      message={getDeleteMessage()}
      requireName={true}
      projectName={project.name}
      showQuickDelete={isDemoInRegular || isConvertedDemo}
    />
    </>
  );
}

export default ProjectCard;

