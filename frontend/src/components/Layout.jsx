import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useRole, ROLES } from '../contexts/AppContext.jsx';
import TopBar from './TopBar.jsx';
import AIPanel from './AIPanel.jsx';

const navLinkClass = ({ isActive }) =>
  ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ');

function Sidebar() {
  const { t } = useTranslation();
  const { role } = useRole();

  // Role-based navigation items
  const navItems = [
    { path: '/dashboard', label: t('navDashboard'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    { path: '/materials', label: t('navMaterials'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
    { path: '/chat-history', label: t('navChatHistory'), roles: [ROLES.CONTRACTOR, ROLES.CLIENT, ROLES.ARCHITECT] },
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
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <Sidebar />
        <main className="content"><Outlet /></main>
        <AIPanel />
      </div>
    </div>
  );
}

export default Layout;

