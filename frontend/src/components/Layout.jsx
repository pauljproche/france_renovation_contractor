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

  // If on global dashboard or settings page, show "Projects" and "Settings" links
  if (isGlobalDashboard || isSettings) {
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
            to="/settings"
            className={navLinkClass}
          >
            {t('navSettings')}
          </NavLink>
        </nav>
      </aside>
    );
  }

  // Role-based navigation items for tracking pages
  const navItems = [
    { path: '/dashboard', label: t('navDashboard'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    { path: '/materials', label: t('navMaterials'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    { path: '/client-validation', label: t('navClientValidation'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT] },
    { path: '/chat-history', label: t('navChatHistory'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    { path: '/edit-history', label: t('navEditHistory'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    { path: '/prompt-library', label: t('navPromptLibrary'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    // Future: Add role-specific pages
    // { path: '/deliveries', label: t('navDeliveries'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT] },
    // { path: '/approvals', label: t('navApprovals'), roles: [ROLES.CLIENT, ROLES.ARCHITECT] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

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
  const showAIPanel = !isGlobalDashboard && !isSettings;
  const { theme } = useTheme();

  return (
    <div className={`app-shell theme-${theme}`}>
      <TopBar />
      <div className="app-body">
        <Sidebar />
        <main className="content"><Outlet /></main>
        {showAIPanel && <AIPanel />}
      </div>
    </div>
  );
}

export default Layout;

