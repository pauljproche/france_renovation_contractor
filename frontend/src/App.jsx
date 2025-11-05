import { Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider, RoleProvider, AIPanelProvider, ThemeProvider } from './contexts/AppContext.jsx';
import { ChatHistoryProvider } from './contexts/ChatHistoryContext.jsx';
import { ProjectsProvider } from './contexts/ProjectsContext.jsx';
import Layout from './components/Layout.jsx';
import ProtectedTrackingRoute from './components/ProtectedTrackingRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import GlobalDashboard from './pages/GlobalDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Materials from './pages/Materials.jsx';
import ChatHistory from './pages/ChatHistory.jsx';
import Settings from './pages/Settings.jsx';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <RoleProvider>
          <AIPanelProvider>
            <ProjectsProvider>
              <ChatHistoryProvider>
                <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route element={<Layout />}>
                  <Route path="/global-dashboard" element={<GlobalDashboard />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/dashboard" element={
                    <ProtectedTrackingRoute>
                      <Dashboard />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/materials" element={
                    <ProtectedTrackingRoute>
                      <Materials />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/chat-history" element={
                    <ProtectedTrackingRoute>
                      <ChatHistory />
                    </ProtectedTrackingRoute>
                  } />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </ChatHistoryProvider>
            </ProjectsProvider>
          </AIPanelProvider>
        </RoleProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;

