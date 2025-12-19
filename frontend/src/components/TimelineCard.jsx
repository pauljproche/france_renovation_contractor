import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';

function TimelineCard() {
  const { selectedProject } = useProjects();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const timelineData = useMemo(() => {
    if (!selectedProject) {
      return null;
    }

    const startDate = selectedProject.startDate 
      ? new Date(selectedProject.startDate)
      : (selectedProject.createdAt ? new Date(selectedProject.createdAt) : null);
    
    const endDate = selectedProject.endDate 
      ? new Date(selectedProject.endDate)
      : null;

    if (!startDate) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate duration in days
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    let duration = null;
    let daysElapsed = null;
    let daysRemaining = null;
    let progressPercentage = null;
    let isCompleted = selectedProject.status === 'completed';
    let isUpcoming = false;

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      if (today < start) {
        isUpcoming = true;
        daysRemaining = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
      } else if (today > end) {
        daysElapsed = duration;
        progressPercentage = 100;
      } else {
        daysElapsed = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
        daysRemaining = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        progressPercentage = Math.round((daysElapsed / duration) * 100);
      }
    } else {
      // No end date - calculate from start to today
      if (today >= start) {
        daysElapsed = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
      } else {
        isUpcoming = true;
        daysRemaining = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      startDate,
      endDate,
      duration,
      daysElapsed,
      daysRemaining,
      progressPercentage,
      isCompleted,
      isUpcoming,
    };
  }, [selectedProject]);

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = () => {
    if (timelineData?.isCompleted) return '#10b981'; // green
    if (timelineData?.isUpcoming) return '#3b82f6'; // blue
    return '#f59e0b'; // amber (in progress)
  };

  const getStatusLabel = () => {
    if (timelineData?.isCompleted) return t('completed') || 'Completed';
    if (timelineData?.isUpcoming) return t('upcoming') || 'Upcoming';
    return t('inProgress') || 'In Progress';
  };

  if (!selectedProject) {
    return null;
  }

  if (!timelineData) {
    return (
      <div className="panel">
        <h2>{t('projectTimeline') || 'Project Timeline'}</h2>
        <div style={{ 
          padding: '24px', 
          textAlign: 'center', 
          color: '#6b7280',
          fontSize: '0.9rem'
        }}>
          {t('noTimelineData') || 'No timeline information available for this project'}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{t('projectTimeline') || 'Project Timeline'}</h2>
        <button
          onClick={() => navigate('/timeline')}
          style={{
            padding: '6px 12px',
            fontSize: '0.85rem',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#374151',
            fontWeight: 500,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e5e7eb';
            e.currentTarget.style.borderColor = '#9ca3af';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
        >
          {t('viewFullTimeline') || 'View Full Timeline →'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: getStatusColor(),
              flexShrink: 0,
            }}
          />
          <span style={{ 
            fontSize: '0.9rem', 
            fontWeight: 600,
            color: '#111827'
          }}>
            {getStatusLabel()}
          </span>
        </div>

        {/* Timeline Dates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#6b7280',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {t('startDate') || 'Start Date'}
              </div>
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: 600,
                color: '#111827'
              }}>
                {formatDate(timelineData.startDate)}
              </div>
            </div>
            {timelineData.endDate && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#6b7280',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {t('endDate') || 'End Date'}
                </div>
                <div style={{ 
                  fontSize: '1rem', 
                  fontWeight: 600,
                  color: '#111827'
                }}>
                  {formatDate(timelineData.endDate)}
                </div>
              </div>
            )}
          </div>

          {/* Duration and Progress */}
          {timelineData.duration && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#6b7280',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {t('duration') || 'Duration'}
                </div>
                <div style={{ 
                  fontSize: '1rem', 
                  fontWeight: 600,
                  color: '#111827'
                }}>
                  {timelineData.duration} {timelineData.duration === 1 ? (t('day') || 'day') : (t('days') || 'days')}
                </div>
              </div>
              {timelineData.daysElapsed !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {t('elapsed') || 'Elapsed'}
                  </div>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 600,
                    color: '#111827'
                  }}>
                    {timelineData.daysElapsed} {timelineData.daysElapsed === 1 ? (t('day') || 'day') : (t('days') || 'days')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {timelineData.progressPercentage !== null && (
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ 
                  fontSize: '0.85rem', 
                  color: '#6b7280',
                  fontWeight: 500
                }}>
                  {t('progress') || 'Progress'}
                </span>
                <span style={{ 
                  fontSize: '0.85rem', 
                  color: '#111827',
                  fontWeight: 600
                }}>
                  {timelineData.progressPercentage}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    width: `${timelineData.progressPercentage}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${getStatusColor()} 0%, ${getStatusColor()}dd 100%)`,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              {timelineData.daysRemaining !== null && timelineData.daysRemaining > 0 && (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#6b7280',
                  marginTop: '6px'
                }}>
                  {timelineData.daysRemaining} {timelineData.daysRemaining === 1 ? (t('dayRemaining') || 'day remaining') : (t('daysRemaining') || 'days remaining')}
                </div>
              )}
            </div>
          )}

          {/* Upcoming Project */}
          {timelineData.isUpcoming && timelineData.daysRemaining !== null && (
            <div style={{ 
              padding: '12px',
              background: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '0.9rem'
            }}>
              {t('projectStartsIn')?.replace('{days}', timelineData.daysRemaining.toString()) || 
               `Project starts in ${timelineData.daysRemaining} ${timelineData.daysRemaining === 1 ? 'day' : 'days'}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TimelineCard;


