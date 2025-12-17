import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useRole, ROLES, useTheme } from '../contexts/AppContext.jsx';
import TopBar from './TopBar.jsx';
import AIPanel from './AIPanel.jsx';

const navLinkClass = ({ isActive }) =>
  ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ');

function Sidebar() {
  const { t } = useTranslation();
  const { role } = useRole();
  const location = useLocation();

  const isGlobalDashboard = location.pathname === '/global-dashboard';
  const isSettings = location.pathname === '/settings';
  const isTimeline = location.pathname === '/timeline';
  const isWorkers = location.pathname === '/workers';

  // If on global dashboard, settings, timeline, or workers page, show navigation links
  if (isGlobalDashboard || isSettings || isTimeline || isWorkers) {
    return (
      <aside className="sidebar">
        <nav className="nav-links">
          <NavLink
            to="/global-dashboard"
            className={navLinkClass}
          >
            {t('navProjects')}
          </NavLink>
          <NavLink
            to="/timeline"
            className={navLinkClass}
          >
            {t('navTimeline')}
          </NavLink>
          <NavLink
            to="/workers"
            className={navLinkClass}
          >
            {t('navWorkers') || 'Workers'}
          </NavLink>
          <NavLink
            to="/settings"
            className={navLinkClass}
          >
            {t('navSettings')}
          </NavLink>
        </nav>
      </aside>
    );
  }

  // Helper function to check if role is a client role
  const isClientRole = (r) => {
    return r === ROLES.CLIENT || 
           r === ROLES.ALEXIS_ROCHE || 
           r === ROLES.PAUL_ROCHE ||
           (r && !Object.values(ROLES).includes(r)); // Custom roles are also client roles
  };

  // Role-based navigation items for tracking pages
  const navItems = [
    { path: '/dashboard', label: t('navDashboard'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT, ROLES.ALEXIS_ROCHE, ROLES.PAUL_ROCHE] },
    { path: '/materials', label: t('navMaterials'), roles: [ROLES.CONTRACTOR, ROLES.ARCHITECT] },
    { path: '/client-materials', label: t('navClientMaterials') || 'Client Materials', roles: [ROLES.CLIENT, ROLES.ALEXIS_ROCHE, ROLES.PAUL_ROCHE] },
    { path: '/client-validation', label: t('navClientValidation'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ALEXIS_ROCHE, ROLES.PAUL_ROCHE] },
    { path: '/chat-history', label: t('navChatHistory'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT, ROLES.ALEXIS_ROCHE, ROLES.PAUL_ROCHE] },
    { path: '/edit-history', label: t('navEditHistory'), roles: [ROLES.CONTRACTOR, ROLES.ARCHITECT] },
    { path: '/prompt-library', label: t('navPromptLibrary'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT, ROLES.ALEXIS_ROCHE, ROLES.PAUL_ROCHE] },
    { path: '/create-devis', label: t('navCreateDevis'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT, ROLES.ALEXIS_ROCHE, ROLES.PAUL_ROCHE] },
    // Future: Add role-specific pages
    // { path: '/deliveries', label: t('navDeliveries'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT] },
    // { path: '/approvals', label: t('navApprovals'), roles: [ROLES.CLIENT, ROLES.ARCHITECT] },
  ];

  // Filter items based on role, including custom roles
  const visibleItems = navItems.filter(item => {
    if (item.roles.includes(role)) {
      return true;
    }
    // Check if role is a custom role and if any role in the list is a client role
    if (isClientRole(role)) {
      return item.roles.some(r => isClientRole(r));
    }
    return false;
  });

  return (
    <aside className="sidebar">
      <nav className="nav-links">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={navLinkClass}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function Layout() {
  const location = useLocation();
  const isGlobalDashboard = location.pathname === '/global-dashboard';
  const isSettings = location.pathname === '/settings';
  const isTimeline = location.pathname === '/timeline';
  const isWorkers = location.pathname === '/workers';
  const showAIPanel = !isGlobalDashboard && !isSettings && !isTimeline && !isWorkers;
  const { theme } = useTheme();

  return (
    <div className={`app-shell theme-${theme}`}>
      <TopBar />
      <div className={`app-body ${showAIPanel ? 'has-ai-panel' : ''}`}>
        <Sidebar />
        <main className={`content ${isTimeline || isWorkers ? 'content-no-scale' : 'content-scaled'}`}>
          <Outlet />
        </main>
        {showAIPanel && <AIPanel />}
      </div>
    </div>
  );
}

export default Layout;

