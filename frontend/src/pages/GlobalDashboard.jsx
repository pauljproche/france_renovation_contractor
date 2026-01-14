import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import { formatCurrency } from '../hooks/useMaterialsData.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function GlobalDashboard() {
  const { t } = useTranslation();
  const { projects, selectProject, hiddenFromRegularDemos, createProject } = useProjects();
  const navigate = useNavigate();
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [demoExpanded, setDemoExpanded] = useState(false);
  const [previousDemoCount, setPreviousDemoCount] = useState(0);
  const [materialsData, setMaterialsData] = useState(null);
  const [showHiddenProjects, setShowHiddenProjects] = useState(false);

  const handleProjectClick = (projectId) => {
    selectProject(projectId);
    // Navigate to tracking dashboard for the selected project
    navigate('/dashboard');
  };

  // Separate demo projects from regular projects
  // "Demo Renovation Project" (demo-project) appears in regular projects by default
  // Other demos appear in "More Demo Projects" section
  // Unless a demo has been hidden from regular projects
  const { demoProjects, regularProjects } = useMemo(() => {
    const mainDemoId = 'demo-project';
    
    // Debug: log projects and their hidden status
    console.log('Filtering projects:', {
      showHiddenProjects,
      totalProjects: projects.length,
      projectsWithHidden: projects.filter(p => p.hidden).map(p => ({ id: p.id, name: p.name, hidden: p.hidden }))
    });
    
    const demos = projects.filter(p => {
      // Exclude hidden projects unless showHiddenProjects is true
      // Explicitly check for true (not just truthy)
      if (p.hidden === true && !showHiddenProjects) {
        return false;
      }
      
      if (!p.isDemo) return false;
      // If main demo is hidden from regular, include it in demos
      if (p.id === mainDemoId && hiddenFromRegularDemos.includes(mainDemoId)) {
        return true;
      }
      // Other demos always go to demos section
      return p.id !== mainDemoId;
    });
    const regular = projects.filter(p => {
      // Exclude hidden projects unless showHiddenProjects is true
      // Explicitly check for true (not just truthy)
      if (p.hidden === true && !showHiddenProjects) {
        return false;
      }
      
      if (!p.isDemo) return true;
      // Main demo appears in regular unless hidden
      if (p.id === mainDemoId && !hiddenFromRegularDemos.includes(mainDemoId)) {
        return true;
      }
      return false;
    });
    
    return { demoProjects: demos, regularProjects: regular };
  }, [projects, hiddenFromRegularDemos, showHiddenProjects]);

  // Auto-expand demo section only when a new demo project is restored (count increases)
  useEffect(() => {
    if (demoProjects.length > previousDemoCount && demoProjects.length > 0) {
      setDemoExpanded(true);
      setPreviousDemoCount(demoProjects.length);
    } else if (demoProjects.length < previousDemoCount) {
      // Update count when demos are removed
      setPreviousDemoCount(demoProjects.length);
    }
  }, [demoProjects.length, previousDemoCount]);

  // Load materials data to check client approval status
  // Note: We load ALL materials here (no project filter) to check across all projects
  useEffect(() => {
    async function loadMaterials() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/materials?ts=${Date.now()}`, {
          cache: 'no-store'
        });
        if (response.ok) {
          const data = await response.json();
          setMaterialsData(data);
        }
      } catch (err) {
        console.warn('Failed to load materials for client approval check:', err);
      }
    }
    loadMaterials();
  }, []);

  // Calculate project metrics
  const projectMetrics = useMemo(() => {
    // Helper function to check if a project is client approved
    // This checks if all items that have been validated (or sent for validation) are approved by the client
    const checkProjectClientApproved = (project) => {
      if (!materialsData?.sections) {
        // If no materials data, fall back to devisStatus check
        return project.devisStatus === 'approved';
      }
      
      // Try to match project by chantier field or project name/address
      const projectName = project.name || project.address || '';
      const projectId = project.id || '';
      
      // Check all items in materials to see if they belong to this project
      let totalItemsWithValidation = 0;
      let totalApproved = 0;
      let totalPending = 0;
      
      materialsData.sections.forEach((section) => {
        section.items?.forEach((item) => {
          const itemChantier = item?.chantier || '';
          
          // Match by chantier containing project name/address, or by project ID
          // Also try matching by project name containing parts of chantier
          const matchesProject = 
            (projectName && itemChantier.toLowerCase().includes(projectName.toLowerCase())) ||
            (projectId && itemChantier.toLowerCase().includes(projectId.toLowerCase())) ||
            (itemChantier && projectName.toLowerCase().includes(itemChantier.toLowerCase())) ||
            // Also check if project name matches chantier exactly (case-insensitive)
            (itemChantier && projectName.toLowerCase() === itemChantier.toLowerCase());
          
          if (matchesProject) {
            const clientStatus = item?.approvals?.client?.status;
            const wasSentForValidation = item?.approvals?.client?.sentForValidation || 
                                         item?.approvals?.client?.sentAt;
            const hasValidationStatus = clientStatus && 
                                       (clientStatus === 'approved' || 
                                        clientStatus === 'pending' || 
                                        clientStatus === 'rejected' || 
                                        clientStatus === 'alternative' ||
                                        clientStatus === 'supplied_by');
            
            // Count items that either:
            // 1. Were sent for validation, OR
            // 2. Have a client validation status set (approved/pending/rejected/alternative/supplied_by)
            if (wasSentForValidation || hasValidationStatus) {
              totalItemsWithValidation++;
              
              if (clientStatus === 'approved') {
                totalApproved++;
              } else if (clientStatus === 'pending') {
                totalPending++;
              }
            }
          }
        });
      });
      
      // Project is approved if:
      // 1. There are items with validation status, AND
      // 2. All items are approved (no pending or rejected items)
      if (totalItemsWithValidation > 0) {
        return totalApproved === totalItemsWithValidation && totalPending === 0;
      }
      
      // If no items have validation status, fall back to devisStatus check
      return project.devisStatus === 'approved';
    };
    // Separate real projects from demo projects
    const realProjects = regularProjects.filter(p => !p.isDemo);
    const mainDemoId = 'demo-project';
    const mainDemoProject = regularProjects.find(p => p.isDemo && p.id === mainDemoId);
    
    // Determine which projects to include in metrics:
    // - Always include the main demo project (Demo Renovation Project) if it's in regularProjects
    //   (i.e., not hidden/moved to "More Demo Projects" section)
    // - Include all real projects
    // - Only exclude demo if it's been moved to the demo section (not in regularProjects)
    const hasRealProjects = realProjects.length > 0;
    const allProjects = [];
    
    // Always add real projects
    allProjects.push(...realProjects);
    
    // Add main demo project if it's still in regularProjects (not moved to demo section)
    if (mainDemoProject) {
      allProjects.push(mainDemoProject);
    }
    
    // Check if metrics are showing demo-only data (only when there are no real projects)
    const isDemoOnly = !hasRealProjects && mainDemoProject !== undefined;
    
    const totalProjects = allProjects.length;
    // Check client approval based on materials validation status
    const clientApproved = allProjects.filter(p => checkProjectClientApproved(p)).length;
    const activeProjects = allProjects.filter(p => p.status === 'active').length;
    const completedProjects = allProjects.filter(p => p.status === 'completed').length;
    const readyProjects = allProjects.filter(p => p.status === 'ready').length;
    const draftProjects = allProjects.filter(p => p.status === 'draft').length;
    
    // Calculate completion percentage (completed / total, or 0 if no projects)
    const completionPercentage = totalProjects > 0 
      ? Math.round((completedProjects / totalProjects) * 100) 
      : 0;
    
    // Calculate projects with invoices sent
    const projectsWithInvoices = allProjects.filter(p => p.invoiceCount > 0).length;
    const totalInvoicesSent = allProjects.reduce((sum, p) => sum + (p.invoiceCount || 0), 0);
    
    // For now, we'll estimate costs based on project status and invoices
    // In the future, this should come from actual budget data stored in projects
    const estimatedTotalCost = allProjects.reduce((sum, p) => {
      // Estimate: approved projects have higher estimated cost
      if (p.devisStatus === 'approved') return sum + 50000; // €50k estimate
      if (p.status === 'ready') return sum + 40000; // €40k estimate
      if (p.status === 'active') return sum + 45000; // €45k estimate
      return sum + 30000; // €30k for draft projects
    }, 0);
    
    const estimatedPaid = totalInvoicesSent * 15000; // Estimate €15k per invoice
    const estimatedRemaining = estimatedTotalCost - estimatedPaid;
    const averageProjectCost = totalProjects > 0 ? estimatedTotalCost / totalProjects : 0;
    
    return {
      totalProjects,
      clientApproved,
      activeProjects,
      completedProjects,
      readyProjects,
      draftProjects,
      completionPercentage,
      projectsWithInvoices,
      totalInvoicesSent,
      estimatedTotalCost,
      estimatedPaid,
      estimatedRemaining,
      averageProjectCost,
      isDemoOnly, // Flag to indicate if metrics are demo-only
    };
  }, [regularProjects, materialsData]);

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('globalDashboardTitle')}</h2>
          <p>{t('globalDashboardSubtitle')}</p>
        </div>
        <div className="status-legend-inline" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label className="show-hidden-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280' }}>
            <input
              type="checkbox"
              checked={showHiddenProjects}
              onChange={(e) => setShowHiddenProjects(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <span>{t('showHiddenProjects') || 'Show Hidden Projects'}</span>
          </label>
          <button
            type="button"
            className="status-legend-toggle"
            onClick={() => setLegendExpanded(!legendExpanded)}
          >
            <span className="status-legend-label">{t('projectStatusLegend')}</span>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ transform: legendExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {legendExpanded && (
            <div className="status-legend-dropdown">
              <div className="status-legend-items">
                <div className="status-legend-item">
                  <span className="project-card-status project-card-status-gray">{t('projectStatusDraft')}</span>
                  <span className="status-legend-desc">{t('projectStatusDraftDesc')}</span>
                </div>
                <div className="status-legend-item">
                  <span className="project-card-status project-card-status-blue">{t('projectStatusReady')}</span>
                  <span className="status-legend-desc">{t('projectStatusReadyDesc')}</span>
                </div>
                <div className="status-legend-item">
                  <span className="project-card-status project-card-status-green">{t('projectStatusActive')}</span>
                  <span className="status-legend-desc">{t('projectStatusActiveDesc')}</span>
                </div>
                <div className="status-legend-item">
                  <span className="project-card-status project-card-status-purple">{t('projectStatusCompleted')}</span>
                  <span className="status-legend-desc">{t('projectStatusCompletedDesc')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Projects Metrics Section */}
      {regularProjects.length > 0 && (
        <section className="projects-metrics">
          {projectMetrics.isDemoOnly && (
            <h3 className="metrics-title-demo">{t('demoOnlyMetrics')}</h3>
          )}
          <div className="metrics-grid">
            <div className="metric-card">
              <h3 className="metric-label">{t('totalProjects')}</h3>
              <div className="metric-value">{projectMetrics.totalProjects}</div>
            </div>
            <div className="metric-card">
              <h3 className="metric-label">{t('clientApproved')}</h3>
              <div className="metric-value">{projectMetrics.clientApproved}</div>
              <span className="metric-subtitle">{t('devisApprovedProjects')}</span>
            </div>
            <div className="metric-card">
              <h3 className="metric-label">{t('completionRate')}</h3>
              <div className="metric-value">{projectMetrics.completionPercentage}%</div>
              <span className="metric-subtitle">{projectMetrics.completedProjects} {t('completed')}</span>
            </div>
            <div className="metric-card">
              <h3 className="metric-label">{t('activeProjects')}</h3>
              <div className="metric-value">{projectMetrics.activeProjects}</div>
              <span className="metric-subtitle">{t('inProgress')}</span>
            </div>
            <div className="metric-card">
              <h3 className="metric-label">{t('totalInvoices')}</h3>
              <div className="metric-value">{projectMetrics.totalInvoicesSent}</div>
              <span className="metric-subtitle">{t('invoicesSent')}</span>
            </div>
            <div className="metric-card metric-card-financial">
              <h3 className="metric-label">{t('avgProjectCost')}</h3>
              <div className="metric-value">{formatCurrency(projectMetrics.averageProjectCost)}</div>
              <span className="metric-subtitle">{t('perProject')}</span>
            </div>
          </div>
        </section>
      )}

      {/* Regular Projects */}
      <div className="projects-grid">
        {regularProjects.map((project) => (
          <ProjectCard key={project.id} project={project} onClick={handleProjectClick} />
        ))}
        <ProjectCard isNewProject={true} />
      </div>

      {/* Only show empty state if there are no user-created projects (excluding demo) */}
      {regularProjects.length === 0 && (
        <div className="empty-projects-state">
          <p>{t('noProjectsYet')}</p>
          <p className="empty-state-subtitle">{t('createFirstProject')}</p>
          {demoProjects.length > 0 && (
            <p className="empty-state-hint">{t('notSureWhereToStart')}</p>
          )}
        </div>
      )}

      {/* Demo Projects Section */}
      {demoProjects.length > 0 && (
        <div className="demo-projects-section">
          <button
            type="button"
            className="demo-projects-toggle"
            onClick={() => setDemoExpanded(!demoExpanded)}
          >
            <span className="demo-projects-label">
              {t('moreDemoProjects')} ({demoProjects.length})
            </span>
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ transform: demoExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {demoExpanded && (
            <div className="projects-grid demo-projects-grid">
              {demoProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onClick={handleProjectClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default GlobalDashboard;

