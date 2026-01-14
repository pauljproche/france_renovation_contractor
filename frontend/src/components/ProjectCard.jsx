import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import CreateProjectModal from './CreateProjectModal.jsx';

function ProjectCard({ project, isNewProject = false, onClick }) {
  const { t } = useTranslation();
  const { convertDemoToReal, removeOrDeleteProject, hiddenFromRegularDemos, toggleProjectHidden } = useProjects();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isNewProject) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="project-card project-card-new"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0
          }}
        >
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
        </button>
        <CreateProjectModal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)} 
        />
      </>
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

  const handleToggleHidden = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newHiddenState = !project.hidden;
    console.log('Toggling hidden state:', { projectId: project.id, currentHidden: project.hidden, newHiddenState });
    await toggleProjectHidden(project.id, newHiddenState);
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
      <div className="project-card-actions">
        {/* Hide/Show button - available for all projects */}
        <button
          type="button"
          className="project-card-hide-btn"
          onClick={handleToggleHidden}
          title={project.hidden ? t('showProject') : t('hideProject')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {project.hidden ? (
              // Eye with slash (show)
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </>
            ) : (
              // Eye (hide)
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </>
            )}
          </svg>
        </button>
        
        {/* Delete button - only for non-system projects */}
        {(!isDemo || isDemoInRegular) && !project.isSystem && (
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
      </div>
      <div className="project-card-content">
        {project.hidden && (
          <div style={{ 
            position: 'absolute', 
            top: '8px', 
            left: '8px', 
            backgroundColor: '#fef3c7', 
            color: '#92400e', 
            padding: '4px 8px', 
            borderRadius: '4px', 
            fontSize: '0.75rem', 
            fontWeight: '500',
            zIndex: 1
          }}>
            {t('hidden') || 'Hidden'}
          </div>
        )}
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

