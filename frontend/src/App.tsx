import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AppProvider } from './providers/AppProvider';
import { ThemeProvider } from './components/ThemeProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DevTools } from './components/DevTools';
import { usePushNotifications } from './hooks/usePushNotifications';
import { Toaster } from 'react-hot-toast';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const DebugPage = lazy(() =>
  import('./pages/DebugPage').then((m) => ({ default: m.DebugPage })),
);
const AdminPanel = lazy(() =>
  import('./pages/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const ChatPage = lazy(() =>
  import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })),
);
const FeaturesTestPage = lazy(() =>
  import('./pages/FeaturesTestPage').then((m) => ({ default: m.FeaturesTestPage })),
);
const ShadcnDemo = lazy(() =>
  import('./components/ShadcnDemo').then((m) => ({ default: m.ShadcnDemo })),
);


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
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center text-muted-foreground">
              Loading...
            </div>
          }
        >
          <div className="h-screen">
            {/* <div className="p-4 text-black bg-white dark:bg-black dark:text-white">
  If this flips, dark works.
</div> */}

            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/debug" element={<DebugPage />} />
              <Route path="/shadcn-demo" element={<ShadcnDemo />} />
              <Route path="/test" element={<FeaturesTestPage />} />
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
        </Suspense>
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
