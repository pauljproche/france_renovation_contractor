import { useMemo } from 'react';
import { useWorkers } from '../contexts/WorkersContext.jsx';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';

function WorkersCard() {
  const { workers } = useWorkers();
  const { selectedProject } = useProjects();
  const { t } = useTranslation();

  // Find workers assigned to the current project
  const projectWorkers = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    // Match workers by project address/name (chantierName in jobs)
    const projectName = selectedProject.address || selectedProject.name || '';
    
    if (!projectName) {
      return [];
    }

    const assignedWorkers = [];
    
    workers.forEach(worker => {
      const relevantJobs = (worker.jobs || []).filter(job => {
        // Match by chantier name (case-insensitive, flexible matching)
        const jobChantier = (job.chantierName || '').toUpperCase().trim();
        const projectNameUpper = projectName.toUpperCase().trim();
        
        // Exact match
        if (jobChantier === projectNameUpper) {
          return true;
        }
        
        // Remove common prefixes/suffixes and match
        const normalizedJob = jobChantier.replace(/^(RUE|AV|BD|PLACE|IMPASSE|CHEMIN|ROUTE)\s+/i, '').trim();
        const normalizedProject = projectNameUpper.replace(/^(RUE|AV|BD|PLACE|IMPASSE|CHEMIN|ROUTE)\s+/i, '').trim();
        
        if (normalizedJob === normalizedProject) {
          return true;
        }
        
        // Partial match (if one contains the other)
        if (jobChantier && projectNameUpper) {
          return jobChantier.includes(projectNameUpper) || 
                 projectNameUpper.includes(jobChantier) ||
                 normalizedJob.includes(normalizedProject) ||
                 normalizedProject.includes(normalizedJob);
        }
        
        return false;
      });

      if (relevantJobs.length > 0) {
        // Get current/upcoming jobs for this project
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day
        
        const currentJobs = relevantJobs.filter(job => {
          if (!job.startDate) return false;
          const startDate = new Date(job.startDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = job.endDate ? new Date(job.endDate) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          endDate.setHours(23, 59, 59, 999);
          
          // Include jobs that are current, upcoming (within next 90 days), or recently completed (within last 30 days)
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          
          return (endDate >= thirtyDaysAgo && startDate <= ninetyDaysFromNow);
        });

        // Show worker if they have any relevant jobs (current or recent)
        if (currentJobs.length > 0) {
          // Sort jobs by start date (most recent first)
          currentJobs.sort((a, b) => {
            const dateA = new Date(a.startDate);
            const dateB = new Date(b.startDate);
            return dateB - dateA; // Descending order
          });

          assignedWorkers.push({
            worker,
            jobs: currentJobs,
            totalJobs: relevantJobs.length,
          });
        }
      }
    });

    return assignedWorkers.sort((a, b) => a.worker.name.localeCompare(b.worker.name));
  }, [workers, selectedProject]);

  if (!selectedProject) {
    return null;
  }

  if (projectWorkers.length === 0) {
    return (
      <div className="panel">
        <h2>{t('projectWorkers') || 'Project Workers'}</h2>
        <div style={{ 
          padding: '24px', 
          textAlign: 'center', 
          color: '#6b7280',
          fontSize: '0.9rem'
        }}>
          {t('noWorkersAssigned') || 'No workers currently assigned to this project'}
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getJobTypeLabel = (jobType) => {
    const labels = {
      plumbing: t('jobTypePlumbing') || 'Plumbing',
      electrical: t('jobTypeElectrical') || 'Electrical',
      demo: t('jobTypeDemo') || 'Demolition',
    };
    return labels[jobType] || jobType || t('jobTypeGeneral') || 'General';
  };

  const getJobTypeColor = (jobType) => {
    const colors = {
      plumbing: '#3b82f6', // blue
      electrical: '#f59e0b', // amber
      demo: '#ef4444', // red
    };
    return colors[jobType] || '#6b7280'; // gray
  };

  return (
    <div className="panel">
      <h2>{t('projectWorkers') || 'Project Workers'}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {projectWorkers.map(({ worker, jobs, totalJobs }) => (
          <div 
            key={worker.id}
            className="worker-card-item"
            style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1rem', 
                  fontWeight: 600, 
                  color: '#111827',
                  marginBottom: '4px'
                }}>
                  {worker.name}
                </h3>
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{jobs.length} {jobs.length === 1 ? (t('activeJob') || 'active job') : (t('activeJobs') || 'active jobs')}</span>
                  {totalJobs > jobs.length && (
                    <span style={{ color: '#9ca3af' }}>
                      · {totalJobs - jobs.length} {t('completed') || 'completed'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {jobs.map((job) => (
                <div 
                  key={job.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#fff',
                    borderRadius: '8px',
                    border: `1px solid ${getJobTypeColor(job.jobType)}20`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span 
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getJobTypeColor(job.jobType),
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: '0.9rem',
                        color: '#111827'
                      }}>
                        {getJobTypeLabel(job.jobType)}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: '#6b7280',
                      marginLeft: '16px'
                    }}>
                      {formatDate(job.startDate)} → {formatDate(job.endDate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkersCard;

