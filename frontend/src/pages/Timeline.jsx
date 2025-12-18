import { useState, useMemo, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { validateProjectDates } from '../utils/projectValidation.js';

const ZOOM_MODES = {
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
};

function Timeline() {
  const { t } = useTranslation();
  const { projects, updateProject } = useProjects();
  const [zoomMode, setZoomMode] = useState(ZOOM_MODES.QUARTER);
  const tableWrapperRef = useRef(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  // Column width constant for easier adjustment
  // Width varies by zoom mode to ensure all text is visible
  const getColumnWidth = () => {
    switch (zoomMode) {
      case ZOOM_MODES.WEEK:
        return 125; // Days - enough for weekday and day number
      case ZOOM_MODES.MONTH:
        return 200; // Week ranges like "1 Fév - 7 Fév" need more space - increased for better visibility
      case ZOOM_MODES.QUARTER:
        return 180; // Month names like "Février 2025" need more space
      case ZOOM_MODES.YEAR:
        return 180; // Month names need more space
      default:
        return 200;
    }
  };
  const COLUMN_WIDTH = getColumnWidth();

  // Date utility: Parse date strings to Date objects (avoiding timezone issues)
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

  // Get project start and end dates
  const getProjectDates = (project) => {
    const start = project.startDate 
      ? toDate(project.startDate)
      : (project.createdAt ? toDate(project.createdAt) : new Date());
    
    const end = project.endDate 
      ? toDate(project.endDate)
      : new Date(start.getFullYear(), start.getMonth() + 6, start.getDate());
    
    return {
      start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
      end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
    };
  };

  // Get all projects sorted by start date (earliest to latest)
  const allProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const datesA = getProjectDates(a);
      const datesB = getProjectDates(b);
      return datesA.start.getTime() - datesB.start.getTime();
    });
  }, [projects]);

  // Calculate timeline range (from first project start to last project end)
  // Always ensure Dec 17, 2025 (today) is included
  const timelineRange = useMemo(() => {
    const today = new Date(2025, 11, 17); // Dec 17, 2025
    
    if (allProjects.length === 0) {
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
        end: new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()),
      };
    }

    let minStart = null;
    let maxEnd = null;

    allProjects.forEach(project => {
      const { start, end } = getProjectDates(project);
      if (!minStart || start < minStart) minStart = new Date(start);
      if (!maxEnd || end > maxEnd) maxEnd = new Date(end);
    });

    // Ensure today (Dec 17, 2025) is included in the range
    if (today < minStart) minStart = new Date(today);
    if (today > maxEnd) maxEnd = new Date(today);

    return {
      start: new Date(minStart.getFullYear(), minStart.getMonth(), minStart.getDate()),
      end: new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate()),
    };
  }, [allProjects]);

  // Generate time columns based on zoom mode
  // Range: From first project start to last project end (for scrolling)
  // Initially shows current period based on zoom mode
  const timeColumns = useMemo(() => {
    if (!timelineRange.start || !timelineRange.end) {
      return [];
    }

    const columns = [];
    const now = new Date();
    
    // Determine the start date for column generation
    // Start from timelineRange.start (first project), but we'll initially show current period
    let current = new Date(timelineRange.start);
    
    // For the initial view, we could start from "today" or current period
    // But for full scrollability, generate all columns from first project to last
    // We'll start at timelineRange.start and generate until timelineRange.end
    
    switch (zoomMode) {
      case ZOOM_MODES.WEEK: {
        // Each column = 1 day
        current = new Date(timelineRange.start);
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
        // Each column = 1 week (Monday to Sunday)
        current = new Date(timelineRange.start);
        
        // Find Monday of the week containing the start date
        const dayOfWeek = current.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        current.setDate(current.getDate() + daysToMonday);
        current.setHours(0, 0, 0, 0);
        
        const endDate = new Date(timelineRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        while (current <= endDate) {
          const weekEnd = new Date(current);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          // Show just the date range numbers for cleaner display
          const startDay = current.getDate();
          const endDay = weekEnd.getDate();
          const sameMonth = current.getMonth() === weekEnd.getMonth();
          // Use shorter format: just numbers if same month, otherwise include month abbreviation
          const label = sameMonth 
            ? `${startDay}-${endDay}`
            : `${startDay} ${current.toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3)}-${endDay} ${weekEnd.toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3)}`;
          
          columns.push({
            date: new Date(current),
            label: label,
            type: 'week',
          });
          
          // Move to next week (Monday)
          current.setDate(current.getDate() + 7);
        }
        break;
      }
      
      case ZOOM_MODES.QUARTER: {
        // Each column = 1 month
        current = new Date(timelineRange.start);
        current.setDate(1); // Start of month
        current.setHours(0, 0, 0, 0);
        
        const endDate = new Date(timelineRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        while (current <= endDate) {
          columns.push({
            date: new Date(current),
            label: current.toLocaleDateString('fr-FR', { month: 'short' }),
            type: 'month',
          });
          
          // Move to next month
          current.setMonth(current.getMonth() + 1);
        }
        break;
      }
      
      case ZOOM_MODES.YEAR: {
        // Each column = 1 month
        current = new Date(timelineRange.start);
        current.setDate(1); // Start of month
        current.setHours(0, 0, 0, 0);
        
        const endDate = new Date(timelineRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        while (current <= endDate) {
          columns.push({
            date: new Date(current),
            label: current.toLocaleDateString('fr-FR', { month: 'short' }),
            type: 'month',
          });
          
          // Move to next month
          current.setMonth(current.getMonth() + 1);
        }
        break;
      }
    }

    return columns;
  }, [zoomMode, timelineRange]);

  // Group columns for top header row based on zoom mode
  const headerGroups = useMemo(() => {
    if (timeColumns.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    timeColumns.forEach((col, idx) => {
      const colDate = new Date(col.date);
      let groupKey = '';
      let groupLabel = '';

      if (zoomMode === ZOOM_MODES.WEEK || zoomMode === ZOOM_MODES.MONTH) {
        // Group by month
        groupKey = `${colDate.getFullYear()}-${colDate.getMonth()}`;
        groupLabel = colDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else if (zoomMode === ZOOM_MODES.QUARTER) {
        // Group by quarter
        const quarter = Math.floor(colDate.getMonth() / 3) + 1;
        groupKey = `${colDate.getFullYear()}-Q${quarter}`;
        groupLabel = `T${quarter} ${colDate.getFullYear()}`;
      } else if (zoomMode === ZOOM_MODES.YEAR) {
        // Group by year
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
    const today = new Date(2025, 11, 17); // Dec 17, 2025 (month is 0-indexed, 11 = December)
    today.setHours(0, 0, 0, 0);
    
    const todayYear = today.getFullYear(); // Should be 2025
    const todayMonth = today.getMonth(); // Should be 11 (December)
    const todayDate = today.getDate(); // Should be 17
    const todayTime = today.getTime();

    for (let i = 0; i < timeColumns.length; i++) {
      const col = timeColumns[i];
      // Ensure we create a fresh date object and normalize it
      const colDate = new Date(col.date.getTime ? col.date.getTime() : new Date(col.date).getTime());
      colDate.setHours(0, 0, 0, 0);
      const colTime = colDate.getTime();
      const colYear = colDate.getFullYear();
      const colMonth = colDate.getMonth();
      const colDateNum = colDate.getDate();

      if (zoomMode === ZOOM_MODES.WEEK) {
        // Exact day match - compare year, month, and date
        if (todayYear === colYear && 
            todayMonth === colMonth && 
            todayDate === colDateNum) {
          return i;
        }
      } else if (zoomMode === ZOOM_MODES.MONTH) {
        // Check if today is in this week (colDate is Monday of the week)
        const weekEnd = new Date(colDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        if (todayTime >= colTime && todayTime <= weekEnd.getTime()) {
          return i;
        }
      } else if (zoomMode === ZOOM_MODES.QUARTER || zoomMode === ZOOM_MODES.YEAR) {
        // Check if today is in this month - compare year and month only
        // colDate should be the 1st of the month in these views
        if (todayYear === colYear && todayMonth === colMonth) {
          return i;
        }
      }
    }
    return -1; // Today not in visible range
  }, [timeColumns, zoomMode]);

  // Calculate which columns a project should span
  const getProjectColumnSpan = (project) => {
    if (timeColumns.length === 0) {
      return null;
    }

    const { start: projStart, end: projEnd } = getProjectDates(project);
    
    // Round down project dates based on zoom mode
    let roundedStart = new Date(projStart);
    let roundedEnd = new Date(projEnd);

    switch (zoomMode) {
      case ZOOM_MODES.WEEK:
        // Each column = 1 day, align by day (no rounding needed)
        roundedStart.setHours(0, 0, 0, 0);
        roundedEnd.setHours(23, 59, 59, 999);
        break;
      
      case ZOOM_MODES.MONTH:
        // Each column = 1 week, round DOWN to start of week (Monday)
        const startDay = roundedStart.getDay();
        const daysToMonday = startDay === 0 ? -6 : 1 - startDay;
        roundedStart.setDate(roundedStart.getDate() + daysToMonday);
        roundedStart.setHours(0, 0, 0, 0);
        
        // Round end date DOWN to start of week (Monday)
        const endDay = roundedEnd.getDay();
        const endDaysToMonday = endDay === 0 ? -6 : 1 - endDay;
        roundedEnd.setDate(roundedEnd.getDate() + endDaysToMonday);
        roundedEnd.setHours(0, 0, 0, 0);
        break;
      
      case ZOOM_MODES.QUARTER:
      case ZOOM_MODES.YEAR:
        // Each column = 1 month, round DOWN to start of month
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
        // Exact day match
        if (roundedStartNormalized.getTime() === colDate.getTime()) {
          startColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.MONTH) {
        // Column date is Monday of the week, check if rounded start is in this week
        const colWeekEnd = new Date(colDate);
        colWeekEnd.setDate(colWeekEnd.getDate() + 6);
        if (roundedStartNormalized >= colDate && roundedStartNormalized <= colWeekEnd) {
          startColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.QUARTER || zoomMode === ZOOM_MODES.YEAR) {
        // Column date is month start, check if same month/year
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
        // Exact day match
        if (roundedEndNormalized.getTime() === colDate.getTime()) {
          endColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.MONTH) {
        // Column date is Monday of the week, check if rounded end is in this week
        const colWeekEnd = new Date(colDate);
        colWeekEnd.setDate(colWeekEnd.getDate() + 6);
        if (roundedEndNormalized >= colDate && roundedEndNormalized <= colWeekEnd) {
          endColIndex = i;
          break;
        }
      } else if (zoomMode === ZOOM_MODES.QUARTER || zoomMode === ZOOM_MODES.YEAR) {
        // Column date is month start, check if same month/year
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

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('timelineTitle')}</h2>
          <p>{t('timelineSubtitle') || 'View all projects on a calendar timeline'}</p>
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
                  // Calculate scroll position to show today's column as leftmost
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
                  // Scroll to the rightmost position (100% to the right)
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
              {/* First row: Date/Month/Year groupings */}
              <tr>
                <th 
                  className="timeline-project-header" 
                  rowSpan={2}
                  style={{ borderBottom: 'none' }}
                >
                  Chantier
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
              {/* Second row: Individual column labels */}
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
              {allProjects.length === 0 ? (
                <tr>
                  <td colSpan={timeColumns.length + 1} style={{ padding: '20px', textAlign: 'center' }}>
                    No projects
                  </td>
                </tr>
              ) : (
                allProjects.map((project) => {
                  const projectName = project.address || project.name || 'Untitled Project';
                  const clientName = project.clientName || 'No client';
                  const span = getProjectColumnSpan(project);
                  const isCompleted = project.status === 'completed';
                  
                  // Build cells array
                  const cells = [];
                  
                  // Add empty cells before the project span
                  for (let i = 0; i < timeColumns.length; i++) {
                    if (span && i === span.startCol) {
                      // This is where the project bar starts - add the span cell
                      cells.push(
                        <td
                          key={i}
                          className="timeline-time-cell"
                          colSpan={span.colspan}
                          style={{ 
                            position: 'relative',
                            padding: 0
                          }}
                        >
                          <div
                            className={`timeline-project-bar ${isCompleted ? 'completed' : 'in-progress'}`}
                            title={`${projectName} / ${clientName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(project);
                              setEditFormData({
                                name: project.name || '',
                                address: project.address || '',
                                clientName: project.clientName || '',
                                startDate: project.startDate ? project.startDate.split('T')[0] : '',
                                endDate: project.endDate ? project.endDate.split('T')[0] : '',
                                status: project.status || 'active',
                                percentagePaid: project.percentagePaid || 0,
                              });
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div style={{ padding: '4px 8px' }}>
                              <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {projectName}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                      // Skip the remaining columns that are part of the span
                      i = span.endCol;
                    } else {
                      // Empty cell
                      cells.push(
                        <td key={i} className="timeline-time-cell" style={{ minWidth: `${COLUMN_WIDTH}px`, width: `${COLUMN_WIDTH}px` }}></td>
                      );
                    }
                  }
                  
                  const handleProjectClick = (e) => {
                    e.stopPropagation();
                    setEditingProject(project);
                    setEditFormData({
                      name: project.name || '',
                      address: project.address || '',
                      clientName: project.clientName || '',
                      startDate: project.startDate ? project.startDate.split('T')[0] : '',
                      endDate: project.endDate ? project.endDate.split('T')[0] : '',
                      status: project.status || 'active',
                      percentagePaid: project.percentagePaid || 0,
                    });
                  };

                  return (
                    <tr key={project.id} className="timeline-project-row">
                      <td 
                        className="timeline-project-name"
                        onClick={handleProjectClick}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '2px', lineHeight: '1.4' }}>{projectName}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.4' }}>{clientName}</div>
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
                left: `${280 + (todayColumnIndex * COLUMN_WIDTH)}px`, // 280px for left column + (column index * column width)
                top: '56px', // Start below the two-row header (adjusted for taller headers)
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

      {/* Edit Project Modal */}
      {editingProject && (
        <div 
          className="timeline-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingProject(null);
              setEditFormData({});
            }
          }}
        >
          <div className="timeline-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="timeline-edit-modal-header">
              <h3>Edit Project</h3>
              <button
                type="button"
                className="timeline-edit-modal-close"
                onClick={() => {
                  setEditingProject(null);
                  setEditFormData({});
                }}
              >
                ×
              </button>
            </div>
            <div className="timeline-edit-modal-body">
              <div className="timeline-edit-field">
                <label htmlFor="edit-name">Name:</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Project name"
                />
              </div>
              <div className="timeline-edit-field">
                <label htmlFor="edit-address">Address:</label>
                <input
                  id="edit-address"
                  type="text"
                  value={editFormData.address || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Project address"
                />
              </div>
              <div className="timeline-edit-field">
                <label htmlFor="edit-client">Client Name:</label>
                <input
                  id="edit-client"
                  type="text"
                  value={editFormData.clientName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, clientName: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="timeline-edit-field">
                  <label htmlFor="edit-start-date">Start Date:</label>
                  <input
                    id="edit-start-date"
                    type="date"
                    value={editFormData.startDate || ''}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setEditFormData({ ...editFormData, startDate: newStartDate });
                      
                      // Real-time validation: if endDate exists and is before new startDate, show warning
                      if (editFormData.endDate && newStartDate) {
                        const start = new Date(newStartDate);
                        const end = new Date(editFormData.endDate);
                        if (start > end) {
                          // Highlight the input with error style
                          setTimeout(() => {
                            const input = document.getElementById('edit-start-date');
                            if (input) {
                              input.style.borderColor = '#ef4444';
                              input.style.backgroundColor = '#fef2f2';
                            }
                          }, 0);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Reset error styling if valid
                      const validation = validateProjectDates({
                        startDate: editFormData.startDate,
                        endDate: editFormData.endDate
                      });
                      if (validation.isValid) {
                        e.target.style.borderColor = '';
                        e.target.style.backgroundColor = '';
                      }
                    }}
                  />
                  {editFormData.startDate && editFormData.endDate && (() => {
                    const validation = validateProjectDates({
                      startDate: editFormData.startDate,
                      endDate: editFormData.endDate
                    });
                    return !validation.isValid ? (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                        {validation.errors[0]}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="timeline-edit-field">
                  <label htmlFor="edit-end-date">End Date:</label>
                  <input
                    id="edit-end-date"
                    type="date"
                    value={editFormData.endDate || ''}
                    onChange={(e) => {
                      const newEndDate = e.target.value;
                      setEditFormData({ ...editFormData, endDate: newEndDate });
                      
                      // Real-time validation: if startDate exists and is after new endDate, show warning
                      if (editFormData.startDate && newEndDate) {
                        const start = new Date(editFormData.startDate);
                        const end = new Date(newEndDate);
                        if (start > end) {
                          setTimeout(() => {
                            const input = document.getElementById('edit-end-date');
                            if (input) {
                              input.style.borderColor = '#ef4444';
                              input.style.backgroundColor = '#fef2f2';
                            }
                          }, 0);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const validation = validateProjectDates({
                        startDate: editFormData.startDate,
                        endDate: editFormData.endDate
                      });
                      if (validation.isValid) {
                        e.target.style.borderColor = '';
                        e.target.style.backgroundColor = '';
                      }
                    }}
                    min={editFormData.startDate || ''}
                  />
                  {editFormData.startDate && editFormData.endDate && (() => {
                    const validation = validateProjectDates({
                      startDate: editFormData.startDate,
                      endDate: editFormData.endDate
                    });
                    return !validation.isValid ? (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                        {validation.errors[0]}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="timeline-edit-field">
                  <label htmlFor="edit-status">Status:</label>
                  <select
                    id="edit-status"
                    value={editFormData.status || 'active'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                  >
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="timeline-edit-field">
                  <label htmlFor="edit-percentage">Percentage Paid:</label>
                  <input
                    id="edit-percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={editFormData.percentagePaid || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, percentagePaid: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
            <div className="timeline-edit-modal-footer">
              <button
                type="button"
                className="timeline-edit-btn timeline-edit-btn-cancel"
                onClick={() => {
                  setEditingProject(null);
                  setEditFormData({});
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="timeline-edit-btn timeline-edit-btn-save"
                onClick={() => {
                  if (editingProject) {
                    const updates = {
                      name: editFormData.name || editFormData.address,
                      address: editFormData.address || editFormData.name,
                      clientName: editFormData.clientName || '',
                      status: editFormData.status || 'active',
                      percentagePaid: editFormData.percentagePaid || 0,
                    };
                    
                    // Normalize and validate dates
                    if (editFormData.startDate) {
                      updates.startDate = new Date(editFormData.startDate).toISOString();
                    }
                    
                    if (editFormData.endDate) {
                      updates.endDate = new Date(editFormData.endDate).toISOString();
                    }
                    
                    // Validate dates before saving
                    const validation = validateProjectDates(updates);
                    if (!validation.isValid) {
                      alert(`Cannot save: ${validation.errors.join(', ')}`);
                      return;
                    }
                    
                    updateProject(editingProject.id, updates);
                    setEditingProject(null);
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

export default Timeline;

