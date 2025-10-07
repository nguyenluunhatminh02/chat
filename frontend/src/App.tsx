import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AppProvider } from './providers/AppProvider';
import { ThemeProvider } from './components/ThemeProvider';
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


function AppContent() {
  // Register push notifications for current user
  const push = usePushNotifications();

  // Log push status (optional - for debugging)
  if (push.error) {
    console.warn('Push notifications error:', push.error);
  }

  return (
    <>
      <Toaster position="top-right" />
      <DevTools /> {/* 🔧 Dev Mode: Press "D" to toggle */}
      <Router>
          <div className="h-screen">
            {/* <div className="p-4 text-black bg-white dark:bg-black dark:text-white">
  If this flips, dark works.
</div> */}


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
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
      <QueryProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

export default App;