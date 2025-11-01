import { Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider, RoleProvider, AIPanelProvider } from './contexts/AppContext.jsx';
import { ChatHistoryProvider } from './contexts/ChatHistoryContext.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Materials from './pages/Materials.jsx';
import ChatHistory from './pages/ChatHistory.jsx';

function App() {
  return (
    <LanguageProvider>
      <RoleProvider>
        <AIPanelProvider>
          <ChatHistoryProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/materials" element={<Materials />} />
                <Route path="/chat-history" element={<ChatHistory />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ChatHistoryProvider>
        </AIPanelProvider>
      </RoleProvider>
    </LanguageProvider>
  );
}

export default App;

