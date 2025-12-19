import { Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider, RoleProvider, AIPanelProvider, ThemeProvider } from './contexts/AppContext.jsx';
import { ChatHistoryProvider } from './contexts/ChatHistoryContext.jsx';
import { ProjectsProvider } from './contexts/ProjectsContext.jsx';
import { WorkersProvider } from './contexts/WorkersContext.jsx';
import { CustomTableProvider } from './contexts/CustomTableContext.jsx';
import Layout from './components/Layout.jsx';
import ProtectedTrackingRoute from './components/ProtectedTrackingRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import GlobalDashboard from './pages/GlobalDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Materials from './pages/Materials.jsx';
import ChatHistory from './pages/ChatHistory.jsx';
import Settings from './pages/Settings.jsx';
import Timeline from './pages/Timeline.jsx';
import Workers from './pages/Workers.jsx';
import ClientValidation from './pages/ClientValidation.jsx';
import ClientMaterials from './pages/ClientMaterials.jsx';
import EditHistory from './pages/EditHistory.jsx';
import PromptLibrary from './pages/PromptLibrary.jsx';
import CreateDevis from './pages/CreateDevis.jsx';

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <RoleProvider>
          <AIPanelProvider>
            <ProjectsProvider>
              <WorkersProvider>
              <ChatHistoryProvider>
                <CustomTableProvider>
                <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route element={<Layout />}>
                  <Route path="/global-dashboard" element={<GlobalDashboard />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/timeline" element={<Timeline />} />
                  <Route path="/workers" element={<Workers />} />
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
                  <Route path="/client-validation" element={
                    <ProtectedTrackingRoute>
                      <ClientValidation />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/client-materials" element={
                    <ProtectedTrackingRoute>
                      <ClientMaterials />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/chat-history" element={
                    <ProtectedTrackingRoute>
                      <ChatHistory />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/edit-history" element={
                    <ProtectedTrackingRoute>
                      <EditHistory />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/prompt-library" element={
                    <ProtectedTrackingRoute>
                      <PromptLibrary />
                    </ProtectedTrackingRoute>
                  } />
                  <Route path="/create-devis" element={
                    <ProtectedTrackingRoute>
                      <CreateDevis />
                    </ProtectedTrackingRoute>
                  } />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
                </CustomTableProvider>
              </ChatHistoryProvider>
              </WorkersProvider>
            </ProjectsProvider>
          </AIPanelProvider>
        </RoleProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;

