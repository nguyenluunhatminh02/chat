
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AppProvider } from './providers/AppProvider';
import { ChatPage } from './pages/ChatPage';
import { LoginPage } from './pages/LoginPage';
import { DebugPage } from './pages/DebugPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ShadcnDemo } from './components/ShadcnDemo';
import { testAPI } from './utils/test-api';
import { DevTools } from './components/DevTools';
import { usePushNotifications } from './hooks/usePushNotifications';

// Make testAPI available globally for debugging
declare global {
  interface Window {
    testAPI: typeof testAPI;
  }
}
window.testAPI = testAPI;

function AppContent() {
  // Register push notifications for current user
  const push = usePushNotifications();

  // Log push status (optional - for debugging)
  if (push.error) {
    console.warn('Push notifications error:', push.error);
  }

  return (
    <>
      <DevTools /> {/* 🔧 Dev Mode: Press "D" to toggle */}
      <Router>
          <div className="h-screen">
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="/shadcn-demo" element={<ShadcnDemo />} />
              <Route 
                path="/chat" 
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/chat/:conversationId" 
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </Router>
      </>
  );
}

function App() {
  return (
    <QueryProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </QueryProvider>
  );
}

export default App;