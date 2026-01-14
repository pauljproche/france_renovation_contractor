import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { validateProject, validateProjectDates } from '../utils/projectValidation.js';

const ProjectsContext = createContext(undefined);

// Demo projects that are always available
const DEMO_PROJECT_ID = 'demo-project';
const EMPTY_DEMO_PROJECT_ID = 'empty-demo-project';
const PENDING_APPROVAL_DEMO_PROJECT_ID = 'pending-approval-demo-project';

const DEMO_PROJECT = {
  id: DEMO_PROJECT_ID,
  name: 'Demo Renovation Project',
  address: 'Demo Renovation Project',
  clientName: 'No client',
  createdAt: new Date('2025-12-31').toISOString(),
  updatedAt: new Date('2025-12-31').toISOString(),
  startDate: new Date('2025-12-31').toISOString(),
  status: 'active',
  isDemo: true,
  hasData: true, // Uses existing materials.json
  devisStatus: 'approved', // sent, approved, rejected
  invoiceCount: 2, // Number of invoices sent
  percentagePaid: 50,
};

const EMPTY_DEMO_PROJECT = {
  id: EMPTY_DEMO_PROJECT_ID,
  name: 'Empty Demo Project',
  address: 'Empty Demo Project',
  clientName: 'No client',
  createdAt: new Date('2025-12-31').toISOString(),
  updatedAt: new Date('2025-12-31').toISOString(),
  startDate: new Date('2025-12-31').toISOString(),
  status: 'draft',
  isDemo: true,
  hasData: false, // No data - empty state
  devisStatus: null, // No devis yet
  invoiceCount: 0,
  percentagePaid: 50,
};

const PENDING_APPROVAL_DEMO_PROJECT = {
  id: PENDING_APPROVAL_DEMO_PROJECT_ID,
  name: 'Bathroom Renovation - Paris Apartment',
  address: 'Bathroom Renovation - Paris Apartment',
  clientName: 'No client',
  createdAt: new Date('2025-10-14').toISOString(),
  updatedAt: new Date('2025-10-14').toISOString(),
  startDate: new Date('2025-10-14').toISOString(),
  status: 'ready',
  isDemo: true,
  hasData: true, // Has devis data but waiting for approval
  devisStatus: 'sent', // Devis sent to client, pending approval
  invoiceCount: 0, // No invoices yet - waiting for approval
  percentagePaid: 90,
};

