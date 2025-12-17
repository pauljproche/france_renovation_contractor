import { useState, useMemo, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useWorkers } from '../contexts/WorkersContext.jsx';

const ZOOM_MODES = {
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
};

function Workers() {
  const { t } = useTranslation();
  const { workers, updateJob, updateWorker, addWorker, deleteWorker } = useWorkers();
  const [zoomMode, setZoomMode] = useState(ZOOM_MODES.MONTH);
  const tableWrapperRef = useRef(null);
  const [editingJob, setEditingJob] = useState(null);
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editingWorker, setEditingWorker] = useState(null);
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [workerFormData, setWorkerFormData] = useState({ name: '', email: '', phone: '' });
  
  // Column width constant for easier adjustment - increased for better spacing
  const getColumnWidth = () => {
    switch (zoomMode) {
      case ZOOM_MODES.WEEK:
        return 180; // Increased from 125 for better spacing
      case ZOOM_MODES.MONTH:
        return 250; // Increased from 200 for better spacing
      case ZOOM_MODES.QUARTER:
        return 220; // Increased from 180
      case ZOOM_MODES.YEAR:
        return 220; // Increased from 180
      default:
        return 250;
    }
  };
  const COLUMN_WIDTH = getColumnWidth();

  // Date utility: Parse date strings to Date objects
  const toDate = (dateInput) => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
      return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
    }
    if (typeof dateInput === 'string') {
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      const d = new Date(dateInput);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const d = new Date(dateInput);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Get job start and end dates
  const getJobDates = (job) => {
    const start = job.startDate ? toDate(job.startDate) : new Date();
    const end = job.endDate ? toDate(job.endDate) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    
    return {
      start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
      end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
    };
  };

  // Get all jobs from all workers to calculate timeline range
  const allJobs = useMemo(() => {
    const jobs = [];
    workers.forEach(worker => {
      if (worker.jobs && worker.jobs.length > 0) {
        worker.jobs.forEach(job => {
          jobs.push({ ...job, workerId: worker.id, workerName: worker.name });
        });
      }
    });
    return jobs;
  }, [workers]);

  // Calculate timeline range (from first job start to last job end)
  const timelineRange = useMemo(() => {
    const today = new Date(2025, 11, 17); // Dec 17, 2025
    
    if (allJobs.length === 0) {
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
        end: new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()),
      };
    }

    let minStart = null;
    let maxEnd = null;

    allJobs.forEach(job => {
      const { start, end } = getJobDates(job);
      if (!minStart || start < minStart) minStart = new Date(start);
      if (!maxEnd || end > maxEnd) maxEnd = new Date(end);
    });

    // Ensure today is included in the range
    if (today < minStart) minStart = new Date(today);
    if (today > maxEnd) maxEnd = new Date(today);

    return {
      start: new Date(minStart.getFullYear(), minStart.getMonth(), minStart.getDate()),
      end: new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate()),
    };
  }, [allJobs]);

  // Generate time columns based on zoom mode (same logic as Timeline)
  const timeColumns = useMemo(() => {
    if (!timelineRange.start || !timelineRange.end) {
      return [];
    }

    const columns = [];
    let current = new Date(timelineRange.start);
    
    switch (zoomMode) {
      case ZOOM_MODES.WEEK: {
        current.setHours(0, 0, 0, 0);
        const endDate = new Date(timelineRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        while (current <= endDate) {
          columns.push({
            date: new Date(current),
            label: current.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
            type: 'day',
          });
          current.setDate(current.getDate() + 1);
        }
        break;
      }
      
      case ZOOM_MODES.MONTH: {
        const dayOfWeek = current.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        current.setDate(current.getDate() + daysToMonday);
        current.setHours(0, 0, 0, 0);
        
        const endDate = new Date(timelineRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        while (current <= endDate) {
          const weekEnd = new Date(current);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const startDay = current.getDate();
          const endDay = weekEnd.getDate();
          const sameMonth = current.getMonth() === weekEnd.getMonth();
          const label = sameMonth 
            ? `${startDay}-${endDay}`
            : `${startDay} ${current.toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3)}-${endDay} ${weekEnd.toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3)}`;
          
          columns.push({
            date: new Date(current),
            label: label,
            type: 'week',
          });
          
          current.setDate(current.getDate() + 7);
        }
        break;
      }
      
      case ZOOM_MODES.QUARTER:
      case ZOOM_MODES.YEAR: {
        current.setDate(1);
        current.setHours(0, 0, 0, 0);
        
        const endDate = new Date(timelineRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        while (current <= endDate) {
          columns.push({
            date: new Date(current),
            label: current.toLocaleDateString('fr-FR', { month: 'short' }),
            type: 'month',
          });
          
          current.setMonth(current.getMonth() + 1);
        }
        break;
      }
    }

    return columns;
  }, [zoomMode, timelineRange]);

  // Group columns for top header row
  const headerGroups = useMemo(() => {
    if (timeColumns.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    timeColumns.forEach((col, idx) => {
      const colDate = new Date(col.date);
      let groupKey = '';
      let groupLabel = '';

      if (zoomMode === ZOOM_MODES.WEEK || zoomMode === ZOOM_MODES.MONTH) {
        groupKey = `${colDate.getFullYear()}-${colDate.getMonth()}`;
        groupLabel = colDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else if (zoomMode === ZOOM_MODES.QUARTER) {
        const quarter = Math.floor(colDate.getMonth() / 3) + 1;
        groupKey = `${colDate.getFullYear()}-Q${quarter}`;
        groupLabel = `T${quarter} ${colDate.getFullYear()}`;
      } else if (zoomMode === ZOOM_MODES.YEAR) {
        groupKey = `${colDate.getFullYear()}`;
        groupLabel = colDate.getFullYear().toString();
      }
      
      if (!currentGroup || currentGroup.key !== groupKey) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          key: groupKey,
          startIdx: idx,
          endIdx: idx,
          label: groupLabel,
        };
      } else {
        currentGroup.endIdx = idx;
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [timeColumns, zoomMode]);

  // Find which column represents today (Dec 17, 2025)
  const todayColumnIndex = useMemo(() => {
    const today = new Date(2025, 11, 17);
    today.setHours(0, 0, 0, 0);
    
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    const todayTime = today.getTime();

    for (let i = 0; i < timeColumns.length; i++) {
      const col = timeColumns[i];
      const colDate = new Date(col.date.getTime ? col.date.getTime() : new Date(col.date).getTime());
      colDate.setHours(0, 0, 0, 0);
      const colTime = colDate.getTime();
      const colYear = colDate.getFullYear();
      const colMonth = colDate.getMonth();
      const colDateNum = colDate.getDate();

      if (zoomMode === ZOOM_MODES.WEEK) {
        if (todayYear === colYear && todayMonth === colMonth && todayDate === colDateNum) {
          return i;
        }
      } else if (zoomMode === ZOOM_MODES.MONTH) {
        const weekEnd = new Date(colDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        if (todayTime >= colTime && todayTime <= weekEnd.getTime()) {
          return i;
        }
      } else if (zoomMode === ZOOM_MODES.QUARTER || zoomMode === ZOOM_MODES.YEAR) {
        if (todayYear === colYear && todayMonth === colMonth) {
          return i;
        }
      }
    }
    return -1;
  }, [timeColumns, zoomMode]);

  // Calculate which columns a job should span
  const getJobColumnSpan = (job) => {
    if (timeColumns.length === 0) {
      return null;
    }

    const { start: jobStart, end: jobEnd } = getJobDates(job);
    
    let roundedStart = new Date(jobStart);
    let roundedEnd = new Date(jobEnd);

    switch (zoomMode) {
      case ZOOM_MODES.WEEK:
        roundedStart.setHours(0, 0, 0, 0);
        roundedEnd.setHours(23, 59, 59, 999);
        break;
      
      case ZOOM_MODES.MONTH:
        const startDay = roundedStart.getDay();
        const daysToMonday = startDay === 0 ? -6 : 1 - startDay;
        roundedStart.setDate(roundedStart.getDate() + daysToMonday);
        roundedStart.setHours(0, 0, 0, 0);
        
        const endDay = roundedEnd.getDay();
        const endDaysToMonday = endDay === 0 ? -6 : 1 - endDay;
        roundedEnd.setDate(roundedEnd.getDate() + endDaysToMonday);
        roundedEnd.setHours(0, 0, 0, 0);
        break;
      
      case ZOOM_MODES.QUARTER:
      case ZOOM_MODES.YEAR:
        roundedStart.setDate(1);
        roundedStart.setHours(0, 0, 0, 0);
        
        roundedEnd.setDate(1);
        roundedEnd.setHours(0, 0, 0, 0);
        break;
    }

    // Find start column index
    let startColIndex = -1;
    for (let i = 0; i < timeColumns.length; i++) {
      const col = timeColumns[i];
      const colDate = new Date(col.date);
      colDate.setHours(0, 0, 0, 0);
      
      let roundedStartNormalized = new Date(roundedStart);
      roundedStartNormalized.setHours(0, 0, 0, 0);
      
      if (zoomMode === ZOOM_MODES.WEEK) {
        if (roundedStartNormalized.getTime() === colDate.getTime()) {
          startColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.MONTH) {
        const colWeekEnd = new Date(colDate);
        colWeekEnd.setDate(colWeekEnd.getDate() + 6);
        if (roundedStartNormalized >= colDate && roundedStartNormalized <= colWeekEnd) {
          startColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.QUARTER || zoomMode === ZOOM_MODES.YEAR) {
        if (roundedStartNormalized.getFullYear() === colDate.getFullYear() && 
            roundedStartNormalized.getMonth() === colDate.getMonth()) {
          startColIndex = i;
          break;
        }
      }
    }

    // Find end column index
    let endColIndex = -1;
    for (let i = timeColumns.length - 1; i >= 0; i--) {
      const col = timeColumns[i];
      const colDate = new Date(col.date);
      colDate.setHours(0, 0, 0, 0);
      
      let roundedEndNormalized = new Date(roundedEnd);
      roundedEndNormalized.setHours(0, 0, 0, 0);
      
      if (zoomMode === ZOOM_MODES.WEEK) {
        if (roundedEndNormalized.getTime() === colDate.getTime()) {
          endColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.MONTH) {
        const colWeekEnd = new Date(colDate);
        colWeekEnd.setDate(colWeekEnd.getDate() + 6);
        if (roundedEndNormalized >= colDate && roundedEndNormalized <= colWeekEnd) {
          endColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.QUARTER || zoomMode === ZOOM_MODES.YEAR) {
        if (roundedEndNormalized.getFullYear() === colDate.getFullYear() && 
            roundedEndNormalized.getMonth() === colDate.getMonth()) {
          endColIndex = i;
          break;
        }
      }
    }

    if (startColIndex === -1 || endColIndex === -1 || startColIndex > endColIndex) {
      return null;
    }

    return {
      startCol: startColIndex,
      endCol: endColIndex,
      colspan: endColIndex - startColIndex + 1,
    };
  };

  // Sort workers by name
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => a.name.localeCompare(b.name));
  }, [workers]);

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('workersTitle') || 'Workers'}</h2>
          <p>{t('workersSubtitle') || 'Visual overview of all workers and their scheduled jobs'}</p>
        </div>
        <div className="timeline-controls-wrapper">
          <div className="timeline-zoom-controls">
            <button
              type="button"
              className={`timeline-zoom-btn ${zoomMode === ZOOM_MODES.WEEK ? 'active' : ''}`}
              onClick={() => setZoomMode(ZOOM_MODES.WEEK)}
            >
              Week
            </button>
            <button
              type="button"
              className={`timeline-zoom-btn ${zoomMode === ZOOM_MODES.MONTH ? 'active' : ''}`}
              onClick={() => setZoomMode(ZOOM_MODES.MONTH)}
            >
              Month
            </button>
            <button
              type="button"
              className={`timeline-zoom-btn ${zoomMode === ZOOM_MODES.QUARTER ? 'active' : ''}`}
              onClick={() => setZoomMode(ZOOM_MODES.QUARTER)}
            >
              Quarter
            </button>
            <button
              type="button"
              className={`timeline-zoom-btn ${zoomMode === ZOOM_MODES.YEAR ? 'active' : ''}`}
              onClick={() => setZoomMode(ZOOM_MODES.YEAR)}
            >
              Year
            </button>
          </div>
          <div className="timeline-controls">
            <button 
              type="button" 
              className="timeline-nav-btn"
              onClick={() => {
                if (tableWrapperRef.current) {
                  tableWrapperRef.current.scrollLeft = 0;
                }
              }}
            >
              ‹
            </button>
            <button 
              type="button" 
              className="timeline-nav-btn"
              onClick={() => {
                if (tableWrapperRef.current && todayColumnIndex >= 0) {
                  const scrollPosition = (todayColumnIndex * COLUMN_WIDTH);
                  tableWrapperRef.current.scrollLeft = scrollPosition;
                }
              }}
            >
              Today
            </button>
            <button 
              type="button" 
              className="timeline-nav-btn"
              onClick={() => {
                if (tableWrapperRef.current) {
                  tableWrapperRef.current.scrollLeft = tableWrapperRef.current.scrollWidth;
                }
              }}
            >
              ›
            </button>
          </div>
        </div>
      </header>

      <div className="timeline-container" style={{ transform: 'scale(0.67)', transformOrigin: 'top left' }}>
        <div 
          ref={tableWrapperRef}
          className="timeline-table-wrapper" 
          style={{ position: 'relative' }}
        >
          <table className="timeline-table">
            <thead>
              <tr>
                <th 
                  className="timeline-project-header" 
                  rowSpan={2}
                  style={{ borderBottom: 'none' }}
                >
                  Worker
                </th>
                {timeColumns.length === 0 ? (
                  <th className="timeline-time-header-group" colSpan={1}>No columns yet</th>
                ) : (
                  headerGroups.map((group, groupIdx) => {
                    const colspan = group.endIdx - group.startIdx + 1;
                    return (
                      <th 
                        key={groupIdx}
                        className="timeline-time-header-group"
                        colSpan={colspan}
                        style={{ minWidth: `${COLUMN_WIDTH * colspan}px` }}
                      >
                        {group.label}
                      </th>
                    );
                  })
                )}
              </tr>
              <tr>
                {timeColumns.length > 0 && timeColumns.map((col, idx) => (
                  <th 
                    key={idx} 
                    className="timeline-time-header" 
                    style={{ 
                      width: `${COLUMN_WIDTH}px`,
                      minWidth: `${COLUMN_WIDTH}px`,
                      maxWidth: `${COLUMN_WIDTH}px`
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Add Worker Row */}
              <tr className="timeline-project-row" style={{ minHeight: '60px' }}>
                <td 
                  className="timeline-project-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingWorker(null);
                    setWorkerFormData({ name: '', email: '', phone: '' });
                    setIsAddingWorker(true);
                  }}
                  style={{ 
                    cursor: 'pointer',
                    minHeight: '60px',
                    height: 'auto',
                    verticalAlign: 'top',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '2px dashed #cbd5e1',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    color: '#64748b',
                    fontWeight: 500
                  }}>
                    <span style={{ fontSize: '18px' }}>+</span>
                    <span>{t('addWorker') || 'Add Worker'}</span>
                  </div>
                </td>
                {Array.from({ length: timeColumns.length }).map((_, i) => (
                  <td key={i} className="timeline-time-cell" style={{ minWidth: `${COLUMN_WIDTH}px`, width: `${COLUMN_WIDTH}px` }}></td>
                ))}
              </tr>

              {sortedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={timeColumns.length + 1} style={{ padding: '20px', textAlign: 'center' }}>
                    No workers
                  </td>
                </tr>
              ) : (
                sortedWorkers.map((worker) => {
                  const workerJobs = worker.jobs || [];
                  
                  // Build cells array with all jobs for this worker
                  const cells = [];
                  
                  // First, calculate spans for all jobs and sort by start column
                  const jobSpans = workerJobs
                    .map(job => ({
                      job,
                      span: getJobColumnSpan(job),
                    }))
                    .filter(item => item.span !== null)
                    .sort((a, b) => a.span.startCol - b.span.startCol);

                  // Track which columns have been rendered to avoid duplicates
                  const renderedColumns = new Set();

                  // Track all jobs per column for proper vertical stacking
                  const jobsPerColumn = new Map();
                  
                  jobSpans.forEach(jobSpan => {
                    for (let col = jobSpan.span.startCol; col <= jobSpan.span.endCol; col++) {
                      if (!jobsPerColumn.has(col)) {
                        jobsPerColumn.set(col, []);
                      }
                      // Add job to this column if it hasn't been added yet
                      const colJobs = jobsPerColumn.get(col);
                      if (!colJobs.find(j => j.job.id === jobSpan.job.id)) {
                        colJobs.push(jobSpan);
                      }
                    }
                  });

                  // Find the maximum number of jobs in any column for this worker (to set row height)
                  const maxJobsInAnyColumn = Math.max(
                    ...Array.from(jobsPerColumn.values()).map(jobs => jobs.length),
                    1 // At least 1 for empty rows
                  );

                  // Build cells for each column
                  for (let i = 0; i < timeColumns.length; i++) {
                    const jobsAtColumn = jobsPerColumn.get(i) || [];
                    const jobsStartingHere = jobsAtColumn.filter(js => js.span.startCol === i);
                    
                    if (jobsStartingHere.length > 0) {
                      const jobSpan = jobsStartingHere[0];
                      
                      cells.push(
                        <td
                          key={i}
                          className="timeline-time-cell"
                          colSpan={jobSpan.span.colspan}
                          style={{ 
                            position: 'relative',
                            padding: '4px',
                            verticalAlign: 'top',
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '4px',
                            minHeight: '100%',
                          }}>
                            {jobsStartingHere.map((js) => (
                              <div
                                key={js.job.id}
                                className="timeline-project-bar in-progress"
                                title={`${js.job.chantierName}${js.job.jobType ? ` - ${js.job.jobType}` : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingJob(js.job);
                                  setEditingWorkerId(worker.id);
                                  setEditFormData({
                                    chantierName: js.job.chantierName || '',
                                    startDate: js.job.startDate ? js.job.startDate.split('T')[0] : '',
                                    endDate: js.job.endDate ? js.job.endDate.split('T')[0] : '',
                                    jobType: js.job.jobType || '',
                                  });
                                }}
                                style={{ 
                                  cursor: 'pointer',
                                  position: 'relative',
                                  width: '100%',
                                  minHeight: '32px',
                                  flexShrink: 0,
                                }}
                              >
                                <div style={{ padding: '6px 10px', height: '100%', display: 'flex', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {js.job.chantierName}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                      
                      // Skip the remaining columns that are part of the span
                      i = jobSpan.span.endCol;
                    } else {
                      // Empty cell - but still need to account for height if other columns have jobs
                      cells.push(
                        <td 
                          key={i} 
                          className="timeline-time-cell" 
                          style={{ 
                            minWidth: `${COLUMN_WIDTH}px`, 
                            width: `${COLUMN_WIDTH}px`,
                            padding: '4px',
                            verticalAlign: 'top',
                          }}
                        >
                          {/* Render overlapping jobs that pass through this column */}
                          {jobsAtColumn
                            .filter(js => js.span.startCol < i && js.span.endCol >= i)
                            .length > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '4px',
                              minHeight: '100%',
                            }}>
                              {jobsAtColumn
                                .filter(js => js.span.startCol < i && js.span.endCol >= i)
                                .map((js) => (
                                  <div
                                    key={`overlap-${js.job.id}-${i}`}
                                    className="timeline-project-bar in-progress"
                                    style={{
                                      position: 'relative',
                                      width: '100%',
                                      minHeight: '32px',
                                      flexShrink: 0,
                                      cursor: 'pointer',
                                      opacity: 0.85,
                                    }}
                                    title={`${js.job.chantierName}${js.job.jobType ? ` - ${js.job.jobType}` : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingJob(js.job);
                                      setEditingWorkerId(worker.id);
                                      setEditFormData({
                                        chantierName: js.job.chantierName || '',
                                        startDate: js.job.startDate ? js.job.startDate.split('T')[0] : '',
                                        endDate: js.job.endDate ? js.job.endDate.split('T')[0] : '',
                                        jobType: js.job.jobType || '',
                                      });
                                    }}
                                  >
                                    <div style={{ padding: '6px 10px', height: '100%', display: 'flex', alignItems: 'center' }}>
                                      <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {js.job.chantierName}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </td>
                      );
                    }
                  }

                  // Calculate minimum row height based on max jobs in any column
                  const minRowHeight = Math.max(60, maxJobsInAnyColumn * 36 + 8); // 36px per job + 8px padding

                  const handleWorkerClick = (e) => {
                    e.stopPropagation();
                    setEditingWorker(worker);
                    setWorkerFormData({
                      name: worker.name || '',
                      email: worker.email || '',
                      phone: worker.phone || '',
                    });
                    setIsAddingWorker(false);
                  };

                  return (
                    <tr 
                      key={worker.id} 
                      className="timeline-project-row"
                      style={{ 
                        minHeight: `${minRowHeight}px`,
                        height: 'auto',
                      }}
                    >
                      <td 
                        className="timeline-project-name"
                        onClick={handleWorkerClick}
                        style={{ 
                          cursor: 'pointer',
                          minHeight: `${minRowHeight}px`,
                          height: 'auto',
                          verticalAlign: 'top',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '2px', lineHeight: '1.4' }}>{worker.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.4', marginBottom: '4px' }}>
                          {workerJobs.length} {workerJobs.length === 1 ? 'job' : 'jobs'}
                        </div>
                        {(worker.email || worker.phone) && (
                          <div style={{ fontSize: '10px', color: '#9ca3af', lineHeight: '1.3', marginTop: '4px' }}>
                            {worker.email && <div style={{ marginBottom: '2px' }}>{worker.email}</div>}
                            {worker.phone && <div>{worker.phone}</div>}
                          </div>
                        )}
                      </td>
                      {cells}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {todayColumnIndex >= 0 && (
            <div
              className="timeline-today-indicator"
              style={{
                position: 'absolute',
                left: `${320 + (todayColumnIndex * COLUMN_WIDTH)}px`, // Updated from 280 to 320 to match new column width
                top: '56px',
                bottom: 0,
                width: '3px',
                background: 'linear-gradient(to bottom, #ef4444 0%, #dc2626 100%)',
                zIndex: 22,
                pointerEvents: 'none',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6), 0 0 4px rgba(239, 68, 68, 0.4)',
                borderRadius: '2px',
              }}
            />
          )}
        </div>
      </div>

      {/* Edit/Create Worker Modal */}
      {(editingWorker || isAddingWorker) && (
        <div 
          className="timeline-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingWorker(null);
              setIsAddingWorker(false);
              setWorkerFormData({ name: '', email: '', phone: '' });
            }
          }}
        >
          <div className="timeline-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="timeline-edit-modal-header">
              <h3>{isAddingWorker ? (t('addWorker') || 'Add Worker') : (t('editWorker') || 'Edit Worker')}</h3>
              <button
                type="button"
                className="timeline-edit-modal-close"
                onClick={() => {
                  setEditingWorker(null);
                  setIsAddingWorker(false);
                  setWorkerFormData({ name: '', email: '', phone: '' });
                }}
              >
                ×
              </button>
            </div>
            <div className="timeline-edit-modal-body">
              <div className="timeline-edit-field">
                <label htmlFor="worker-name">{t('workerName') || 'Name'}:</label>
                <input
                  id="worker-name"
                  type="text"
                  value={workerFormData.name || ''}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, name: e.target.value })}
                  placeholder={t('workerNamePlaceholder') || 'Worker name'}
                  required
                />
              </div>
              <div className="timeline-edit-field">
                <label htmlFor="worker-email">{t('workerEmail') || 'Email'}:</label>
                <input
                  id="worker-email"
                  type="email"
                  value={workerFormData.email || ''}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, email: e.target.value })}
                  placeholder={t('workerEmailPlaceholder') || 'email@example.com'}
                />
              </div>
              <div className="timeline-edit-field">
                <label htmlFor="worker-phone">{t('workerPhone') || 'Phone'}:</label>
                <input
                  id="worker-phone"
                  type="tel"
                  value={workerFormData.phone || ''}
                  onChange={(e) => setWorkerFormData({ ...workerFormData, phone: e.target.value })}
                  placeholder={t('workerPhonePlaceholder') || '+33 6 12 34 56 78'}
                />
              </div>
            </div>
            <div className="timeline-edit-modal-footer" style={{ justifyContent: editingWorker ? 'space-between' : 'flex-end' }}>
              {editingWorker && (
                <button
                  type="button"
                  className="timeline-edit-btn timeline-edit-btn-delete"
                  onClick={() => {
                    const workerJobsCount = editingWorker.jobs?.length || 0;
                    let confirmMessage;
                    
                    if (workerJobsCount > 0) {
                      const template = t('deleteWorkerConfirmWithJobs') || 'Are you sure you want to delete {name}? This will also delete {count} associated job(s). This action cannot be undone.';
                      confirmMessage = template.replace('{name}', editingWorker.name).replace('{count}', workerJobsCount.toString());
                    } else {
                      const template = t('deleteWorkerConfirm') || 'Are you sure you want to delete {name}? This action cannot be undone.';
                      confirmMessage = template.replace('{name}', editingWorker.name);
                    }
                    
                    if (window.confirm(confirmMessage)) {
                      deleteWorker(editingWorker.id);
                      setEditingWorker(null);
                      setIsAddingWorker(false);
                      setWorkerFormData({ name: '', email: '', phone: '' });
                    }
                  }}
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fecaca';
                    e.currentTarget.style.borderColor = '#fca5a5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}
                >
                  {t('deleteWorker') || 'Delete Worker'}
                </button>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="timeline-edit-btn timeline-edit-btn-cancel"
                  onClick={() => {
                    setEditingWorker(null);
                    setIsAddingWorker(false);
                    setWorkerFormData({ name: '', email: '', phone: '' });
                  }}
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  type="button"
                  className="timeline-edit-btn timeline-edit-btn-save"
                  onClick={() => {
                    if (!workerFormData.name || !workerFormData.name.trim()) {
                      alert(t('workerNameRequired') || 'Worker name is required');
                      return;
                    }

                    if (isAddingWorker) {
                      // Add new worker
                      addWorker({
                        name: workerFormData.name.trim(),
                        email: workerFormData.email.trim(),
                        phone: workerFormData.phone.trim(),
                        jobs: [],
                      });
                    } else if (editingWorker) {
                      // Update existing worker
                      updateWorker(editingWorker.id, {
                        name: workerFormData.name.trim(),
                        email: workerFormData.email.trim(),
                        phone: workerFormData.phone.trim(),
                      });
                    }

                    setEditingWorker(null);
                    setIsAddingWorker(false);
                    setWorkerFormData({ name: '', email: '', phone: '' });
                  }}
                >
                  {isAddingWorker ? (t('add') || 'Add') : (t('saveChanges') || 'Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {editingJob && editingWorkerId && (
        <div 
          className="timeline-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingJob(null);
              setEditingWorkerId(null);
              setEditFormData({});
            }
          }}
        >
          <div className="timeline-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="timeline-edit-modal-header">
              <h3>Edit Job</h3>
              <button
                type="button"
                className="timeline-edit-modal-close"
                onClick={() => {
                  setEditingJob(null);
                  setEditingWorkerId(null);
                  setEditFormData({});
                }}
              >
                ×
              </button>
            </div>
            <div className="timeline-edit-modal-body">
              <div className="timeline-edit-field">
                <label htmlFor="edit-chantier-name">Chantier Name:</label>
                <input
                  id="edit-chantier-name"
                  type="text"
                  value={editFormData.chantierName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, chantierName: e.target.value })}
                  placeholder="Chantier name"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="timeline-edit-field">
                  <label htmlFor="edit-start-date">Start Date:</label>
                  <input
                    id="edit-start-date"
                    type="date"
                    value={editFormData.startDate || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  />
                </div>
                <div className="timeline-edit-field">
                  <label htmlFor="edit-end-date">End Date:</label>
                  <input
                    id="edit-end-date"
                    type="date"
                    value={editFormData.endDate || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="timeline-edit-field">
                <label htmlFor="edit-job-type">Job Type:</label>
                <input
                  id="edit-job-type"
                  type="text"
                  value={editFormData.jobType || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, jobType: e.target.value })}
                  placeholder="e.g., plumbing, demo, electrical"
                  readOnly
                  style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                />
                <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  Job type will be editable in a future update
                </small>
              </div>
            </div>
            <div className="timeline-edit-modal-footer">
              <button
                type="button"
                className="timeline-edit-btn timeline-edit-btn-cancel"
                onClick={() => {
                  setEditingJob(null);
                  setEditingWorkerId(null);
                  setEditFormData({});
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="timeline-edit-btn timeline-edit-btn-save"
                onClick={() => {
                  if (editingJob && editingWorkerId) {
                    const updates = {
                      chantierName: editFormData.chantierName || '',
                      jobType: editFormData.jobType || editingJob.jobType || '',
                    };
                    
                    if (editFormData.startDate) {
                      updates.startDate = new Date(editFormData.startDate).toISOString();
                    }
                    
                    if (editFormData.endDate) {
                      updates.endDate = new Date(editFormData.endDate).toISOString();
                    }
                    
                    updateJob(editingWorkerId, editingJob.id, updates);
                    setEditingJob(null);
                    setEditingWorkerId(null);
                    setEditFormData({});
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Workers;
