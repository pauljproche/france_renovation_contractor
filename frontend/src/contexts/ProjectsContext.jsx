import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ProjectsContext = createContext(undefined);

// Demo projects that are always available
const DEMO_PROJECT_ID = 'demo-project';
const EMPTY_DEMO_PROJECT_ID = 'empty-demo-project';
const PENDING_APPROVAL_DEMO_PROJECT_ID = 'pending-approval-demo-project';

const DEMO_PROJECT = {
  id: DEMO_PROJECT_ID,
  name: 'Demo Renovation Project',
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'active',
  isDemo: true,
  hasData: true, // Uses existing materials.json
  devisStatus: 'approved', // sent, approved, rejected
  invoiceCount: 2, // Number of invoices sent
};

const EMPTY_DEMO_PROJECT = {
  id: EMPTY_DEMO_PROJECT_ID,
  name: 'Empty Demo Project',
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'draft',
  isDemo: true,
  hasData: false, // No data - empty state
  devisStatus: null, // No devis yet
  invoiceCount: 0,
};

const PENDING_APPROVAL_DEMO_PROJECT = {
  id: PENDING_APPROVAL_DEMO_PROJECT_ID,
  name: 'Bathroom Renovation - Paris Apartment',
  createdAt: new Date('2024-10-15').toISOString(),
  updatedAt: new Date('2024-11-01').toISOString(),
  status: 'ready',
  isDemo: true,
  hasData: true, // Has devis data but waiting for approval
  devisStatus: 'sent', // Devis sent to client, pending approval
  invoiceCount: 0, // No invoices yet - waiting for approval
};

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState(() => {
    // Load from localStorage on init
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

  const createProject = (projectData) => {
    const newProject = {
      id: Date.now().toString(),
      name: projectData.name || 'Untitled Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft', // draft, ready, active, completed, archived
      ...projectData
    };
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  };

  const updateProject = (id, updates) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id
          ? { ...project, ...updates, updatedAt: new Date().toISOString() }
          : project
      )
    );
  };

  const deleteProject = (id) => {
    // Don't allow deleting demo projects
    if (id === DEMO_PROJECT_ID || id === EMPTY_DEMO_PROJECT_ID || id === PENDING_APPROVAL_DEMO_PROJECT_ID) {
      return;
    }
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
        getProject,
        selectedProjectId,
        selectedProject,
        selectProject,
        clearSelectedProject,
        convertDemoToReal,
        removeOrDeleteProject,
        hiddenFromRegularDemos,
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