// Additional timeline demo projects
const TIMELINE_DEMO_PROJECTS = [
  {
    id: 'timeline-demo-1',
    name: '243 RUE ST JACQUES',
    address: '243 RUE ST JACQUES',
    clientName: 'Emmanuel Roche',
    createdAt: new Date('2025-09-17').toISOString(),
    updatedAt: new Date('2025-09-17').toISOString(),
    startDate: new Date('2025-09-17').toISOString(),
    endDate: new Date('2026-02-17').toISOString(), // 5 months
    status: 'active',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 0,
    percentagePaid: 50,
  },
  {
    id: 'timeline-demo-2',
    name: 'CERISAIE',
    address: 'CERISAIE',
    clientName: 'Grosjean',
    createdAt: new Date('2025-06-01').toISOString(),
    updatedAt: new Date('2025-06-01').toISOString(),
    startDate: new Date('2025-06-01').toISOString(),
    endDate: new Date('2025-11-15').toISOString(), // 5.5 months
    status: 'active',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 1,
    percentagePaid: 100,
  },
  {
    id: 'timeline-demo-3',
    name: 'Halle des Grésillons',
    address: 'Halle des Grésillons',
    clientName: '',
    createdAt: new Date('2025-04-14').toISOString(),
    updatedAt: new Date('2025-04-14').toISOString(),
    startDate: new Date('2025-04-14').toISOString(),
    endDate: new Date('2025-09-14').toISOString(), // 5 months
    status: 'completed',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 3,
    percentagePaid: 100,
  },
  {
    id: 'timeline-demo-4',
    name: 'BD AUGIER',
    address: 'BD AUGIER',
    clientName: 'Martin Chabrol',
    createdAt: new Date('2025-08-15').toISOString(),
    updatedAt: new Date('2025-08-15').toISOString(),
    startDate: new Date('2025-08-15').toISOString(),
    endDate: new Date('2025-12-20').toISOString(), // 4 months
    status: 'active',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 1,
    percentagePaid: 100,
  },
  {
    id: 'timeline-demo-5',
    name: '7 RUE BOULLE',
    address: '7 RUE BOULLE',
    clientName: 'Vienne&Berdon',
    createdAt: new Date('2025-07-10').toISOString(),
    updatedAt: new Date('2025-07-10').toISOString(),
    startDate: new Date('2025-07-10').toISOString(),
    endDate: new Date('2025-12-10').toISOString(), // 5 months
    status: 'active',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 2,
    percentagePaid: 90,
  },
  {
    id: 'timeline-demo-6',
    name: '16 AV GAL LECLERC',
    address: '16 AV GAL LECLERC',
    clientName: 'Elisabeth Mr Lambert (AALS)',
    createdAt: new Date('2025-09-01').toISOString(),
    updatedAt: new Date('2025-09-01').toISOString(),
    startDate: new Date('2025-09-01').toISOString(),
    endDate: new Date('2026-02-15').toISOString(), // 5.5 months
    status: 'ready',
    isDemo: true,
    hasData: false,
    devisStatus: 'sent',
    invoiceCount: 0,
    percentagePaid: 90,
  },
  {
    id: 'timeline-demo-7',
    name: 'BRUNEL',
    address: 'BRUNEL',
    clientName: 'Mr et Mme de La Source',
    createdAt: new Date('2025-10-20').toISOString(),
    updatedAt: new Date('2025-10-20').toISOString(),
    startDate: new Date('2025-10-20').toISOString(),
    endDate: new Date('2026-04-20').toISOString(), // 6 months
    status: 'ready',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 0,
    percentagePaid: 100,
  },
  {
    id: 'timeline-demo-8',
    name: 'CINIERI - PERRICHONT',
    address: 'CINIERI - PERRICHONT',
    clientName: '',
    createdAt: new Date('2025-11-01').toISOString(),
    updatedAt: new Date('2025-11-01').toISOString(),
    startDate: new Date('2025-11-01').toISOString(),
    endDate: new Date('2026-05-01').toISOString(), // 6 months
    status: 'ready',
    isDemo: true,
    hasData: false,
    devisStatus: 'sent',
    invoiceCount: 0,
    percentagePaid: 50,
  },
  {
    id: 'timeline-demo-9',
    name: 'SAINT NOM LA BRETECHE',
    address: 'SAINT NOM LA BRETECHE',
    clientName: 'Rejraji',
    createdAt: new Date('2025-01-21').toISOString(),
    updatedAt: new Date('2025-01-21').toISOString(),
    startDate: new Date('2025-01-21').toISOString(),
    endDate: new Date('2025-08-21').toISOString(), // 7 months
    status: 'active',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 2,
    percentagePaid: 100,
  },
  {
    id: 'timeline-demo-10',
    name: 'WAGRAM',
    address: 'WAGRAM',
    clientName: 'Mr et Mme LASOU',
    createdAt: new Date('2025-05-10').toISOString(),
    updatedAt: new Date('2025-05-10').toISOString(),
    startDate: new Date('2025-05-10').toISOString(),
    endDate: new Date('2025-10-10').toISOString(), // 5 months
    status: 'active',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 1,
    percentagePaid: 50,
  },
  {
    id: 'timeline-demo-11',
    name: 'DMG 9 Rue Duperré 9e Paris',
    address: 'DMG 9 Rue Duperré 9e Paris',
    clientName: 'David Marchenoir',
    createdAt: new Date('2025-03-15').toISOString(),
    updatedAt: new Date('2025-03-15').toISOString(),
    startDate: new Date('2025-03-15').toISOString(),
    endDate: new Date('2025-08-15').toISOString(), // 5 months
    status: 'completed',
    isDemo: true,
    hasData: false,
    devisStatus: 'approved',
    invoiceCount: 3,
    percentagePaid: 100,
  },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState(() => {
    // Initial state: load from localStorage for immediate render
    const saved = localStorage.getItem('renovationProjects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    // Load selected project from localStorage
    return localStorage.getItem('selectedProjectId') || null;
  });

  const [convertedDemoProjects, setConvertedDemoProjects] = useState(() => {
    // Load converted demo project IDs from localStorage
    const saved = localStorage.getItem('convertedDemoProjects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [hiddenFromRegularDemos, setHiddenFromRegularDemos] = useState(() => {
    // Load hidden from regular demo project IDs from localStorage
    const saved = localStorage.getItem('hiddenFromRegularDemos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Default: empty array - main demo shows in regular projects by default
        return [];
      }
    }
    // Default: empty array - main demo shows in regular projects by default
    return [];
  });
  
  // Load projects from API on mount (with localStorage fallback)
  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      try {
        // Get user ID from sessionStorage (set during login)
        const userId = sessionStorage.getItem('userId');
        
        // Build URL with user_id parameter if available
        // Always include hidden projects so we can filter them in the frontend
        const url = userId 
          ? `${API_BASE_URL}/api/projects?user_id=${encodeURIComponent(userId)}&include_hidden=true`
          : `${API_BASE_URL}/api/projects?include_hidden=true`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const apiProjects = data.projects || [];
          
          // Merge with demo projects (hardcoded, not in DB)
          // Demo projects are always included
          setProjects(apiProjects);
          
          // Also save to localStorage for fallback
          localStorage.setItem('renovationProjects', JSON.stringify(apiProjects));
          
          setLoading(false);
          return;
        } else if (response.status === 501) {
          // Database not enabled - use localStorage fallback
          console.log('API returned 501 - database not enabled, using localStorage');
        }
      } catch (error) {
        // API not available or failed - use localStorage fallback
        console.log('API call failed, using localStorage fallback:', error);
      }
      
      // Fallback to localStorage
      const saved = localStorage.getItem('renovationProjects');
      if (saved) {
        try {
          const storedProjects = JSON.parse(saved);
          setProjects(storedProjects);
        } catch {
          setProjects([]);
        }
      } else {
        setProjects([]);
      }
      setLoading(false);
    }

    loadProjects();
  }, []);

  // Watch for fresh logins and reset state accordingly
  // This runs on mount AND whenever localStorage is cleared (indicating new login)
  useEffect(() => {
    const checkAndReset = () => {
      // Check if user just logged in (check both justLoggedIn flag and if localStorage was cleared)
      const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true';
      const hasNoProjects = !localStorage.getItem('renovationProjects');
      const hasNoConvertedDemos = !localStorage.getItem('convertedDemoProjects');
      const hasNoHiddenDemos = !localStorage.getItem('hiddenFromRegularDemos');
      
      // If just logged in OR all localStorage keys are cleared (fresh state), reset to defaults
      if (justLoggedIn || (hasNoProjects && hasNoConvertedDemos && hasNoHiddenDemos)) {
        // Reset to fresh state
        setProjects([]);
        setConvertedDemoProjects([]);
        setHiddenFromRegularDemos([]); // Empty array = main demo shows in regular projects
        setSelectedProjectId(null);
        
        // Clear the flag if it exists
        if (justLoggedIn) {
          sessionStorage.removeItem('justLoggedIn');
        }
        return true; // Indicate reset happened
      }
      return false; // No reset needed
    };

    // Check on mount
    checkAndReset();

    // Also check periodically for the justLoggedIn flag (in case provider was already mounted)
    // This handles the case where user logs in again without logging out
    const interval = setInterval(() => {
      const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true';
      if (justLoggedIn) {
        const resetHappened = checkAndReset();
        // Once flag is cleared, we can stop checking (it will be cleared in checkAndReset)
        // The interval will continue but will be cheap since justLoggedIn will be false
      }
    }, 200); // Check every 200ms (less frequent to reduce overhead)

    return () => clearInterval(interval);
  }, []); // Run on mount, but interval continues checking

  // Save to localStorage whenever projects change
  useEffect(() => {
    localStorage.setItem('renovationProjects', JSON.stringify(projects));
  }, [projects]);

  // Save selected project to localStorage
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selectedProjectId', selectedProjectId);
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  }, [selectedProjectId]);

  // Save converted demo projects to localStorage
  useEffect(() => {
    localStorage.setItem('convertedDemoProjects', JSON.stringify(convertedDemoProjects));
  }, [convertedDemoProjects]);

  // Save hidden from regular demos to localStorage
  useEffect(() => {
    localStorage.setItem('hiddenFromRegularDemos', JSON.stringify(hiddenFromRegularDemos));
  }, [hiddenFromRegularDemos]);

  const createProject = async (projectData) => {
    const newProject = {
      id: Date.now().toString(),
      name: projectData.name || 'Untitled Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft', // draft, ready, active, completed, archived
      ...projectData
    };
    
    // Validate project before creating
    const validation = validateProject(newProject);
    if (!validation.isValid) {
      console.error('Cannot create project:', validation.errors);
      throw new Error(`Invalid project data: ${validation.errors.join(', ')}`);
    }
    
    // Try API first
    try {
      // Get user ID from sessionStorage (set during login)
      const userId = sessionStorage.getItem('userId');
      
      // Build URL with user_id parameter if available
      const url = userId 
        ? `${API_BASE_URL}/api/projects?user_id=${encodeURIComponent(userId)}`
        : `${API_BASE_URL}/api/projects`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });
      
      if (response.ok) {
        const createdProject = await response.json();
        setProjects((prev) => [...prev, createdProject]);
        return createdProject;
      } else if (response.status === 501) {
        // Database not enabled - use localStorage
        console.log('API returned 501 - using localStorage');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.log('API create failed, using localStorage:', error);
    }
    
    // Fallback to localStorage
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  };

  const updateProject = async (id, updates) => {
    // Don't update demo projects via API
    if (id === DEMO_PROJECT_ID || id === EMPTY_DEMO_PROJECT_ID || id === PENDING_APPROVAL_DEMO_PROJECT_ID) {
      // Update locally only (demo projects not in DB)
      setProjects((prev) => {
        return prev.map((project) => {
          if (project.id === id) {
            const updatedProject = { ...project, ...updates, updatedAt: new Date().toISOString() };
            const dateValidation = validateProjectDates(updatedProject);
            if (!dateValidation.isValid) {
              console.warn(`Project ${id} has invalid dates:`, dateValidation.errors);
            }
            return updatedProject;
          }
          return project;
        });
      });
      return;
    }
    
    // Try API first
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedProject = await response.json();
        setProjects((prev) => {
          return prev.map((project) => project.id === id ? updatedProject : project);
        });
        return;
      } else if (response.status === 501) {
        // Database not enabled - use localStorage
        console.log('API returned 501 - using localStorage');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.log('API update failed, using localStorage:', error);
    }
    
    // Fallback to localStorage
    setProjects((prev) => {
      return prev.map((project) => {
        if (project.id === id) {
          const updatedProject = { ...project, ...updates, updatedAt: new Date().toISOString() };
          
          // Validate dates before updating
          const dateValidation = validateProjectDates(updatedProject);
          if (!dateValidation.isValid) {
            console.warn(`Project ${id} has invalid dates:`, dateValidation.errors);
          }
          
          return updatedProject;
        }
        return project;
      });
    });
  };

  const toggleProjectHidden = async (id, hidden) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hidden }),
      });

      if (response.ok) {
        const updatedProject = await response.json();
        console.log('Project hidden toggled:', { id, hidden, updatedProject });
        
        // Update the project in the list and localStorage
        setProjects((prev) => {
          const updated = prev.map((p) => (p.id === id ? { ...p, ...updatedProject } : p));
          // Update localStorage with the new state
          localStorage.setItem('renovationProjects', JSON.stringify(updated));
          return updated;
        });
      } else {
        const error = await response.json();
        console.error('Error toggling project hidden:', error);
        alert(`Failed to ${hidden ? 'hide' : 'show'} project: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error toggling project hidden:', error);
      alert(`Failed to ${hidden ? 'hide' : 'show'} project: ${error.message}`);
    }
  };

  const deleteProject = async (id) => {
    // Don't allow deleting demo projects
    if (id === DEMO_PROJECT_ID || id === EMPTY_DEMO_PROJECT_ID || id === PENDING_APPROVAL_DEMO_PROJECT_ID) {
      return;
    }
    
    // Check if project is a system project (cannot be deleted)
    const project = projects.find(p => p.id === id);
    if (project?.isSystem) {
      console.warn(`Cannot delete system project: ${project.name}`);
      return;
    }
    
    // Try API first
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setProjects((prev) => prev.filter((project) => project.id !== id));
        return;
      } else if (response.status === 501) {
        // Database not enabled - use localStorage
        console.log('API returned 501 - using localStorage');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.log('API delete failed, using localStorage:', error);
    }
    
    // Fallback to localStorage
    setProjects((prev) => prev.filter((project) => project.id !== id));
  };

  const convertDemoToReal = (demoProjectId) => {
    // Get the demo project
    let demoProject = null;
    if (demoProjectId === DEMO_PROJECT_ID) {
      demoProject = DEMO_PROJECT;
    } else if (demoProjectId === EMPTY_DEMO_PROJECT_ID) {
      demoProject = EMPTY_DEMO_PROJECT;
    } else if (demoProjectId === PENDING_APPROVAL_DEMO_PROJECT_ID) {
      demoProject = PENDING_APPROVAL_DEMO_PROJECT;
    }

    if (!demoProject) {
      return null;
    }

    // Create a real project from the demo project
    const realProject = {
      ...demoProject,
      id: `${demoProjectId}-${Date.now()}`, // New unique ID
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to projects list
    setProjects((prev) => [...prev, realProject]);

    // Mark this demo project as converted
    setConvertedDemoProjects((prev) => {
      if (!prev.includes(demoProjectId)) {
        return [...prev, demoProjectId];
      }
      return prev;
    });

    return realProject;
  };

  const removeOrDeleteProject = (projectId) => {
    // Check if this is a converted demo project (starts with demo project ID)
    const isConvertedDemo = projectId.startsWith(DEMO_PROJECT_ID + '-') ||
                           projectId.startsWith(EMPTY_DEMO_PROJECT_ID + '-') ||
                           projectId.startsWith(PENDING_APPROVAL_DEMO_PROJECT_ID + '-');

    if (isConvertedDemo) {
      // Extract the original demo project ID
      let originalDemoId = null;
      if (projectId.startsWith(DEMO_PROJECT_ID + '-')) {
        originalDemoId = DEMO_PROJECT_ID;
      } else if (projectId.startsWith(EMPTY_DEMO_PROJECT_ID + '-')) {
        originalDemoId = EMPTY_DEMO_PROJECT_ID;
      } else if (projectId.startsWith(PENDING_APPROVAL_DEMO_PROJECT_ID + '-')) {
        originalDemoId = PENDING_APPROVAL_DEMO_PROJECT_ID;
      }

      // Remove from projects list and restore to demo section
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      
      if (originalDemoId) {
        // Remove from converted list to restore it to demo section
        setConvertedDemoProjects((prev) => prev.filter((id) => id !== originalDemoId));
      }
    } else if (projectId === DEMO_PROJECT_ID || projectId === EMPTY_DEMO_PROJECT_ID || projectId === PENDING_APPROVAL_DEMO_PROJECT_ID) {
      // This is a demo project appearing in regular projects - hide it from regular projects
      setHiddenFromRegularDemos((prev) => {
        if (!prev.includes(projectId)) {
          return [...prev, projectId];
        }
        return prev;
      });
    } else {
      // Regular project - delete it
      deleteProject(projectId);
    }
  };

  const getProject = (id) => {
    if (id === DEMO_PROJECT_ID) {
      return DEMO_PROJECT;
    }
    if (id === EMPTY_DEMO_PROJECT_ID) {
      return EMPTY_DEMO_PROJECT;
    }
    if (id === PENDING_APPROVAL_DEMO_PROJECT_ID) {
      return PENDING_APPROVAL_DEMO_PROJECT;
    }
    return projects.find((project) => project.id === id);
  };

  // Combine demo projects with user projects (excluding converted ones)
  const allProjects = useMemo(() => {
    const demos = [];
    if (!convertedDemoProjects.includes(DEMO_PROJECT_ID)) {
      demos.push(DEMO_PROJECT);
    }
    if (!convertedDemoProjects.includes(EMPTY_DEMO_PROJECT_ID)) {
      demos.push(EMPTY_DEMO_PROJECT);
    }
    if (!convertedDemoProjects.includes(PENDING_APPROVAL_DEMO_PROJECT_ID)) {
      demos.push(PENDING_APPROVAL_DEMO_PROJECT);
    }
    // Add timeline demo projects (always include them for timeline view)
    demos.push(...TIMELINE_DEMO_PROJECTS);
    return [...demos, ...projects];
  }, [projects, convertedDemoProjects]);

  const selectProject = (id) => {
    setSelectedProjectId(id);
  };

  const clearSelectedProject = () => {
    setSelectedProjectId(null);
  };

  const selectedProject = selectedProjectId ? getProject(selectedProjectId) : null;

  return (
    <ProjectsContext.Provider
      value={{
        projects: allProjects, // Include demo project
        createProject,
        updateProject,
        deleteProject,
        toggleProjectHidden,
        getProject,
        selectedProjectId,
        selectedProject,
        selectProject,
        clearSelectedProject,
        convertDemoToReal,
        removeOrDeleteProject,
        hiddenFromRegularDemos,
        loading,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within ProjectsProvider');
  }
  return context;
}

