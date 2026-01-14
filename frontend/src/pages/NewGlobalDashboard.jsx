import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { useWorkers } from '../contexts/WorkersContext.jsx';
import { formatCurrency } from '../hooks/useMaterialsData.js';
import CreateProjectModal from '../components/CreateProjectModal.jsx';

function NewGlobalDashboard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { projects, selectProject } = useProjects();
  const { workers } = useWorkers();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [timelineView, setTimelineView] = useState('month'); // 'month', 'year', or 'max'

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(p => 
      (p.name || '').toLowerCase().includes(query) ||
      (p.address || '').toLowerCase().includes(query) ||
      (p.clientName || '').toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Group projects by status/devis status
  const projectsByStatus = useMemo(() => {
    const grouped = {
      'devis-to-make': [], // draft projects
      'devis-sent': [], // ready projects with devis sent
      'devis-signed': [], // active projects with devis approved
      'in-progress': [], // active projects
      'lost': [] // completed/archived
    };

    filteredProjects.forEach(project => {
      if (project.status === 'draft') {
        grouped['devis-to-make'].push(project);
      } else if (project.status === 'ready' && project.devisStatus === 'sent') {
        grouped['devis-sent'].push(project);
      } else if (project.devisStatus === 'approved' && project.status !== 'active') {
        grouped['devis-signed'].push(project);
      } else if (project.status === 'active') {
        grouped['in-progress'].push(project);
      } else if (project.status === 'completed' || project.status === 'archived') {
        grouped['lost'].push(project);
      }
    });

    return grouped;
  }, [filteredProjects]);

  // Calculate totals for each status column
  const statusTotals = useMemo(() => {
    return {
      'devis-to-make': projectsByStatus['devis-to-make'].reduce((sum, p) => sum + (p.budget || 50000), 0),
      'devis-sent': projectsByStatus['devis-sent'].reduce((sum, p) => sum + (p.budget || 50000), 0),
      'devis-signed': projectsByStatus['devis-signed'].reduce((sum, p) => sum + (p.budget || 50000), 0),
      'in-progress': projectsByStatus['in-progress'].reduce((sum, p) => sum + (p.budget || 50000), 0),
      'lost': projectsByStatus['lost'].reduce((sum, p) => sum + (p.budget || 50000), 0),
    };
  }, [projectsByStatus]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const plannedProjects = projects.filter(p => p.status === 'ready' || p.status === 'draft').length;
    const activeTeams = workers?.filter(w => w.jobs && w.jobs.length > 0).length || 0;
    
    const totalBudget = projects.reduce((sum, p) => {
      return sum + (p.budget || (p.devisStatus === 'approved' ? 50000 : p.status === 'ready' ? 40000 : p.status === 'active' ? 45000 : 30000));
    }, 0);

    return {
      totalProjects,
      totalBudget,
      activeProjects,
      plannedProjects,
      activeTeams
    };
  }, [projects, workers]);

  // Get project dates for timeline
  const getProjectDates = (project) => {
    const start = project.startDate 
      ? new Date(project.startDate)
      : (project.createdAt ? new Date(project.createdAt) : new Date());
    
    const end = project.endDate 
      ? new Date(project.endDate)
      : new Date(start.getFullYear(), start.getMonth() + 6, start.getDate());
    
    return { start, end };
  };

  // Calculate project progress percentage
  const getProjectProgress = (project) => {
    if (project.percentagePaid !== undefined) {
      return project.percentagePaid;
    }
    if (project.status === 'completed') return 100;
    if (project.status === 'active') return 50;
    if (project.status === 'ready') return 30;
    return 0;
  };

  // Generate timeline columns based on view mode
  const timelineColumns = useMemo(() => {
    if (timelineView === 'max') {
      // Generate months for 3 years (36 months) centered around current date
      const startYear = currentMonth.getFullYear() - 1;
      const months = [];
      for (let yearOffset = -1; yearOffset <= 1; yearOffset++) {
        const year = startYear + yearOffset;
        for (let month = 0; month < 12; month++) {
          months.push(new Date(year, month, 1));
        }
      }
      return months;
    } else if (timelineView === 'year') {
      // Generate 12 months for the year
      const year = currentMonth.getFullYear();
      const months = [];
      for (let i = 0; i < 12; i++) {
        months.push(new Date(year, i, 1));
      }
      return months;
    } else {
      // Generate days for current month
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days = [];
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
      }
      return days;
    }
  }, [currentMonth, timelineView]);

  // Filter projects visible in current view
  const visibleProjects = useMemo(() => {
    return projects.filter(project => {
      const { start, end } = getProjectDates(project);
      if (timelineView === 'max') {
        // Show all projects in the 3-year range
        const rangeStart = new Date(currentMonth.getFullYear() - 1, 0, 1);
        const rangeEnd = new Date(currentMonth.getFullYear() + 1, 11, 31);
        return start <= rangeEnd && end >= rangeStart;
      } else if (timelineView === 'year') {
        const yearStart = new Date(currentMonth.getFullYear(), 0, 1);
        const yearEnd = new Date(currentMonth.getFullYear(), 11, 31);
        return start <= yearEnd && end >= yearStart;
      } else {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        return start <= monthEnd && end >= monthStart;
      }
    });
  }, [projects, currentMonth, timelineView]);

  // Filter workers visible in current view
  const visibleWorkers = useMemo(() => {
    if (!workers || workers.length === 0) return [];
    return workers.filter(worker => {
      if (!worker.jobs || worker.jobs.length === 0) return false;
      if (timelineView === 'max') {
        const rangeStart = new Date(currentMonth.getFullYear() - 1, 0, 1);
        const rangeEnd = new Date(currentMonth.getFullYear() + 1, 11, 31);
        return worker.jobs.some(job => {
          const jobStart = new Date(job.startDate);
          const jobEnd = new Date(job.endDate);
          return jobStart <= rangeEnd && jobEnd >= rangeStart;
        });
      } else if (timelineView === 'year') {
        const yearStart = new Date(currentMonth.getFullYear(), 0, 1);
        const yearEnd = new Date(currentMonth.getFullYear(), 11, 31);
        return worker.jobs.some(job => {
          const jobStart = new Date(job.startDate);
          const jobEnd = new Date(job.endDate);
          return jobStart <= yearEnd && jobEnd >= yearStart;
        });
      } else {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        return worker.jobs.some(job => {
          const jobStart = new Date(job.startDate);
          const jobEnd = new Date(job.endDate);
          return jobStart <= monthEnd && jobEnd >= monthStart;
        });
      }
    });
  }, [workers, currentMonth, timelineView]);

  // Navigate to previous/next period
  const navigatePeriod = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (timelineView === 'year') {
        newDate.setFullYear(prev.getFullYear() + direction);
      } else {
        newDate.setMonth(prev.getMonth() + direction);
      }
      return newDate;
    });
  };

  // Calculate column span for timeline bars
  const getTimelineSpan = (startDate, endDate) => {
    if (timelineView === 'max') {
      // Find which months in the 3-year range the project spans
      const rangeStart = new Date(currentMonth.getFullYear() - 1, 0, 1);
      const rangeEnd = new Date(currentMonth.getFullYear() + 1, 11, 31);
      
      const start = new Date(Math.max(startDate, rangeStart));
      const end = new Date(Math.min(endDate, rangeEnd));
      
      // Calculate which column indices these dates fall into
      let startCol = -1;
      let endCol = -1;
      
      timelineColumns.forEach((colDate, idx) => {
        const colYear = colDate.getFullYear();
        const colMonth = colDate.getMonth();
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();
        
        if (startCol === -1 && colYear === startYear && colMonth === startMonth) {
          startCol = idx;
        }
        if (colYear === endYear && colMonth === endMonth) {
          endCol = idx;
        }
      });
      
      if (startCol === -1 || endCol === -1) {
        return { startCol: 0, endCol: 0, colspan: 1 };
      }
      
      return {
        startCol,
        endCol,
        colspan: endCol - startCol + 1
      };
    } else if (timelineView === 'year') {
      const yearStart = new Date(currentMonth.getFullYear(), 0, 1);
      const yearEnd = new Date(currentMonth.getFullYear(), 11, 31);
      
      const start = new Date(Math.max(startDate, yearStart));
      const end = new Date(Math.min(endDate, yearEnd));
      
      const startMonth = start.getMonth();
      const endMonth = end.getMonth();
      
      return {
        startCol: startMonth,
        endCol: endMonth,
        colspan: endMonth - startMonth + 1
      };
    } else {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const start = new Date(Math.max(startDate, monthStart));
      const end = new Date(Math.min(endDate, monthEnd));
      
      const startDay = Math.max(1, start.getDate());
      const endDay = Math.min(timelineColumns.length, end.getDate());
      
      return {
        startCol: startDay - 1,
        endCol: endDay - 1,
        colspan: endDay - startDay + 1
      };
    }
  };

  const handleProjectClick = (projectId) => {
    selectProject(projectId);
    navigate('/dashboard');
  };

  const periodLabel = timelineView === 'max'
    ? `${currentMonth.getFullYear() - 1} - ${currentMonth.getFullYear() + 1}`
    : timelineView === 'year' 
      ? currentMonth.getFullYear().toString()
      : currentMonth.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
          month: 'long', 
          year: 'numeric' 
        });

  const statusConfig = {
    'devis-to-make': { label: t('devisToMake'), color: '#f59e0b', bgColor: '#fef3c7' }, // Yellow
    'devis-sent': { label: t('devisSent'), color: '#ef4444', bgColor: '#fee2e2' }, // Red
    'devis-signed': { label: t('devisSigned'), color: '#10b981', bgColor: '#d1fae5' }, // Green
    'in-progress': { label: t('chantierInProgress'), color: '#10b981', bgColor: '#d1fae5' }, // Green
    'lost': { label: t('lost'), color: '#6b7280', bgColor: '#f3f4f6' } // Gray
  };

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('dashboardTitle')}</h2>
          <p>{t('dashboardSubtitle')}</p>
        </div>
      </header>

      {/* Summary Cards Section */}
      <section className="dashboard-summary">
        <div className="summary-card">
          <div className="summary-card-content">
            <h3 className="summary-card-label">{t('activeProjects')}</h3>
            <div className="summary-card-main">
              <span className="summary-card-value-large">{summaryMetrics.activeProjects}</span>
              <span className="summary-card-suffix">{t('active')} / {summaryMetrics.totalProjects} {t('total')}</span>
            </div>
          </div>
          <div className="summary-card-icon">🏗️</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <h3 className="summary-card-label">{t('totalBudget')}</h3>
            <div className="summary-card-main">
              <span className="summary-card-value-large">{formatCurrency(summaryMetrics.totalBudget)}</span>
              <span className="summary-card-suffix">{t('allProjects')}</span>
            </div>
          </div>
          <div className="summary-card-icon">📊</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <h3 className="summary-card-label">{t('planned')}</h3>
            <div className="summary-card-main">
              <span className="summary-card-value-large">{summaryMetrics.plannedProjects}</span>
              <span className="summary-card-suffix">{t('toStart')}</span>
            </div>
          </div>
          <div className="summary-card-icon">📅</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <h3 className="summary-card-label">{t('teams')}</h3>
            <div className="summary-card-main">
              <span className="summary-card-value-large">{summaryMetrics.activeTeams}</span>
              <span className="summary-card-suffix">{t('active')}</span>
            </div>
          </div>
          <div className="summary-card-icon">👥</div>
        </div>
      </section>

      {/* Projects by Status Section */}
      <section className="projects-by-status">
        <div className="projects-by-status-header">
          <h3>{t('projectsByStatus')}</h3>
          <div className="search-container">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        <div className="projects-status-columns">
          {Object.entries(statusConfig).map(([statusKey, config]) => {
            const statusProjects = projectsByStatus[statusKey];
            const total = statusTotals[statusKey];
            
            return (
              <div key={statusKey} className="status-column" style={{ backgroundColor: config.bgColor }}>
                <div className="status-column-header">
                  <h4 className="status-column-title">{config.label}</h4>
                  <div className="status-column-total">{formatCurrency(total)}</div>
                </div>
                <div className="status-column-projects">
                  {statusProjects.length === 0 ? (
                    <div className="status-column-empty">{t('noProjects')}</div>
                  ) : (
                    statusProjects.map((project) => {
                      const progress = getProjectProgress(project);
                      const projectBudget = project.budget || 50000;
                      
                      return (
                        <div
                          key={project.id}
                          className="status-project-card"
                          onClick={() => handleProjectClick(project.id)}
                        >
                          <div className="status-project-header">
                            <div className="status-project-name">{project.name || project.address}</div>
                            <div className="status-project-progress-circle">
                              <svg width="28" height="28" viewBox="0 0 24 24">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  fill="none"
                                  stroke="#e5e7eb"
                                  strokeWidth="2"
                                />
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  fill="none"
                                  stroke={config.color}
                                  strokeWidth="2"
                                  strokeDasharray={`${2 * Math.PI * 10}`}
                                  strokeDashoffset={`${2 * Math.PI * 10 * (1 - progress / 100)}`}
                                  transform="rotate(-90 12 12)"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="status-project-progress-text">{progress}%</span>
                            </div>
                          </div>
                          <div className="status-project-value">{formatCurrency(projectBudget)}</div>
                          <div className="status-project-icons">
                            <span className="status-project-icon" title={t('documents')}>📄</span>
                            <span className="status-project-icon" title={t('calendar')}>📅</span>
                            {project.invoiceCount > 0 && (
                              <span className="status-project-badge">{project.invoiceCount}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Planning Timeline Section */}
      <section className="planning-timeline">
        <div className="timeline-header">
          <div className="timeline-header-left">
            <h3>{t('planningTimeline')}</h3>
            <div className="timeline-navigation">
              <button 
                type="button" 
                className="timeline-nav-btn"
                onClick={() => navigatePeriod(-1)}
              >
                ‹
              </button>
              <span className="timeline-month">{periodLabel}</span>
              <button 
                type="button" 
                className="timeline-nav-btn"
                onClick={() => navigatePeriod(1)}
              >
                ›
              </button>
            </div>
          </div>
          <div className="timeline-header-right">
            <div className="timeline-filters">
              <select className="timeline-filter-select">
                <option>{t('showAll')}</option>
              </select>
              <select 
                className="timeline-filter-select"
                value={timelineView}
                onChange={(e) => setTimelineView(e.target.value)}
              >
                <option value="month">{t('month')}</option>
                <option value="year">{t('year')}</option>
                <option value="max">{t('threeYears')}</option>
              </select>
              <button className="timeline-materials-btn">{t('materials')}</button>
            </div>
          </div>
        </div>

        <div className="timeline-container-new">
          <div className="timeline-table-new">
            {/* Header row */}
            <div 
              className="timeline-header-row"
              style={{ gridTemplateColumns: `150px repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
            >
              <div className="timeline-element-header">{t('element')}</div>
              {timelineColumns.map((date, idx) => (
                <div key={idx} className="timeline-day-header">
                  {timelineView === 'max' || timelineView === 'year'
                    ? date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' })
                    : date.getDate()
                  }
                </div>
              ))}
            </div>

            {/* Projects (Chantiers) */}
            <div className="timeline-section">
              <div className="timeline-section-label">{t('chantiers')}</div>
              {visibleProjects.slice(0, 3).map((project) => {
                const { start, end } = getProjectDates(project);
                const span = getTimelineSpan(start, end);
                const progress = getProjectProgress(project);
                const isCompleted = project.status === 'completed';
                const projectName = project.name || project.address;
                
                return (
                  <div key={project.id} className="timeline-row">
                    <div className="timeline-label">
                      <div className="timeline-label-main">
                        <span className="timeline-label-text">{projectName}</span>
                        <span className="timeline-progress-badge">{progress}%</span>
                      </div>
                    </div>
                    <div 
                      className="timeline-bars-container"
                      style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
                    >
                      {timelineColumns.map((date, idx) => {
                        if (idx < span.startCol || idx > span.endCol) {
                          return <div key={idx} className="timeline-cell-empty"></div>;
                        }
                        if (idx === span.startCol) {
                          return (
                            <div 
                              key={idx} 
                              className={`timeline-bar timeline-bar-project ${isCompleted ? 'completed' : 'in-progress'}`}
                              style={{ gridColumn: `span ${span.colspan}` }}
                            >
                              <span className="timeline-bar-label">{projectName}</span>
                              <span className="timeline-bar-icons">
                                <span className="timeline-bar-icon">🛒</span>
                                <span className="timeline-bar-icon">🏗️</span>
                                <span className="timeline-bar-icon">👤</span>
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Teams (Équipes) */}
            <div className="timeline-section">
              <div className="timeline-section-label">{t('teams')}</div>
              {visibleWorkers.slice(0, 4).map((worker) => {
                return worker.jobs.slice(0, 1).map((job, jobIdx) => {
                  const jobStart = new Date(job.startDate);
                  const jobEnd = new Date(job.endDate);
                  const span = getTimelineSpan(jobStart, jobEnd);
                  const workerType = worker.type || t('employee');
                  
                  return (
                    <div key={`${worker.id}-${jobIdx}`} className="timeline-row">
                      <div className="timeline-label">
                        <div className="timeline-label-main">
                          <span className="timeline-label-text">{worker.name}</span>
                        </div>
                        <div className="timeline-label-sub">
                          <span className="timeline-worker-type">{workerType}</span>
                        </div>
                      </div>
                      <div 
                        className="timeline-bars-container"
                        style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
                      >
                        {timelineColumns.map((date, idx) => {
                          if (idx < span.startCol || idx > span.endCol) {
                            return <div key={idx} className="timeline-cell-empty"></div>;
                          }
                          if (idx === span.startCol) {
                            return (
                              <div 
                                key={idx} 
                                className="timeline-bar timeline-bar-team"
                                style={{ gridColumn: `span ${span.colspan}` }}
                              >
                                {job.chantierName || 'Project'}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                });
              })}
            </div>

            {/* Tasks (Tâches) */}
            <div className="timeline-section">
              <div className="timeline-section-label">{t('tasks')}</div>
              
              {/* Inspection électrique */}
              <div className="timeline-row">
                <div className="timeline-label">
                  <div className="timeline-label-main">
                    <span className="timeline-label-text">{t('inspectionElectrique')}</span>
                  </div>
                  <div className="timeline-label-sub">
                    <span className="timeline-task-project">{visibleProjects[0]?.name || 'Villa Dupont'}</span>
                  </div>
                </div>
                <div 
                  className="timeline-bars-container"
                  style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
                >
                  {timelineColumns.map((date, idx) => {
                    if (timelineView === 'max' || timelineView === 'year') {
                      if (idx === 2) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-high"
                            style={{ gridColumn: 'span 1' }}
                          >
                            {t('inspectionElectrique')}
                          </div>
                        );
                      }
                    } else {
                      // In month view, show task around day 15-18
                      if (idx === 14) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-high"
                            style={{ gridColumn: 'span 4' }}
                          >
                            {t('inspectionElectrique')}
                          </div>
                        );
                      }
                    }
                    return <div key={idx} className="timeline-cell-empty"></div>;
                  })}
                </div>
              </div>

              {/* Livraison matériaux */}
              <div className="timeline-row">
                <div className="timeline-label">
                  <div className="timeline-label-main">
                    <span className="timeline-label-text">{t('materialDelivery')}</span>
                  </div>
                  <div className="timeline-label-sub">
                    <span className="timeline-task-project">{visibleProjects[1]?.name || 'Immeuble Résidence Soleil'}</span>
                  </div>
                </div>
                <div 
                  className="timeline-bars-container"
                  style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
                >
                  {timelineColumns.map((date, idx) => {
                    if (timelineView === 'max' || timelineView === 'year') {
                      if (idx === 2) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-high"
                            style={{ gridColumn: 'span 1' }}
                          >
                            {t('materialDelivery')}
                          </div>
                        );
                      }
                    } else {
                      // In month view, show task around day 18-21
                      if (idx === 17) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-high"
                            style={{ gridColumn: 'span 4' }}
                          >
                            {t('materialDelivery')}
                          </div>
                        );
                      }
                    }
                    return <div key={idx} className="timeline-cell-empty"></div>;
                  })}
                </div>
              </div>

              {/* Peinture façade */}
              <div className="timeline-row">
                <div className="timeline-label">
                  <div className="timeline-label-main">
                    <span className="timeline-label-text">{t('facadePainting')}</span>
                  </div>
                  <div className="timeline-label-sub">
                    <span className="timeline-task-project">{visibleProjects[0]?.name || 'Villa Dupont'}</span>
                  </div>
                </div>
                <div 
                  className="timeline-bars-container"
                  style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
                >
                  {timelineColumns.map((date, idx) => {
                    if (timelineView === 'max' || timelineView === 'year') {
                      if (idx === 2) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-medium"
                            style={{ gridColumn: 'span 1' }}
                          >
                            {t('facadePainting')}
                          </div>
                        );
                      }
                    } else {
                      // In month view, show task around day 21-24
                      if (idx === 20) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-medium"
                            style={{ gridColumn: 'span 4' }}
                          >
                            {t('facadePainting')}
                          </div>
                        );
                      }
                    }
                    return <div key={idx} className="timeline-cell-empty"></div>;
                  })}
                </div>
              </div>

              {/* Installation cuisine */}
              <div className="timeline-row">
                <div className="timeline-label">
                  <div className="timeline-label-main">
                    <span className="timeline-label-text">{t('kitchenInstallation')}</span>
                  </div>
                  <div className="timeline-label-sub">
                    <span className="timeline-task-project">{visibleProjects[2]?.name || 'Construction Villa Bernard'}</span>
                  </div>
                </div>
                <div 
                  className="timeline-bars-container"
                  style={{ gridTemplateColumns: `repeat(${timelineColumns.length}, minmax(${timelineView === 'max' ? '50px' : timelineView === 'year' ? '60px' : '30px'}, 1fr))` }}
                >
                  {timelineColumns.map((date, idx) => {
                    if (timelineView === 'max' || timelineView === 'year') {
                      if (idx === 2) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-medium"
                            style={{ gridColumn: 'span 1' }}
                          >
                            {t('kitchenInstallation')}
                          </div>
                        );
                      }
                    } else {
                      // In month view, show task around day 12-15
                      if (idx === 11) {
                        return (
                          <div 
                            key={idx} 
                            className="timeline-bar timeline-bar-task timeline-bar-task-medium"
                            style={{ gridColumn: 'span 4' }}
                          >
                            {t('kitchenInstallation')}
                          </div>
                        );
                      }
                    }
                    return <div key={idx} className="timeline-cell-empty"></div>;
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Timeline Legend */}
          <div className="timeline-legend">
            <div className="timeline-legend-section">
              <div className="timeline-legend-title">{t('chantiers')}:</div>
              <div className="timeline-legend-item">
                <div className="timeline-legend-color timeline-legend-blue"></div>
                <span>{t('inProgress')}</span>
              </div>
              <div className="timeline-legend-item">
                <div className="timeline-legend-color timeline-legend-orange"></div>
                <span>{t('endOfConstruction')}</span>
              </div>
            </div>
            <div className="timeline-legend-section">
              <div className="timeline-legend-title">{t('materials')}:</div>
              <div className="timeline-legend-item">
                <span className="timeline-legend-icon">🚚</span>
                <span>{t('delivery')}</span>
              </div>
              <div className="timeline-legend-item">
                <span className="timeline-legend-icon">🛒</span>
                <span>{t('order')}</span>
              </div>
            </div>
            <div className="timeline-legend-section">
              <div className="timeline-legend-title">{t('teams')}:</div>
              <div className="timeline-legend-item">
                <div className="timeline-legend-color timeline-legend-green"></div>
                <span>{t('assignment')}</span>
              </div>
            </div>
            <div className="timeline-legend-section">
              <div className="timeline-legend-title">{t('tasks')}:</div>
              <div className="timeline-legend-item">
                <div className="timeline-legend-color timeline-legend-red"></div>
                <span>{t('highPriority')}</span>
              </div>
              <div className="timeline-legend-item">
                <div className="timeline-legend-color timeline-legend-orange"></div>
                <span>{t('mediumPriority')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)} 
        />
      )}
    </>
  );
}

export default NewGlobalDashboard;
