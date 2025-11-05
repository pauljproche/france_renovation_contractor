import { useProjects } from '../contexts/ProjectsContext.jsx';
import { useEffect } from 'react';

function ProtectedTrackingRoute({ children }) {
  const { selectedProject, projects, selectProject } = useProjects();

  // Auto-select first project if none selected but projects exist
  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [selectedProject, projects, selectProject]);

  // Allow access to tracking pages - will show empty state if no project/projects
  return children;
}

export default ProtectedTrackingRoute;

