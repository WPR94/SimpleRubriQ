import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
// Lazy-load heavier routes to reduce initial bundle
const EssayFeedback = lazy(() => import('./pages/EssayFeedback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Rubrics = lazy(() => import('./pages/Rubrics'));
const Analytics = lazy(() => import('./pages/Analytics'));
const BatchProcessor = lazy(() => import('./pages/BatchProcessor'));
const Calibration = lazy(() => import('./pages/Calibration'));
const FeedbackHistory = lazy(() => import('./pages/FeedbackHistory'));
const Demo = lazy(() => import('./pages/Demo'));
const DashboardDemo = lazy(() => import('./pages/DashboardDemo'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const DataProcessingAgreement = lazy(() => import('./pages/DataProcessingAgreement'));
import AccountSettings from './pages/AccountSettings';
import ProtectedRoute from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUsers } from './pages/AdminUsers';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AdminActivityLogs } from './pages/AdminActivityLogs';
import { CookieConsent } from './components/CookieConsent';
import { FeedbackButton } from './components/FeedbackButton';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { testSupabaseConnection } from './lib/supabaseClient';
import AvailabilityBanner from './components/AvailabilityBanner';
import SuspenseFallback from './components/SuspenseFallback';

function App() {
  // Session timeout for security (auto-logout after inactivity)
  useSessionTimeout();
  
  const { user } = useAuth();

  // Quick connectivity check on mount (dev aid)
  useEffect(() => {
    testSupabaseConnection();
  }, []);

  return (
    <div className="overflow-x-hidden">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <AvailabilityBanner />
      <CookieConsent />
      {/* Show feedback button only for authenticated users */}
      {user && <FeedbackButton />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        {/* Protected routes */}
        <Route element={<ProtectedRoute />}> 
          <Route path="/dashboard" element={<Suspense fallback={<SuspenseFallback />}><Dashboard /></Suspense>} />
          <Route path="/essay-feedback" element={<Suspense fallback={<SuspenseFallback />}><EssayFeedback /></Suspense>} />
          <Route path="/feedback-history" element={<Suspense fallback={<SuspenseFallback />}><FeedbackHistory /></Suspense>} />
          <Route path="/students" element={<Suspense fallback={<SuspenseFallback />}><Students /></Suspense>} />
          <Route path="/rubrics" element={<Suspense fallback={<SuspenseFallback />}><Rubrics /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<SuspenseFallback />}><Analytics /></Suspense>} />
          <Route path="/batch" element={<Suspense fallback={<SuspenseFallback />}><BatchProcessor /></Suspense>} />
          <Route path="/calibration" element={<Suspense fallback={<SuspenseFallback />}><Calibration /></Suspense>} />
        </Route>
        {/* Public */}
        <Route path="/demo" element={<Suspense fallback={<SuspenseFallback />}><Demo /></Suspense>} />
        <Route path="/dashboard-demo" element={<Suspense fallback={<SuspenseFallback />}><DashboardDemo /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<SuspenseFallback />}><About /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<SuspenseFallback />}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<SuspenseFallback />}><Terms /></Suspense>} />
        <Route path="/dpa" element={<Suspense fallback={<SuspenseFallback />}><DataProcessingAgreement /></Suspense>} />
        {/* Protected Settings */}
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<Suspense fallback={<SuspenseFallback />}><AccountSettings /></Suspense>} />
        </Route>
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><Suspense fallback={<SuspenseFallback />}><AdminDashboard /></Suspense></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><Suspense fallback={<SuspenseFallback />}><AdminUsers /></Suspense></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><Suspense fallback={<SuspenseFallback />}><AdminAnalytics /></Suspense></AdminRoute>} />
        <Route path="/admin/activity" element={<AdminRoute><Suspense fallback={<SuspenseFallback />}><AdminActivityLogs /></Suspense></AdminRoute>} />
      </Routes>
    </div>
  );
}

export default App;