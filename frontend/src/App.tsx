import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AppProvider } from './providers/AppProvider';
import { ChatPage } from './pages/ChatPage';
import { LoginPage } from './pages/LoginPage';
import { DebugPage } from './pages/DebugPage';
import { AdminPanel } from './pages/AdminPanel';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ShadcnDemo } from './components/ShadcnDemo';
import { DevTools } from './components/DevTools';
import { usePushNotifications } from './hooks/usePushNotifications';
import { Toaster } from 'react-hot-toast';
import { useAppContext } from './hooks/useAppContext';


function AppContent() {
  // Register push notifications for current user
  const push = usePushNotifications();
  const { currentUserId } = useAppContext();

  // Log push status (optional - for debugging)
  if (push.error) {
    console.warn('Push notifications error:', push.error);
  }

  // 🌙 Apply dark mode on app load (before SettingsModal is opened)
  useEffect(() => {
    const storageKey = `darkMode-${currentUserId || ''}`;
    const savedDarkMode = localStorage.getItem(storageKey);
    const isDark = savedDarkMode === 'true';

    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
  }, [currentUserId]);

  return (
    <>
      <Toaster position="top-right" />
      <DevTools /> {/* 🔧 Dev Mode: Press "D" to toggle */}
      <Router>
          <div className="h-screen">
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="/shadcn-demo" element={<ShadcnDemo />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminPanel />
                  </ProtectedRoute>
                } 
              />
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
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <AnalyticsPage />
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